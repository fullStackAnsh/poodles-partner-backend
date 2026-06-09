// src/config/supabase.js
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const rootEnvPath = path.resolve(__dirname, '../../.env');
require('dotenv').config({ path: rootEnvPath });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ CRITICAL INITIALIZATION ERROR: Keys missing.");
  process.exit(1); 
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 🏗️ FORCE CACHE REFRESH & VERIFY BUCKET PROGRAMMATICALLY
(async () => {
  try {
    const targetBucket = 'poodles-pdf';
    
    // 1. Fetch current live list from the API schema layer
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error("❌ [Supabase Config] Failed to access storage service:", listError.message);
      return;
    }

    const bucketExists = buckets.some(b => b.name === targetBucket);

    if (!bucketExists) {
      console.log(`\n⚙️ [Supabase Config] "${targetBucket}" not found in API cache list. Creating it now...`);
      
      // 2. Programmatically force create the bucket via administrative client
      const { data, error: createError } = await supabase.storage.createBucket(targetBucket, {
        public: true, // Forces public access schema setup
        allowedMimeTypes: ['application/pdf'],
        fileSizeLimit: 5242880 // 5MB limit safety cap
      });

      if (createError) {
        console.error(`❌ [Supabase Config] Auto-creation failed: ${createError.message}`);
      } else {
        console.log(`✅ [Supabase Config] "${targetBucket}" successfully created and synchronized over API!`);
      }
    } else {
      console.log(`\n⚡ [Supabase Config] Storage handshake clean. Verified target bucket: "${targetBucket}"`);
    }
  } catch (err) {
    console.error("⚠️ [Supabase Config] Sync process error:", err.message);
  }
})();

module.exports = { supabase };