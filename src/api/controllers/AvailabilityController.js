// src/api/controllers/AvailabilityController.js
const AvailabilityService = require('../services/AvailabilityService');

class AvailabilityController {
  
  async createSlot(req, res, next) {
    try {
      const slot = await AvailabilityService.createSlot(req.user.uid, req.body);
      return res.status(201).json({ success: true, data: slot });
    } catch (error) { next(error); }
  }

  async getWeeklySlots(req, res, next) {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) throw new Error("Missing query parameters: startDate and endDate are required.");
      const slots = await AvailabilityService.getWeeklySlots(req.user.uid, startDate, endDate);
      return res.status(200).json({ success: true, data: slots });
    } catch (error) { next(error); }
  }

  async updateSlot(req, res, next) {
    try {
      const slot = await AvailabilityService.updateSlot(req.user.uid, req.params.slotId, req.body);
      return res.status(200).json({ success: true, data: slot });
    } catch (error) { next(error); }
  }

  async deleteSlot(req, res, next) {
    try {
      await AvailabilityService.deleteSlot(req.user.uid, req.params.slotId);
      return res.status(200).json({ success: true, message: "Slot successfully purged." });
    } catch (error) { next(error); }
  }

  async blockDate(req, res, next) {
    try {
      const result = await AvailabilityService.blockDate(req.user.uid, req.body.date);
      return res.status(201).json({ success: true, data: result });
    } catch (error) { next(error); }
  }

  async removeBlock(req, res, next) {
    try {
      const result = await AvailabilityService.removeBlock(req.user.uid, req.params.blockId);
      return res.status(200).json({ success: true, message: result.message });
    } catch (error) { next(error); }
  }

  async setRecurringSchedule(req, res, next) {
    try {
      const result = await AvailabilityService.setRecurringSchedule(req.user.uid, req.body);
      return res.status(200).json({ success: true, data: result });
    } catch (error) { next(error); }
  }
}

module.exports = new AvailabilityController();