const { db } = require('../../config/firebase');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

class PartnerService {
  /**
   * Helper: Generates a secure, 6-digit numeric OTP string
   */
  generateNumericOtp() {
    return Math.floor(100000 + crypto.randomInt(900000)).toString();
  }

  /**
   * Dispatches or simulates an OTP verification challenge
   */
  async dispatchOtp(identity) {
    const cleanIdentity = identity.trim().toLowerCase();
    const generatedOtp = this.generateNumericOtp();
    
    const expiryWindow = 10 * 60 * 1000; // 10 minutes validation life
    const expiresAt = new Date(Date.now() + expiryWindow);

    await db.collection('otps').doc(cleanIdentity).set({
      otp: generatedOtp,
      expiresAt: expiresAt,
      attempts: 0,
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log(`\n============== [DEV OTP MONITOR] ==============`);
      console.log(`Target: ${cleanIdentity}`);
      console.log(`Your Verification Code is: ${generatedOtp}`);
      console.log(`Expires At: ${expiresAt.toISOString()}`);
      console.log(`================================================\n`);
    }

    return true;
  }

  /**
   * Validates OTP inputs and registers or logs in the partner context
   */
  async validateOtpAndBuildTokens(identity, userSubmittedOtp, signupData = null) {
    const cleanIdentity = identity.trim().toLowerCase();
    
    console.log("=== Debug Step 1: Checking OTP document ===");
    const otpRef = db.collection('otps').doc(cleanIdentity);
    const otpDoc = await otpRef.get();

    if (!otpDoc.exists) {
      const error = new Error("No active verification request found for this account.");
      error.statusCode = 400;
      throw error;
    }

    const { otp, expiresAt, attempts } = otpDoc.data();

    if (new Date() > expiresAt.toDate()) {
      await otpRef.delete();
      const error = new Error("Verification code has expired. Please request a new one.");
      error.statusCode = 400;
      throw error;
    }

    if (otp !== userSubmittedOtp) {
      await otpRef.update({ attempts: attempts + 1 });
      const error = new Error("Invalid verification OTP code.");
      error.statusCode = 401;
      throw error;
    }

    console.log("=== Debug Step 2: OTP successfully matched ===");

    let userUid;
    let targetRole = 'partner';
    let partnerType = signupData?.partnerType || 'groomer';

    try {
      console.log(`=== Debug Step 3: Querying users collection for email: ${cleanIdentity} ===`);
      const usersQuery = await db.collection('users').where('email', '==', cleanIdentity).get();
      const userExists = !usersQuery.empty;

      if (signupData && userExists) {
        const error = new Error("This email address is already registered. Please log in instead.");
        error.statusCode = 400;
        throw error;
      }

      if (!signupData && !userExists) {
        const error = new Error("This email is not registered. Please complete the signup form first.");
        error.statusCode = 400;
        throw error;
      }

      if (!userExists) {
        console.log("=== Debug Step 4: Provisioning new user registration architecture ===");
        
        const newUserRef = db.collection('users').doc(); 
        userUid = newUserRef.id;

        console.log(`=== Debug Step 5: Writing to users collection with clean ID: ${userUid} ===`);
        await newUserRef.set({
          username: signupData.username,
          email: cleanIdentity,
          role: 'partner',
          createdAt: new Date()
        });

        console.log(`=== Debug Step 6: Writing to partners collection ===`);
        await db.collection('partners').doc(userUid).set({
          uid: userUid,
          displayName: signupData.username,
          partnerType: partnerType,
          serviceDescription: '',
          status: 'inactive', // Becomes 'active' upon onboarding completion
          rating: 5.0,
          totalBookings: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        });

      } else {
        console.log("=== Debug Step 4 (Alt): Existing User Found. Running Login Workflow ===");
        const userDoc = usersQuery.docs[0];
        userUid = userDoc.id;
        targetRole = userDoc.data().role || 'partner';

        const partnerDoc = await db.collection('partners').doc(userUid).get();
        if (partnerDoc.exists) {
          partnerType = partnerDoc.data().partnerType || partnerType;
        }
      }
    } catch (dbError) {
      if (dbError.statusCode) throw dbError;
      console.error("🔥 CRITICAL FIRESTORE ERROR:", dbError);
      throw new Error(`Database Operation Failed: ${dbError.message}`);
    }

    await otpRef.delete();

    const jti = crypto.randomUUID(); 
    
    const accessTokenPayload = {
      uid: userUid,
      jti: jti,
      role: targetRole,
      partnerType: partnerType
    };

    const accessToken = jwt.sign(
      accessTokenPayload, 
      process.env.JWT_ACCESS_SECRET, 
      { expiresIn: '30m' }
    );

    const refreshToken = jwt.sign(
      { uid: userUid, jti: jti }, 
      process.env.JWT_REFRESH_SECRET, 
      { expiresIn: '7d' }
    );

    return {
      accessToken,
      refreshToken,
      partnerSummary: {
        uid: userUid,
        email: cleanIdentity,
        role: targetRole,
        partnerType: partnerType
      }
    };
  }

  /**
   * Complete Partner Onboarding Form Submission Step
   */
  async completePartnerOnboarding(uid, onboardingData) {
    const partnerRef = db.collection('partners').doc(uid);
    const doc = await partnerRef.get();

    if (!doc.exists) {
      const error = new Error("Partner configuration document reference not found.");
      error.statusCode = 404;
      throw error;
    }

    const currentData = doc.data();
    const resolvedType = currentData.partnerType || onboardingData.partnerType;

    // Validate unique veterinary license parameter values across matching instances
    if (resolvedType === 'vet' && onboardingData.licenseNumber) {
      const existingVet = await db.collection('partners')
        .where('licenseNumber', '==', onboardingData.licenseNumber)
        .limit(1)
        .get();
      
      if (!existingVet.empty && existingVet.docs[0].id !== uid) {
        const error = new Error("A veterinary profile with this clinical license number already exists.");
        error.statusCode = 409;
        throw error;
      }
    }

    const completedProfile = {
      displayName: onboardingData.displayName || currentData.displayName,
      serviceDescription: onboardingData.serviceDescription,
      serviceArea: {
        city: onboardingData.serviceArea.city,
        locality: onboardingData.serviceArea.locality,
        lat: parseFloat(onboardingData.serviceArea.lat),
        lng: parseFloat(onboardingData.serviceArea.lng)
      },
      pricing: {
        basePrice: parseFloat(onboardingData.pricing.basePrice),
        currency: onboardingData.pricing.currency || 'INR',
        services: onboardingData.pricing.services || [] // For groomer catalog packages / custom add-ons
      },
      profilePhoto: onboardingData.profilePhoto || '',
      specializations: onboardingData.specializations || [],
      licenseNumber: resolvedType === 'vet' ? onboardingData.licenseNumber : null,
      status: 'active', // Set active following successful wizard mapping
      fcmToken: onboardingData.fcmToken || null,
      updatedAt: new Date()
    };

    await partnerRef.update(completedProfile);
    const updatedDoc = await partnerRef.get();
    return updatedDoc.data();
  }

  /**
   * Fetches the unique profile doc out of Firestore
   */
  async fetchProfileByUid(uid) {
    const doc = await db.collection('partners').doc(uid).get();
    if (!doc.exists) return null;
    return doc.data();
  }

  /**
   * Updates core descriptive metadata rules selectively
   */
  async updatePartnerFields(uid, patchData) {
    const partnerRef = db.collection('partners').doc(uid);
    
    const cleanUpdate = {};
    const allowedFields = ['displayName', 'serviceDescription', 'serviceArea', 'pricing', 'specializations', 'licenseNumber'];
    
    allowedFields.forEach(field => {
      if (patchData[field] !== undefined) {
        cleanUpdate[field] = patchData[field];
      }
    });

    cleanUpdate.updatedAt = new Date();
    await partnerRef.update(cleanUpdate);
    const updatedDoc = await partnerRef.get();
    return updatedDoc.data();
  }

  /**
   * Updates only profile photo string reference asset URL
   */
  async updatePhotoUrl(uid, photoUrl) {
    const partnerRef = db.collection('partners').doc(uid);
    await partnerRef.update({
      profilePhoto: photoUrl,
      updatedAt: new Date()
    });
    return { profilePhoto: photoUrl };
  }

  /**
   * Toggles partner system online visibility state status
   */
  async updatePartnerStatus(uid, newStatus) {
    if (!['active', 'inactive', 'suspended'].includes(newStatus)) {
      const error = new Error("Invalid system state status context provided.");
      error.statusCode = 400;
      throw error;
    }
    const partnerRef = db.collection('partners').doc(uid);
    await partnerRef.update({
      status: newStatus,
      updatedAt: new Date()
    });
    return { status: newStatus };
  }
}

module.exports = new PartnerService();