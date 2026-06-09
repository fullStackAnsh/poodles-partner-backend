require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { db } = require('./src/config/firebase');
const vetPrescriptionRoutes = require('./src/api/routes/vetPrescriptionRoutes');

const bookingRoutes = require('./src/api/routes/bookingRoutes');
const queueRoutes = require('./src/queues/bookingQueue');
const partnerRoutes = require('./src/api/routes/partnerRoutes');
const availabilityRoutes = require('./src/api/routes/availabilityRoutes'); 
const walkerRoutes = require('./src/api/routes/walkerRoutes'); 
const comRoutes = require('./src/api/routes/comRoutes'); // Added communication routes

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.ALLOWED_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Distinct base paths
app.use('/api/partner', partnerRoutes);                     // Profile & Verification
app.use('/api/partner/availability', availabilityRoutes);   // All Scheduling Actions
app.use('/api/booking', bookingRoutes);
app.use('/api/queues', queueRoutes);
app.use('/api/com', comRoutes);       
app.use('/api/vet/prescription', vetPrescriptionRoutes);  
app.use('/api/walker', walkerRoutes);                    // Active Chat & VoIP calls

app.get('/health', (req, res) => res.status(200).json({ status: 'healthy', timestamp: new Date() }));
app.use((req, res) => res.status(404).json({ success: false, message: 'API Route not found.' }));

app.use((err, req, res, next) => {
  res.status(400).json({ success: false, error: err.message || 'Operational error.' });
});

app.listen(PORT, () => console.log(`🚀 Poodles Server active on port: ${PORT}`));