const PartnerService = require('../services/PartnerService');

class PartnerController {
  /**
   * Action: Generic OTP dispatcher
   */
  async sendOtp(req, res) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ success: false, message: "Email parameter is required to send code." });
      }

      await PartnerService.dispatchOtp(email);
      return res.status(200).json({ 
        success: true, 
        message: "A 6-digit authentication code has been generated and dispatched successfully." 
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Action: Core processing gate validating login credential states or provisioning new signups
   */
  async verifyOtp(req, res) {
    try {
      const { email, otp, signupData } = req.body; 

      if (!email || !otp) {
        return res.status(400).json({ success: false, message: "Missing email profile markers or verification code inputs." });
      }

      const session = await PartnerService.validateOtpAndBuildTokens(email, otp, signupData);

      res.cookie('refreshToken', session.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7-Day lifetime parameters
      });

      return res.status(200).json({
        success: true,
        message: "Authentication verification verified successfully.",
        accessToken: session.accessToken,
        partner: session.partnerSummary
      });

    } catch (error) {
      const responseStatus = error.statusCode || 401;
      return res.status(responseStatus).json({ 
        success: false, 
        message: error.message 
      });
    }
  }

  /**
   * Action: Complete Profile Onboarding Wizard Data
   */
  async createOnboardingProfile(req, res) {
    try {
      const { uid, partnerType } = req.user;
      const { displayName, serviceDescription, serviceArea, pricing } = req.body;

      if (!displayName || !serviceDescription || !serviceArea || !pricing) {
        return res.status(400).json({ success: false, message: "Mandatory profile parameters are missing." });
      }

      if (displayName.length > 50) {
        return res.status(400).json({ success: false, message: "Display name cannot exceed 50 characters." });
      }

      if (serviceDescription.length > 500) {
        return res.status(400).json({ success: false, message: "Service description cannot exceed 500 characters." });
      }

      if (partnerType === 'vet' && !req.body.licenseNumber) {
        return res.status(400).json({ success: false, message: "A veterinary license number is mandatory for your role profile." });
      }

      const profile = await PartnerService.completePartnerOnboarding(uid, req.body);
      return res.status(200).json({
        success: true,
        message: "Partner onboarding complete. Profile successfully registered.",
        data: profile
      });
    } catch (error) {
      const code = error.statusCode || 500;
      return res.status(code).json({ success: false, message: error.message });
    }
  }

  /**
   * Action: Fetches partner profile info out of DB instead of raw token context mapping
   */
  async getProfile(req, res) {
    try {
      const { uid } = req.user;
      const fullProfile = await PartnerService.fetchProfileByUid(uid);
      
      if (!fullProfile) {
        return res.status(404).json({ success: false, message: "Partner profile records could not be found." });
      }

      return res.status(200).json({
        success: true,
        message: "Profile data fetched successfully.",
        data: fullProfile
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Action: Structural update mutations
   */
  async updateProfile(req, res) {
    try {
      const { uid } = req.user;
      const updatedProfile = await PartnerService.updatePartnerFields(uid, req.body);
      return res.status(200).json({
        success: true,
        message: "Profile details updated successfully.",
        data: updatedProfile
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Action: Dedicated Image Storage URL updates
   */
  async updateProfilePhoto(req, res) {
    try {
      const { uid } = req.user;
      const { profilePhoto } = req.body;

      if (!profilePhoto) {
        return res.status(400).json({ success: false, message: "Missing target profile photo URL string representation asset." });
      }

      const result = await PartnerService.updatePhotoUrl(uid, profilePhoto);
      return res.status(200).json({
        success: true,
        message: "Profile portrait target reference updated successfully.",
        data: result
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Action: Toggle system status (Active/Inactive)
   */
  async toggleStatus(req, res) {
    try {
      const { uid } = req.user;
      const { status } = req.body;

      if (!status) {
        return res.status(400).json({ success: false, message: "Status target option field is required." });
      }

      const result = await PartnerService.updatePartnerStatus(uid, status);
      return res.status(200).json({
        success: true,
        message: "Partner functional availability toggled successfully.",
        data: result
      });
    } catch (error) {
      const code = error.statusCode || 500;
      return res.status(code).json({ success: false, message: error.message });
    }
  }
}

module.exports = new PartnerController();