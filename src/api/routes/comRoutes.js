const express = require('express');
const router = express.Router();
const comController = require('../controllers/comController');
const { verifyToken } = require('../middleware/partnerMiddleware');

// Middleware applied to all communication routes
router.use(verifyToken);

// GET Chat Messages
router.get('/:bookingId/messages', comController.getMessages);

// POST Send Message
router.post('/:bookingId/messages', comController.sendMessage);

// POST Get Daily.co VoIP call token
router.post('/:bookingId/call/token', comController.getCallToken);

// POST Terminate call infrastructure and evict participants
router.post('/:bookingId/call/end', comController.endCall); // 🌟 ADDED THIS ROUTE

module.exports = router;