// src/routes/bookingRoutes.js
const express = require('express');
const router = express.Router();

// 1. Make sure this matches the EXACT casing of your file name (usually lowercase 'b')
const bookingController = require('../controllers/bookingController'); 

// 2. Changed 'isPartner' to 'partnerMiddleware' to match your actual file exports
const { verifyToken, partnerMiddleware } = require('../middleware/partnerMiddleware');

// Client Access endpoints
router.post('/payment/initiate', verifyToken, bookingController.initiatePayment);
router.post('/create', verifyToken, bookingController.createBooking);

// Provider/Partner Control endpoints 
// 3. Swapped in 'partnerMiddleware' below
router.get('/partner/bookings', verifyToken, partnerMiddleware, bookingController.getPartnerBookings);
router.put('/partner/bookings/:bookingId/accept', verifyToken, partnerMiddleware, bookingController.acceptBooking);
router.put('/partner/bookings/:bookingId/complete', verifyToken, partnerMiddleware, bookingController.completeBooking);

module.exports = router;