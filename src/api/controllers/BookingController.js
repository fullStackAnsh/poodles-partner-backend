// src/controllers/BookingController.js
const admin = require('firebase-admin');
const QueueService = require('../services/BookingQueueService');

exports.initiatePayment = async (req, res) => {
  // Mocking gateway signature returns 
  const mockPaymentId = `pay_${Math.random().toString(36).substring(7)}`;
  return res.status(200).json({
    success: true,
    paymentId: mockPaymentId,
    amount: req.body.amount || 1500,
    currency: 'INR',
    message: 'Mock payment signature generated successfully.'
  });
};

exports.createBooking = async (req, res) => {
  try {
    const { petProfileId, serviceType, slotId, scheduledDate, lat, lng, address, exactAddress, paymentId, amountPaid } = req.body;
    
    const queuePayload = {
      petOwnerUid: req.user.uid,
      petOwnerFirstName: req.body.petOwnerFirstName || 'Ansh',
      petProfileId,
      serviceType,
      slotId,
      scheduledDate,
      lat: lat || 26.44,              // 👈 Add fallback values or map them directly
      lng: lng || 74.63,              // 👈 Add fallback values or map them directly
      address: address || "Vaishali Nagar", 
      exactAddress: exactAddress || "123, Near RTU, Vaishali Nagar, Ajmer",
      paymentId,
      amountPaid
    };

    const result = await QueueService.enqueueBooking(queuePayload);
    return res.status(201).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.getPartnerBookings = async (req, res) => {
  try {
    const db = admin.firestore();
    const snapshot = await db.collection('bookings')
      .where('partnerUid', '==', req.user.uid)
      .get();

    let bookings = [];
    snapshot.forEach(doc => {
      let data = doc.data();
      
      // Data Obfuscation Rule Evaluation
      if (data.status === 'pending') {
        delete data.location.exactAddress; // Redact address if booking is pending
      }
      bookings.push(data);
    });

    return res.status(200).json(bookings);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.acceptBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const db = admin.firestore();
    const docRef = db.collection('bookings').doc(bookingId);
    const doc = await docRef.get();

    if (!doc.exists) return res.status(404).json({ error: 'Booking item not found' });
    
    await docRef.update({
      status: 'confirmed',
      acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
      chatEnabled: true
    });

    return res.status(200).json({ success: true, message: 'Booking accepted! Exact address details unlocked.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

exports.completeBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const db = admin.firestore();
    
    await db.collection('bookings').doc(bookingId).update({
      status: 'completed',
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      chatEnabled: false,
      chatLockedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.status(200).json({ success: true, message: 'Job completed. Chat closed.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};