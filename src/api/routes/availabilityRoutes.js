// src/api/routes/availabilityRoutes.js
const express = require('express');
const router = express.Router();
const AvailabilityController = require('../controllers/AvailabilityController');
const { verifyToken, partnerMiddleware } = require('../middleware/partnerMiddleware');

// Universal security guard for all availability manipulations
router.use(verifyToken, partnerMiddleware);

// Core Slot Operations
router.get('/', AvailabilityController.getWeeklySlots);               // GET /api/partner/availability
router.post('/slot', AvailabilityController.createSlot);              // POST /api/partner/availability/slot
router.put('/slot/:slotId', AvailabilityController.updateSlot);        // PUT /api/partner/availability/slot/:slotId
router.delete('/slot/:slotId', AvailabilityController.deleteSlot);     // DELETE /api/partner/availability/slot/:slotId

// Batch Scheduling & Unavailability Blocks
router.post('/recurring', AvailabilityController.setRecurringSchedule);  // POST /api/partner/availability/recurring
router.post('/block', AvailabilityController.blockDate);              // POST /api/partner/availability/block
router.delete('/block/:blockId', AvailabilityController.removeBlock);  // DELETE /api/partner/availability/block/:blockId

module.exports = router;