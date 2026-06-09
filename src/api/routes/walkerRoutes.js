// src/api/routes/walkerRoutes.js
const express = require('express');
const router = express.Router();
const walkerController = require('../controllers/walkerController');
const { verifyToken, partnerMiddleware } = require('../middleware/partnerMiddleware');

// --- PARTNER ONLY ACCESS RULES ---
// Applies token security validations down through all subsequent endpoints
router.use(verifyToken);

// Configurations & Schedule Listings
router.patch('/settings', partnerMiddleware, walkerController.updateSettings);
router.get('/slots/upcoming', partnerMiddleware, walkerController.getUpcomingSlots);

// Active Live Tracking Processing Paths
router.post('/walks/:bookingId/start', partnerMiddleware, walkerController.startWalkSlot);
router.post('/walks/:sessionId/ping-location', partnerMiddleware, walkerController.pingLocation);
router.post('/walks/:sessionId/end', partnerMiddleware, walkerController.endWalkSlot);
router.post('/walks/:sessionId/photos', partnerMiddleware, walkerController.uploadWalkPhoto);
router.get('/walks/:bookingId/session', walkerController.getWalkSessionDetails);

// --- OPEN / PUBLIC OWNER ACCESSIBLE PATHS ---
// Pet owners need to consume these streams using their bookingId references
router.get('/owner/:bookingId/live-location', walkerController.getLiveTrackingData);
router.get('/owner/:bookingId/timeline', walkerController.getTimelineData);

module.exports = router;