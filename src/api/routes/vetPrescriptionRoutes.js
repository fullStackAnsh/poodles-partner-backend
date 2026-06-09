// src/api/routes/vetPrescriptionRoutes.js
const express = require('express');
const router = express.Router();
const prescriptionController = require('../controllers/prescriptionController');
const { verifyToken, partnerMiddleware, vetGuard } = require('../middleware/partnerMiddleware');

// Protect all prescription routes for Vet Roles only
router.use(verifyToken);

router.post('/create', prescriptionController.createPrescription);
router.get('/:prescriptionId', prescriptionController.getPrescriptionById);
router.post('/:prescriptionId/send', prescriptionController.sendPrescriptionToOwner);
router.get('/', prescriptionController.listVetPrescriptions);

module.exports = router;