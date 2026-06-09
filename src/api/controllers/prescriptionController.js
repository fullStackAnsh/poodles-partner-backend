// src/api/controllers/prescriptionController.js
const prescriptionService = require('../services/prescriptionService');

exports.createPrescription = async (req, res, next) => {
  try {
    const vetUid = req.user.uid; // Pulled from JWT inside authentication middleware
    const prescriptionData = { ...req.body, vetUid };

    // Basic Validation Check
    if (!prescriptionData.bookingId || !prescriptionData.petOwnerUid || !prescriptionData.diagnosis) {
      return res.status(400).json({ success: false, message: "Missing required core prescription fields." });
    }

    const result = await prescriptionService.createAndUploadPrescription(prescriptionData);
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.getPrescriptionById = async (req, res, next) => {
  try {
    const { prescriptionId } = req.params;
    const prescription = await prescriptionService.fetchPrescriptionById(prescriptionId);
    
    if (!prescription) {
      return res.status(404).json({ success: false, message: "Prescription record not found." });
    }
    return res.status(200).json({ success: true, data: prescription });
  } catch (error) {
    next(error);
  }
};

exports.sendPrescriptionToOwner = async (req, res, next) => {
  try {
    const { prescriptionId } = req.params;
    const updateResult = await prescriptionService.dispatchPrescription(prescriptionId);
    return res.status(200).json({ 
      success: true, 
      message: "Prescription successfully dispatched via WhatsApp and Email (Mailroo).",
      data: updateResult 
    });
  } catch (error) {
    next(error);
  }
};

exports.listVetPrescriptions = async (req, res, next) => {
  try {
    const vetUid = req.user.uid;
    const list = await prescriptionService.fetchPrescriptionsByVet(vetUid);
    return res.status(200).json({ success: true, data: list });
  } catch (error) {
    next(error);
  }
};