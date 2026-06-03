const express = require('express');
const router = express.Router();
const PartnerController = require('../controllers/PartnerController');

// Pull necessary guards right from partnerMiddleware!
const { verifyToken, partnerMiddleware } = require('../middleware/partnerMiddleware'); 

// Public / Core Auth Actions (No tokens needed here)
router.post('/auth/send-otp', PartnerController.sendOtp);
router.post('/auth/verify-otp', PartnerController.verifyOtp);

// Protected Partner Profile & Dashboard Operations (Require token verification and partner authorization)
router.post('/profile', verifyToken, partnerMiddleware, PartnerController.createOnboardingProfile);
router.get('/profile', verifyToken, partnerMiddleware, PartnerController.getProfile);
router.put('/profile', verifyToken, partnerMiddleware, PartnerController.updateProfile);
router.put('/profile/photo', verifyToken, partnerMiddleware, PartnerController.updateProfilePhoto);
router.put('/status', verifyToken, partnerMiddleware, PartnerController.toggleStatus);

module.exports = router;