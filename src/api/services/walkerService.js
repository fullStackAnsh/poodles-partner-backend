// src/api/services/walkerService.js
const { db } = require('../../config/firebase');

class WalkerService {
  // 1. Update Profile Settings (Max Capacity)
  async updateSettings(partnerId, maxCapacityPerSlot) {
  if (maxCapacityPerSlot === undefined || maxCapacityPerSlot === null) {
    const error = new Error("Missing maxCapacityPerSlot value.");
    error.statusCode = 400;
    throw error;
  }

  const parsedCapacity = parseInt(maxCapacityPerSlot, 10);
  if (isNaN(parsedCapacity) || parsedCapacity < 1) {
    const error = new Error("Invalid capacity value. Must be a number greater than 0.");
    error.statusCode = 400;
    throw error;
  }

  const partnerRef = db.collection('partners').doc(partnerId);
  
  // Safely use merge to update only this configuration field
  await partnerRef.set({ maxCapacityPerSlot: parsedCapacity }, { merge: true });
  
  return { partnerId, maxCapacityPerSlot: parsedCapacity };
}

  // 2. Fetch Future Upcoming Booked Slots
  async getUpcomingSlots(partnerId) {
    const snapshot = await db.collection('walkSessions')
      .where('partnerId', '==', partnerId)
      .where('status', '==', 'UPCOMING')
      .get();

    const slots = [];
    snapshot.forEach(doc => {
      slots.push({ id: doc.id, ...doc.data() });
    });
    return slots;
  }

  // 3. Start Walk Slot
  async startWalkSlot(bookingId) {
    const sessionRef = db.collection('walkSessions').doc(bookingId);
    const updateData = {
      sessionStatus: 'ACTIVE',
      'summary.startTime': new Date()
    };
    await sessionRef.update(updateData);
    return { bookingId, sessionStatus: 'ACTIVE' };
  }

  // 4. Update Geo-Coordinates during active walk
  async pingLocation(sessionId, latitude, longitude) {
    const sessionRef = db.collection('walkSessions').doc(sessionId);
    const timestamp = new Date();

    const locationUpdate = {
      'liveLocation.latitude': latitude,
      'liveLocation.longitude': longitude,
      'liveLocation.updatedAt': timestamp
    };

    await sessionRef.update(locationUpdate);

    // Append to raw tracking line array
    const rawPoint = { lat: latitude, lng: longitude, t: timestamp };
    const doc = await sessionRef.get();
    const currentRoute = doc.data().rawRoute || [];
    currentRoute.push(rawPoint);
    
    await sessionRef.update({ rawRoute: currentRoute });
    return { sessionId, currentPoint: rawPoint };
  }

  // 5. End Walk & Compute Summary
  async endWalkSlot(sessionId) {
    const sessionRef = db.collection('walkSessions').doc(sessionId);
    const doc = await sessionRef.get();
    
    if (!doc.exists) throw new Error("Walk session not found");
    const sessionData = doc.data();

    const endTime = new Date();
    const startTime = sessionData.summary.startTime.toDate();
    const durationSeconds = Math.floor((endTime - startTime) / 1000);

    // Dummy tracking values (Replace with genuine Ola Maps Snap-to-road parsing later)
    const dummyDistanceMeters = 1500; 
    const dummyOlaPolyline = "a~|pGjk_uO_fi@|sc@_ji@"; 

    const finalUpdate = {
      status: 'COMPLETED',
      'summary.endTime': endTime,
      'summary.durationSeconds': durationSeconds,
      'summary.totalDistanceMeters': dummyDistanceMeters,
      snappedPolyline: dummyOlaPolyline
    };

    await sessionRef.update(finalUpdate);
    return { sessionId, ...finalUpdate };
  }

  // 6. Save Walk Media Upload
  async addWalkPhoto(sessionId, photoUrl) {
    const sessionRef = db.collection('walkSessions').doc(sessionId);
    const photoObject = { photoUrl, uploadedAt: new Date() };

    const doc = await sessionRef.get();
    const currentPhotos = doc.data().photos || [];
    currentPhotos.push(photoObject);

    await sessionRef.update({ photos: currentPhotos });
    return photoObject;
  }

  // 7. Fetch Live Location details for Parent Feed
  async getLiveTrackingData(bookingId) {
    const snapshot = await db.collection('walkSessions')
      .where('bookingIds', 'array-contains', bookingId)
      .where('status', '==', 'ACTIVE')
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { sessionId: doc.id, liveLocation: doc.data().liveLocation };
  }

 // 🌟 9. Get Operational Walk Session Details for Next.js Interactive Control Matrix
  async getWalkSessionDetails(bookingId) {
    if (!bookingId) {
      const error = new Error("Missing booking reference identifier parameter.");
      error.statusCode = 400;
      throw error;
    }

    // 🎯 Target the document directly using bookingId as the Document ID reference
    const docRef = db.collection('walkSessions').doc(bookingId);
    const doc = await docRef.get();

    // If the document ID doesn't exist in the walkSessions collection
    if (!doc.exists) {
      const error = new Error(`No active tracking session found for booking ID: ${bookingId}`);
      error.statusCode = 400; 
      throw error;
    }

    const data = doc.data();

    // Return the full clean schema exactly like your Firestore dashboard blueprint
    return {
      id: doc.id,
      bookingId: data.bookingId,
      sessionStatus: data.sessionStatus || 'scheduled',
      startTime: data.startTime,
      startedAt: data.startedAt || null,
      endedAt: data.endedAt || null,
      createdAt: data.createdAt,
      currentLocation: data.currentLocation || null,
      coordinatesTimeline: data.coordinatesTimeline || [],
      petId: data.petId,
      userId: data.userId,
      walkerId: data.walkerId,
      ...data // Spreads any leftover tracking matrix parameters safely
    };
  }
}

module.exports = new WalkerService();