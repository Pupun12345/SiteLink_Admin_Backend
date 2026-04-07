const PlatformSettings = require('../models/PlatformSettings');

/**
 * Get current platform settings
 * @returns {Promise<Object>} Platform settings object
 */
const getPlatformSettings = async () => {
  try {
    const settings = await PlatformSettings.getOrCreateSettings();
    return settings;
  } catch (error) {
    console.error('Error getting platform settings:', error);
    // Return default settings if database fails
    return {
      notifications: {
        systemAlerts: true,
        subscriptionNotifications: true,
        userNotifications: false
      },
      verificationRules: {
        worker: {
          idProof: true,
          criminalBackgroundCheck: false,
          medicalCertificate: false
        },
        vendor: {
          gstTaxVerification: true,
          businessLicense: true,
          publicLiabilityInsurance: false
        }
      },
      language: 'English (United States)'
    };
  }
};

/**
 * Get verification rules for a specific user type
 * @param {string} userType - 'worker' or 'vendor'
 * @returns {Promise<Object>} Verification rules for the user type
 */
const getVerificationRules = async (userType) => {
  try {
    const settings = await getPlatformSettings();
    return settings.verificationRules[userType] || {};
  } catch (error) {
    console.error('Error getting verification rules:', error);
    return {};
  }
};

/**
 * Check if a document is required for a user type
 * @param {string} userType - 'worker' or 'vendor'
 * @param {string} documentType - Document type to check
 * @returns {Promise<boolean>} True if document is required
 */
const isDocumentRequired = async (userType, documentType) => {
  try {
    const rules = await getVerificationRules(userType);
    return rules[documentType] === true;
  } catch (error) {
    console.error('Error checking document requirement:', error);
    return false;
  }
};

/**
 * Validate required documents for user registration
 * @param {string} userType - 'worker' or 'vendor'
 * @param {Object} files - Uploaded files object
 * @param {Object} body - Request body
 * @returns {Promise<Object>} Validation result with success and message
 */
const validateRequiredDocuments = async (userType, files, body) => {
  try {
    const rules = await getVerificationRules(userType);
    const errors = [];

    if (userType === 'worker') {
      if (rules.idProof && (!files?.aadhaarFrontImage || !files?.aadhaarBackImage)) {
        errors.push('ID proof (Aadhaar front and back images) is required');
      }
      
      if (rules.medicalCertificate && !files?.medicalCertificate) {
        errors.push('Medical certificate is required');
      }
    }

    if (userType === 'vendor') {
      if (rules.gstTaxVerification && !body.gstNumber) {
        errors.push('GST number is required');
      }
      
      if (rules.businessLicense && !body.licenseNumber) {
        errors.push('Business license number is required');
      }
    }

    return {
      success: errors.length === 0,
      message: errors.length > 0 ? errors.join(', ') : 'All required documents provided',
      errors
    };
  } catch (error) {
    console.error('Error validating required documents:', error);
    return {
      success: false,
      message: 'Error validating documents',
      errors: ['Document validation failed']
    };
  }
};

module.exports = {
  getPlatformSettings,
  getVerificationRules,
  isDocumentRequired,
  validateRequiredDocuments
};