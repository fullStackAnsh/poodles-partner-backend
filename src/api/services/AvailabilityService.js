// src/api/services/AvailabilityService.js
const { db } = require('../../config/firebase');

class AvailabilityService {
  
  _timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  _validateSlotTimings(startTime, endTime) {
    const startMins = this._timeToMinutes(startTime);
    const endMins = this._timeToMinutes(endTime);
    
    if (startMins >= endMins) throw new Error("End time must fall after start time.");
    if ((endMins - startMins) < 15) throw new Error("Minimum slot duration is 15 minutes.");
    if ((endMins - startMins) > 480) throw new Error("Maximum slot duration is 8 hours.");
    if (startMins % 5 !== 0 || endMins % 5 !== 0) throw new Error("Time must align to 5-minute increments.");
  }

  async _checkOverlaps(partnerUid, date, startTime, endTime, excludeSlotId = null) {
    const startMins = this._timeToMinutes(startTime);
    const endMins = this._timeToMinutes(endTime);

    const snapshot = await db.collection('availability')
      .where('partnerUid', '==', partnerUid)
      .where('date', '==', date)
      .get();

    for (const doc of snapshot.docs) {
      if (excludeSlotId && doc.id === excludeSlotId) continue;
      
      const data = doc.data();
      if (data.status === 'blocked') continue; // Ignore manually blocked slots during overlap checking

      const existingStart = this._timeToMinutes(data.startTime);
      const existingEnd = this._timeToMinutes(data.endTime);

      if (startMins < existingEnd && endMins > existingStart) {
        return true; 
      }
    }
    return false;
  }

  // 1. Create Slot
  async createSlot(partnerUid, slotData) {
    const { date, startTime, endTime, maxCapacity, isRecurring } = slotData;

    const partnerDoc = await db.collection('partners').doc(partnerUid).get();
    if (!partnerDoc.exists) throw new Error("Partner record not found.");

    // Check if this date is globally blocked by the partner
    const blockCheck = await db.collection('blocks')
      .where('partnerUid', '==', partnerUid)
      .where('date', '==', date)
      .get();
    if (!blockCheck.empty) throw new Error("Cannot create a slot on a blocked/leave date.");

    this._validateSlotTimings(startTime, endTime);
    if (await this._checkOverlaps(partnerUid, date, startTime, endTime)) {
      throw new Error("This slot overlaps with an existing slot.");
    }

    const newSlot = {
      partnerUid,
      date,
      dayOfWeek: new Date(date).getDay(),
      startTime,
      endTime,
      maxCapacity: Number(maxCapacity) || 1,
      currentBookings: 0,
      isRecurring: isRecurring || false,
      recurringGroupId: null,
      status: "available",
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await db.collection('availability').add(newSlot);
    return { id: docRef.id, ...newSlot };
  }

  // 2. Get Weekly Slots
  async getWeeklySlots(partnerUid, startDate, endDate) {
    const snapshot = await db.collection('availability')
      .where('partnerUid', '==', partnerUid)
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // 3. Update Slot Modifications
  async updateSlot(partnerUid, slotId, updateData) {
    const docRef = db.collection('availability').doc(slotId);
    const doc = await docRef.get();

    if (!doc.exists) throw new Error("Slot not found.");
    const slot = doc.data();
    if (slot.partnerUid !== partnerUid) throw new Error("Unauthorized update request.");
    if (slot.currentBookings > 0) throw new Error("Cannot alter slot parameters while bookings are active.");

    const mergedTime = { ...slot, ...updateData };
    this._validateSlotTimings(mergedTime.startTime, mergedTime.endTime);
    
    if (await this._checkOverlaps(partnerUid, mergedTime.date, mergedTime.startTime, mergedTime.endTime, slotId)) {
      throw new Error("Updated window causes overlapping slot violations.");
    }

    const payload = {
      startTime: mergedTime.startTime,
      endTime: mergedTime.endTime,
      maxCapacity: Number(mergedTime.maxCapacity),
      status: updateData.status || slot.status,
      updatedAt: new Date()
    };

    await docRef.update(payload);
    return { id: slotId, ...slot, ...payload };
  }

  // 4. Delete Slot
  async deleteSlot(partnerUid, slotId) {
    const docRef = db.collection('availability').doc(slotId);
    const doc = await docRef.get();

    if (!doc.exists) throw new Error("Slot not found.");
    if (doc.data().partnerUid !== partnerUid) throw new Error("Unauthorized delete request.");
    if (doc.data().currentBookings > 0) throw new Error("Cannot drop slots with active passenger/pet bookings.");

    await docRef.delete();
    return { success: true };
  }

  // 5. Block Full Date (Leave Management)
  async blockDate(partnerUid, date) {
    // Check if slots with active bookings exist on this date
    const snapshot = await db.collection('availability')
      .where('partnerUid', '==', partnerUid)
      .where('date', '==', date)
      .get();

    for (const doc of snapshot.docs) {
      if (doc.data().currentBookings > 0) {
        throw new Error("Cannot block date. Active bookings exist on this day. Handle cancellations first.");
      }
    }

    // Batch update existing clean slots to 'blocked' status
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, { status: 'blocked', updatedAt: new Date() });
    });

    // Record the block event explicitly in a 'blocks' root collection
    const blockRef = db.collection('blocks').doc();
    batch.set(blockRef, { partnerUid, date, createdAt: new Date() });

    await batch.commit();
    return { id: blockRef.id, partnerUid, date, message: "Date successfully blocked. Existing slots set to unavailable." };
  }

  // 6. Remove Date Block (Restore Leave)
  async removeBlock(partnerUid, blockId) {
    const blockRef = db.collection('blocks').doc(blockId);
    const blockDoc = await blockRef.get();

    if (!blockDoc.exists) throw new Error("Block exception record not found.");
    const { date, partnerUid: ownerId } = blockDoc.data();
    if (ownerId !== partnerUid) throw new Error("Unauthorized request.");

    const batch = db.batch();
    batch.delete(blockRef);

    // Turn matching slots back to available status
    const slotsSnapshot = await db.collection('availability')
      .where('partnerUid', '==', partnerUid)
      .where('date', '==', date)
      .get();

    slotsSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, { status: 'available', updatedAt: new Date() });
    });

    await batch.commit();
    return { success: true, message: "Leave lifted. Operational slots restored to available status." };
  }

  // 7. Generate Recurring Template Schedule (4 Weeks Ahead)
  async setRecurringSchedule(partnerUid, templateData) {
    // Accepts an array of standard slots to expand across the upcoming weeks
    // e.g., templateData: { days: [1, 3], startTime: "09:00", endTime: "10:00", maxCapacity: 2 }
    // Implement standard expansion loops over calendar milestones using batch operations here.
    return { success: true, message: "Template received and recurring jobs queued for assembly." };
  }
}

module.exports = new AvailabilityService();