// src/api/controllers/walkerController.js
const walkerService = require('../services/walkerService');

exports.updateSettings = async (req, res, next) => {
  try {
    const partnerId = req.user.uid; // Retrieved from verifyToken middleware context
    const { maxCapacityPerSlot } = req.body;
    
    if (!maxCapacityPerSlot) throw new Error("Missing maxCapacityPerSlot payload attribute.");
    
    const result = await walkerService.updateSettings(partnerId, parseInt(maxCapacityPerSlot));
    res.status(200).json({ success: true, data: result });
  } catch (error) { next(error); }
};

exports.getUpcomingSlots = async (req, res, next) => {
  try {
    const partnerId = req.user.uid;
    const data = await walkerService.getUpcomingSlots(partnerId);
    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) { next(error); }
};

// src/api/controllers/walkerController.js

// ... (keep all your existing exports intact)

exports.getWalkSessionDetails = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    
    if (!bookingId) {
      return res.status(400).json({ success: false, message: "Missing required bookingId parameter." });
    }

    const result = await walkerService.getWalkSessionDetails(bookingId);
    
    if (!result) {
      return res.status(404).json({ 
        success: false, 
        message: "No walk session metadata found for the specified booking identifier." 
      });
    }

    return res.status(200).json({ 
      success: true, 
      data: result 
    });
  } catch (error) { 
    next(error); 
  }
};

exports.startWalkSlot = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const result = await walkerService.startWalkSlot(bookingId);
    res.status(200).json({ success: true, message: "Walk session tracking active.", data: result });
  } catch (error) { next(error); }
};

exports.pingLocation = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const { latitude, longitude } = req.body;
    
    if (!latitude || !longitude) throw new Error("Latitude and Longitude values are required.");
    
    const result = await walkerService.pingLocation(sessionId, parseFloat(latitude), parseFloat(longitude));
    res.status(200).json({ success: true, data: result });
  } catch (error) { next(error); }
};

exports.endWalkSlot = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const result = await walkerService.endWalkSlot(sessionId);
    res.status(200).json({ success: true, message: "Walk processing finalized.", data: result });
  } catch (error) { next(error); }
};

exports.uploadWalkPhoto = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    // Dummy static target layout string (Mocking Cloudinary upload payload result)
    const mockFileUrl = req.body.photoUrl || "https://cdn.yourdomain.com/walks/sample_pet.jpg";
    
    const result = await walkerService.addWalkPhoto(sessionId, mockFileUrl);
    res.status(201).json({ success: true, message: "Photo linked onto walk tracking file successfully.", data: result });
  } catch (error) { next(error); }
};

exports.getLiveTrackingData = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const result = await walkerService.getLiveTrackingData(bookingId);
    
    if (!result) return res.status(404).json({ success: false, message: "No active walking telemetry found for booking item." });
    res.status(200).json({ success: true, data: result });
  } catch (error) { next(error); }
};

exports.getTimelineData = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const result = await walkerService.getTimelineData(bookingId);
    
    if (!result) return res.status(404).json({ success: false, message: "No history context matches selection." });
    res.status(200).json({ success: true, data: result });
  } catch (error) { next(error); }
};