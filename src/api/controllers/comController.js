const comService = require('../services/comService');

class ComController {
  
  async getMessages(req, res) {
    try {
      const { bookingId } = req.params;
      const userId = req.user.uid;

      const messages = await comService.getMessages(bookingId, userId);
      return res.status(200).json({ success: true, data: messages });
    } catch (error) {
      return res.status(error.status || 500).json({ 
        success: false, 
        message: error.message || 'Internal Server Error' 
      });
    }
  }

  async sendMessage(req, res) {
    try {
      const { bookingId } = req.params;
      const { text } = req.body;
      const userId = req.user.uid;

      if (!text || text.trim() === '') {
        return res.status(400).json({ success: false, message: 'Message text cannot be empty' });
      }

      const message = await comService.sendMessage(bookingId, userId, text);
      return res.status(201).json({ success: true, data: message });
    } catch (error) {
      return res.status(error.status || 500).json({ 
        success: false, 
        message: error.message || 'Internal Server Error' 
      });
    }
  }

  async getCallToken(req, res) {
    try {
      const { bookingId } = req.params;
      const userId = req.user.uid;

      const callData = await comService.getCallToken(bookingId, userId);
      return res.status(200).json({ success: true, data: callData });
    } catch (error) {
      return res.status(error.status || 500).json({ 
        success: false, 
        message: error.message || 'Internal Server Error' 
      });
    }
  }

  /**
   * 🛑 Route to manually end a call via frontend interaction
   * POST /api/com/:bookingId/call/end
   */
  async endCall(req, res) {
    try {
      const { bookingId } = req.params;
      const userId = req.user.uid;

      const result = await comService.endCallRoom(bookingId, userId);
      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return res.status(error.status || 500).json({ 
        success: false, 
        message: error.message || 'Failed to end call session cleanly' 
      });
    }
  }

  /**
   * 🪝 Automated Webhook receiver linked to Daily Dashboard.
   * Useful if participants just close their browser tabs without clicking hangup.
   * POST /api/com/webhooks/daily
   */
  async handleDailyWebhook(req, res) {
    try {
      const eventType = req.body?.event;
      const roomName = req.body?.payload?.room;

      console.log(`Received Daily Webhook Event: [${eventType}] for Room: ${roomName}`);

      if (eventType === 'meeting.ended') {
        // Extract original booking context ID out of string label template "booking-XXXXX"
        const bookingId = roomName.replace('booking-', '');
        
        console.log(`✅ System Notice: Video meeting session finalized for booking reference: ${bookingId}.`);
        
        // Put any optional post-call cleanup actions here (e.g. tracking length, notifying users, etc.)
      }

      return res.status(200).json({ received: true });
    } catch (error) {
      console.error('Webhook payload parsing error:', error.message);
      return res.status(200).json({ received: false }); // Always send 200 back to Daily webhooks to keep line alive
    }
  }
}

module.exports = new ComController();