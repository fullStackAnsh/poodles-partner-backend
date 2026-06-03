// src/services/BookingQueueService.js
const redis = require('../../config/redis');
const { Client } = require('@upstash/qstash');

const qstashClient = new Client({ token: process.env.QSTASH_TOKEN });

class BookingQueueService {
  async enqueueBooking(bookingDetails) {
    const queueKey = `booking_queue:${bookingDetails.serviceType}`;
    
    // 1. Push payload metadata onto Redis List
    await redis.rpush(queueKey, JSON.stringify(bookingDetails));

    // 2. Trigger QStash Worker Webhook asynchronously
    await qstashClient.publishJSON({
      url: `${process.env.APP_BASE_URL}/api/queues/booking-worker`,
      body: { serviceType: bookingDetails.serviceType },
      delay: 0, // Process immediately
    });

    return { success: true, message: 'Booking queued and worker signaled' };
  }
}

module.exports = new BookingQueueService();