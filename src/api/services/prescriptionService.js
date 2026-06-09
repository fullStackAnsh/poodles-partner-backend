// src/api/services/prescriptionService.js
const { db } = require('../../config/firebase'); 
const admin = require('firebase-admin');
const PDFDocument = require('pdfkit');
const { supabase } = require('../../config/supabase'); 
const axios = require('axios'); // Added axios for WhatsApp API execution



/**
 * Generates an in-memory buffered PDF styling the Poodles Pet Care template
 */
const generatePrescriptionPDFBuffer = (id, data) => {
  return new Promise((resolve, reject) => {
    console.log(`\n📄 [PDF Generation] Starting PDF generation for Rx ID: ${id}`);
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    let buffers = [];
    
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => {
      const finalBuffer = Buffer.concat(buffers);
      console.log(`✅ [PDF Generation] PDF compilation successful. Buffer size: ${finalBuffer.length} bytes`);
      resolve(finalBuffer);
    });
    doc.on('error', (err) => {
      console.error(`❌ [PDF Generation] Error stream crashed during rendering:`, err.message);
      reject(err);
    });

    // --- Header Banner Box ---
    doc.rect(35, 35, 525, 60).fill('#F3F4F6');
    doc.fillColor('#111827').fontSize(20).text('POODLES PET CARE', 40, 45, { align: 'center', weight: 'bold' });
    doc.fontSize(12).fillColor('#4B5563').text('VETERINARY PRESCRIPTION', 40, 70, { align: 'center' });
    doc.moveDown(1.5);

    // --- Vet Metadata Info row ---
    const topY = 110;
    doc.fillColor('#111827').fontSize(11).text(`Dr. ${data.vetName || 'Veterinarian'}`, 40, topY);
    doc.text(`License: ${data.vetLicense || 'N/A'}`, 40, topY + 15);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 400, topY);
    doc.text(`Rx ID: ${id}`, 400, topY + 15);

    // Divider Line
    doc.moveTo(35, topY + 40).lineTo(560, topY + 40).strokeColor('#E5E7EB').stroke();

    // --- Patient Details section ---
    doc.fontSize(12).fillColor('#111827').text('PATIENT DETAILS', 40, topY + 55, { underline: true });
    doc.fontSize(10).text(`Patient: ${data.petName || 'N/A'}`, 40, topY + 75);
    doc.text(`Owner ID: ${data.petOwnerUid || 'N/A'}`, 40, topY + 90);

    // --- Diagnosis Section ---
    doc.fontSize(12).text('DIAGNOSIS', 40, topY + 120, { underline: true });
    doc.fontSize(10).fillColor('#374151').text(data.diagnosis, 40, topY + 140, { width: 500 });

    // --- Medicines Section ---
    doc.fontSize(12).fillColor('#111827').text('MEDICINES (Rx)', 40, topY + 190, { underline: true });
    let currentY = topY + 210;

    if (Array.isArray(data.medicines) && data.medicines.length > 0) {
      data.medicines.forEach((med, index) => {
        doc.fontSize(10).fillColor('#111827').text(`${index + 1}. ${med.name || 'Medicine'} - ${med.dosage || ''} (${med.frequency || ''})`, 40, currentY);
        doc.fillColor('#6B7280').text(`   Duration: ${med.duration || 'N/A'} | Notes: ${med.instructions || 'None'}`, 40, currentY + 13);
        currentY += 35;
      });
    } else {
      doc.fontSize(10).fillColor('#9CA3AF').text('No dynamic prescriptions items recorded.', 40, currentY);
      currentY += 20;
    }

    // --- Bottom Instructions Section ---
    doc.moveTo(35, currentY + 10).lineTo(560, currentY + 10).strokeColor('#E5E7EB').stroke();
    doc.fontSize(11).fillColor('#111827').text('General Instructions:', 40, currentY + 25);
    doc.fontSize(10).fillColor('#4B5563').text(data.generalInstructions || 'None provided.', 40, currentY + 40, { width: 500 });

    if (data.followUpDate) {
      const followUpStr = new Date(data.followUpDate).toLocaleDateString();
      doc.fontSize(11).fillColor('#111827').text(`Follow-up Date: ${followUpStr}`, 40, currentY + 80);
    }

    // --- Footer Digital Signature ---
    doc.fontSize(10).fillColor('#111827').text(`Digital Signature: Dr. ${data.vetName || 'Veterinarian'}`, 40, 750);
    
    doc.end();
  });
};

/**
 * Service Methods
 */
exports.createAndUploadPrescription = async (payload) => {
  console.log("\n=======================================================");
  console.log("🚀 [Service] Triggered createAndUploadPrescription Method");
  console.log("📥 Incoming Data Payload:", JSON.stringify(payload, null, 2));

  let petOwnerUid = payload.petOwnerUid;
  let petProfileId = payload.petProfileId;
  let petName = payload.petName;

  // 🔍 RELATIONAL AUTO-RESOLUTION BLOCK
  if (payload.bookingId) {
    console.log(`🔍 [Firestore DB] Fetching reference booking: "${payload.bookingId}"`);
    try {
      const bookingDoc = await db.collection('bookings').doc(payload.bookingId).get();

      if (bookingDoc.exists) {
        const bookingData = bookingDoc.data();
        
        petOwnerUid = bookingData.petOwnerUid || petOwnerUid;
        petProfileId = bookingData.petProfileId || petProfileId;
        petName = bookingData.petName || petName;

        console.log(`✅ [Firestore DB] Auto-resolved from Booking -> Owner UID: "${petOwnerUid}", Pet Name: "${petName}"`);
      } else {
        console.warn(`⚠️ [Firestore DB] Booking ID "${payload.bookingId}" provided but not found. Falling back to explicit payload fields.`);
      }
    } catch (dbError) {
      console.error(`❌ [Firestore DB] Error reading bookings collection:`, dbError.message);
    }
  }

  const prescriptionRef = db.collection('prescriptions').doc(); 
  const prescriptionId = prescriptionRef.id;
  console.log(`🆔 Generated unique Firestore Prescription ID: ${prescriptionId}`);

  const pdfPayload = {
    ...payload,
    petOwnerUid,
    petProfileId,
    petName
  };

  const pdfBuffer = await generatePrescriptionPDFBuffer(prescriptionId, pdfPayload);

  const bucketName = 'poodles-pdf'; 
  const storagePath = `${prescriptionId}/${prescriptionId}.pdf`;

  console.log(`\n📤 [Supabase Storage] Initiating connection handshake...`);

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(storagePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true 
    });

  if (uploadError) {
    console.error(`❌ [Supabase Storage] UPLOAD FAILED! Reason:`, uploadError);
    throw new Error(`Supabase Storage Error: ${uploadError.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(storagePath);

  const pdfUrl = urlData.publicUrl;
  console.log(`🎯 [Supabase Storage] Generated Global Resource Link: ${pdfUrl}`);

  const docSchema = {
    bookingId: payload.bookingId || "",
    consultationId: payload.consultationId || "",
    vetUid: payload.vetUid || "test_vet_system_fallback", 
    vetName: payload.vetName || "Partner Vet",
    vetLicense: payload.vetLicense || "N/A",
    petOwnerUid: petOwnerUid || "N/A",      
    petProfileId: petProfileId || "",      
    petName: petName || "Patient",          
    diagnosis: payload.diagnosis,
    medicines: payload.medicines || [],
    generalInstructions: payload.generalInstructions || "",
    followUpDate: payload.followUpDate ? admin.firestore.Timestamp.fromDate(new Date(payload.followUpDate)) : null,
    pdfUrl: pdfUrl, 
    sentToOwner: false,
    sentAt: null,
    createdAt: admin.firestore.Timestamp.now()
  };

  console.log(`\n💾 [Firestore DB] Writing structured document profile data schema...`);
  await prescriptionRef.set(docSchema);
  console.log(`✅ [Firestore DB] Document record successfully finalized under ID reference.`);
  console.log("=======================================================\n");

  return { prescriptionId, ...docSchema };
};

exports.fetchPrescriptionById = async (id) => {
  console.log(`🔍 [Service] Fetching prescription record with ID: ${id}`);
  const doc = await db.collection('prescriptions').doc(id).get();
  if (!doc.exists) {
    console.log(`⚠️ [Service] Prescription record ${id} not found in Firestore.`);
    return null;
  }
  return { prescriptionId: doc.id, ...doc.data() };
};

exports.fetchPrescriptionsByVet = async (vetUid) => {
  const snapshot = await db.collection('prescriptions').where('vetUid', '==', vetUid).orderBy('createdAt', 'desc').get();
  let list = [];
  snapshot.forEach(doc => list.push({ prescriptionId: doc.id, ...doc.data() }));
  return list;
};

/**
 * Dispatches the digital prescription to the owner via official WhatsApp Cloud API
 */

exports.dispatchPrescription = async (id) => {
  console.log(`\n📢 [Service] 1/17. Dispatch execution requested for Prescription ID: ${id}`);
  
  if (!id) {
    console.error(`❌ [Service] Aborted. Input ID is completely null or undefined.`);
    throw new Error("Prescription ID argument missing.");
  }

  console.log(`🔍 [Firestore DB] 2/17. Creating document reference for prescription collection...`);
  const docRef = db.collection('prescriptions').doc(id);
  
  console.log(`🔍 [Firestore DB] 3/17. Executing asynchronous fetch read from 'prescriptions' collection...`);
  const doc = await docRef.get();
  
  console.log(`🔍 [Firestore DB] 4/17. Read finished. Checking if prescription document exists...`);
  if (!doc.exists) {
    console.error(`❌ [Service] Dispatch aborted. Target prescription record missing in Firestore.`);
    throw new Error("Target prescription record missing.");
  }
  
  const rxData = doc.data();
  console.log(`📦 [Data Extraction] 5/17. Prescription data successfully extracted.`);
  
  // 1. Resolve Pet Owner's phone number and email from users collection
  console.log(`❓ [Validation] 6/17. Verifying petOwnerUid presence... Current value: "${rxData.petOwnerUid}"`);
  if (!rxData.petOwnerUid || rxData.petOwnerUid === 'N/A') {
    console.error(`❌ [Validation Error] Aborted. No valid petOwnerUid assigned to this prescription.`);
    throw new Error("Cannot dispatch communication: No valid petOwnerUid assigned to this prescription.");
  }

  console.log(`🔍 [Firestore DB] 7/17. Fetching user profile document for UID: "${rxData.petOwnerUid}"`);
  const userDoc = await db.collection('users').doc(rxData.petOwnerUid).get();
  
  console.log(`🔍 [Firestore DB] 8/17. User read finished. Checking if profile document exists...`);
  if (!userDoc.exists) {
    console.error(`❌ [Database Error] Owner profile mapping completely missing for UID: ${rxData.petOwnerUid}`);
    throw new Error(`Owner profile mapping missing for UID: ${rxData.petOwnerUid}`);
  }
  
  const userData = userDoc.data();
  const rawPhone = userData.phone || userData.phoneNumber; 
  const targetEmail = userData.email; 
  
  console.log(`📱 [Data Extraction] 9/17. Contact attributes pulled -> Phone: "${rawPhone}" | Email: "${targetEmail || 'MISSING'}"`);
  
  if (!rawPhone) {
    console.error(`❌ [Validation Error] Target owner profile does not contain a valid contact phone string.`);
    throw new Error("Target owner profile does not contain a valid contact phone number.");
  }

  console.log(`⚙️ [Data Formatting] 10/17. Formatting raw phone string to strict numeric digits...`);
  const formattedPhone = rawPhone.replace(/\D/g, '');
  console.log(`📱 [Data Formatting] Cleaned phone output: "${formattedPhone}"`);

  // ==========================================
  // PHASE 1: TRANSMIT VIA WHATSAPP CLOUD API
  // ==========================================
  console.log(`🔒 [Env Setup] 11/17. Loading Meta system environment credentials...`);
  const accessToken = process.env.WHATSAPP_API;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID; 
  const graphApiVersion = 'v21.0'; 
  
  const whatsappUrl = `https://graph.facebook.com/${graphApiVersion}/${phoneNumberId}/messages`;
  
  const requestPayload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: formattedPhone,
    type: "template",
    template: {
      name: "prescription_delivery", 
      language: { code: "en_US" },
      components: [
        {
          type: "header",
          parameters: [
            {
              type: "document",
              document: {
                link: rxData.pdfUrl,
                filename: `Rx_Prescription_${rxData.petName || 'Pet'}.pdf`
              }
            }
          ]
        },
        {
          type: "body",
          parameters: [
            {
              type: "text",
              parameter_name: "pet_name",
              text: rxData.petName || "your pet" 
            }
          ]
        }
      ]
    }
  };

  console.log(`🚀 [WhatsApp API] 12/17. Initiating outbound HTTP POST request to Meta servers...`);
  try {
    const apiResponse = await axios.post(whatsappUrl, requestPayload, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });
    console.log(`✅ [WhatsApp API] 13/17. Dispatched successfully! Meta Msg ID:`, apiResponse.data.messages?.[0]?.id || 'No ID returned');
  } catch (apiError) {
    console.error(`❌ [WhatsApp API Error] Network transmission crashed during Axios execution.`);
    if (apiError.response) {
      console.error("🛑 Meta Cloud API Server responded with an error status:", apiError.response.status, JSON.stringify(apiError.response.data, null, 2));
    }
    throw new Error(`WhatsApp API transmission failed: ${apiError.message}`);
  }

  // ==========================================
  // PHASE 2: TRANSMIT VIA MAILEROO JSON API
  // ==========================================
  console.log(`✉️ [Maileroo API] 14/17. Initializing email pipeline validation...`);
  
  if (!targetEmail) {
    console.warn(`⚠️ [Maileroo Warning] Skipping email send: User profile does not have an email property.`);
  } else {
    console.log(`🔒 [Env Setup] Loading Maileroo raw API configuration context...`);
    
    const mailerooApiKey = process.env.MAILEROO_API_KEY;
    const fromAddress = process.env.MAILEROO_FROM_ADDRESS || "noreply@yourdomain.com";
    const fromName = process.env.MAILEROO_FROM_NAME || "Poodles Automation";

    // Direct Maileroo production endpoint v2 JSON payload structure
    const mailerooUrl = 'https://api.maileroo.com/v2/email/send';
    
    const emailPayload = {
      from: `${fromName} <${fromAddress}>`,
      to: targetEmail,
      subject: `Prescription Record updated for ${rxData.petName || 'your pet'}`,
      plain: `Hello,\n\nThe medical prescription copy for your pet, ${rxData.petName || 'your pet'}, is ready. You can download and view your full document copy here: ${rxData.pdfUrl}\n\nBest regards,\nPoodles Vet Team`,
      html: `<p>Hello,</p><p>The medical prescription copy for your pet, <strong>${rxData.petName || 'your pet'}</strong>, is ready.</p><p><a href="${rxData.pdfUrl}" style="display:inline-block; padding: 10px 15px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px;">Download Official Prescription PDF</a></p><p>Best regards,<br>Poodles Vet Team</p>`
    };

    console.log(`🚀 [Maileroo API] 15/17. Triggering outbound native HTTP POST to Maileroo API...`);
    try {
      const mailerooResponse = await axios.post(mailerooUrl, emailPayload, {
        headers: {
          'X-API-KEY': mailerooApiKey,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`✅ [Maileroo API] 16/17. Email delivery handshake clear! Maileroo Response:`, JSON.stringify(mailerooResponse.data));
    } catch (emailError) {
      console.error(`❌ [Maileroo API Error] Critical failure during transactional email distribution.`);
      if (emailError.response) {
        console.error(`🛑 Maileroo Dashboard Error: Status ${emailError.response.status}`, JSON.stringify(emailError.response.data, null, 2));
      } else {
        console.error(`🛑 Connection Error:`, emailError.message);
      }
    }
  }

  // ==========================================
  // PHASE 3: DATABASE STATUS UPDATE
  // ==========================================
  console.log(`📝 [Firestore DB] 17/17. Preparing to update local prescription document flags...`);
  const updates = {
    sentToOwner: true,
    sentAt: admin.firestore.Timestamp.now()
  };

  try {
    await docRef.update(updates);
    console.log(`✅ [Service] Success! All status flags safely committed to the database. Pipeline complete.`);
    return { success: true, ...updates };
  } catch (dbError) {
    console.error(`❌ [Database Error] Verification flags could not write back to document context:`, dbError.message);
    throw dbError;
  }
};