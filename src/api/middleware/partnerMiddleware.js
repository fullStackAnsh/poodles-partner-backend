// src/api/middleware/partnerMiddleware.js
const jwt = require('jsonwebtoken');

/**
 * 1. Primary Security Gate: Validates the incoming JWT access token
 */
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      success: false, 
      message: "Access Denied: No authentication token provided." 
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Decode and verify signature against our local system secret
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = decoded; // Stash decoded info (uid, role, partnerType) into the request context
    next();
  } catch (error) {
    let errorMessage = "Invalid or expired session token.";
    if (error.name === 'TokenExpiredError') {
      errorMessage = "Authentication token has expired. Please refresh your session.";
    }
    return res.status(401).json({ success: false, message: errorMessage });
  }
};

/**
 * 2. Role Enforcement Gate: Ensures the user has a "partner" profile classification
 */
const partnerMiddleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: "Unauthorized: Missing authentication credentials." 
    });
  }

  if (req.user.role !== 'partner') {
    return res.status(403).json({ 
      success: false, 
      message: "Forbidden: Access restricted to service partners only." 
    });
  }

  next();
};

/**
 * 3. Specific Feature Guard: Restricts route block access strictly to veterinarians
 */
const vetGuard = (req, res, next) => {
  if (!req.user || req.user.partnerType !== 'vet') {
    return res.status(403).json({ 
      success: false, 
      message: "Forbidden: Access restricted to verified veterinary profiles." 
    });
  }
  next();
};

// Export all three layers out together
module.exports = { verifyToken, partnerMiddleware, vetGuard };