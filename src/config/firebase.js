// src/config/firebase.js
const admin = require('firebase-admin');
const path = require('path');

// Dynamically reference the downloaded credentials key file
const serviceAccount = require(path.join(__dirname, 'firebase-service-account.json'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('🔥 Firebase Admin successfully initialized.');
}

const db = admin.firestore();

module.exports = { db, admin };