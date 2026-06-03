const admin = require('firebase-admin');
const axios = require('axios');

const db = admin.firestore();
const DAILY_API_KEY = process.env.DAILY_API_KEY;

class ComService {
  
  async getValidatedBooking(bookingId, userId) {
    const bookingRef = db.collection('bookings').doc(bookingId);
    const bookingDoc = await bookingRef.get();

    if (!bookingDoc.exists) {
      const error = new Error('Booking not found');
      error.status = 404;
      throw error;
    }

    const bookingData = bookingDoc.data();

    if (bookingData.partnerUid !== userId && bookingData.petOwnerUid !== userId) {
      const error = new Error('Unauthorized access to this booking channel');
      error.status = 403;
      throw error;
    }

    const allowedStatuses = ['confirmed', 'in_progress'];
    if (!allowedStatuses.includes(bookingData.status)) {
      const error = new Error('Chat and calling features are only accessible on active bookings');
      error.status = 403;
      throw error;
    }

    return { bookingRef, bookingData };
  }

  async getMessages(bookingId, userId) {
    await this.getValidatedBooking(bookingId, userId);

    const messagesSnapshot = await db
      .collection('bookings')
      .doc(bookingId)
      .collection('messages')
      .orderBy('createdAt', 'asc')
      .get();

    const messages = [];
    messagesSnapshot.forEach(doc => {
      messages.push({ id: doc.id, ...doc.data() });
    });

    return messages;
  }

  async sendMessage(bookingId, userId, messageText) {
    const { bookingData } = await this.getValidatedBooking(bookingId, userId);
    const senderRole = bookingData.partnerUid === userId ? 'partner' : 'pet_owner';

    const newMessage = {
      senderUid: userId,
      senderRole: senderRole,
      text: messageText,
      readAt: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const messageRef = await db
      .collection('bookings')
      .doc(bookingId)
      .collection('messages')
      .add(newMessage);

    return { 
      id: messageRef.id, 
      ...newMessage, 
      createdAt: new Date().toISOString() 
    };
  }

  /**
   * 📞 Securely ensures a Daily room exists and issues an entry token
   */
  async getCallToken(bookingId, userId) {
    const { bookingData } = await this.getValidatedBooking(bookingId, userId);
    const roomName = `booking-${bookingId}`;
    const senderRole = bookingData.partnerUid === userId ? 'partner' : 'pet_owner';

    let roomUrl = `https://${process.env.DAILY_DOMAIN}/${roomName}`;

    // 1️⃣ Step One: Proactively ensure the room is registered on Daily's cloud infrastructure
    try {
      await axios.post(
        'https://api.daily.co/v1/rooms',
        {
          name: roomName,
          privacy: 'private',
          properties: {
            exp: Math.floor(Date.now() / 1000) + 86400, // Room self-destructs after 24 hrs
            enable_chat: false
          }
        },
        {
          headers: { Authorization: `Bearer ${DAILY_API_KEY}` }
        }
      );
    } catch (roomError) {
      // Status code 400 with a naming collision means the room is already active and safe to use
      if (roomError.response?.status !== 400) {
        console.error('Failed to provision Daily room:', roomError.response?.data || roomError.message);
        throw new Error('Failed to configure video conference room environment');
      }
    }

    // 2️⃣ Step Two: Issue a short-lived secure meeting entry token
    try {
      const tokenResponse = await axios.post(
        'https://api.daily.co/v1/meeting-tokens',
        {
          properties: {
            room_name: roomName,
            user_name: senderRole === 'partner' ? 'Partner' : 'Pet Owner',
            exp: Math.floor(Date.now() / 1000) + 3600, // Valid for 1 hour
            is_owner: true 
          }
        },
        {
          headers: { Authorization: `Bearer ${DAILY_API_KEY}` }
        }
      );

      return {
        token: tokenResponse.data.token,
        roomUrl: roomUrl
      };
    } catch (error) {
      console.error('Daily.co API Error:', error.response?.data || error.message);
      const err = new Error('Failed to generate VoIP token');
      err.status = 500;
      throw err;
    }
  }

  /**
   * 🛑 Forcefully closes an active room session and removes participants
   */
  async endCallRoom(bookingId, userId) {
    // Validate permission ownership before deleting infrastructure
    await this.getValidatedBooking(bookingId, userId);
    const roomName = `booking-${bookingId}`;

    try {
      // Delete the room entirely from Daily.co, instantly disconnecting active pipelines
      await axios.delete(`https://api.daily.co/v1/rooms/${roomName}`, {
        headers: { Authorization: `Bearer ${DAILY_API_KEY}` }
      });
      return { roomName, status: 'destroyed' };
    } catch (error) {
      // If the room was already deleted, ignore the error and treat it as success
      if (error.response?.status === 404) {
        return { roomName, status: 'already_inactive' };
      }
      console.error('Daily.co Delete Error:', error.response?.data || error.message);
      const err = new Error('Failed to close video room cleanly');
      err.status = 500;
      throw err;
    }
  }
}

module.exports = new ComService();