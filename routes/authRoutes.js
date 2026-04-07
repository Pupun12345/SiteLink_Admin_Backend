const express = require('express');
const { body } = require('express-validator');
const upload = require('../middleware/upload');
const skillsReference = require('../models/SkillReference');
const {
  register,
  login,
  adminLogin,
  verifyOtp,
  resendOtp,
  forgotPassword,      
  verifyResetOtp,      
  resetPassword,
  logout,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('phone')
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Please provide a valid 10-digit phone number'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  body('confirmPassword')
    .notEmpty()
    .withMessage('Please confirm your password'),
  body('userType')
    .optional()
    .isIn(['customer', 'vendor', 'worker'])
    .withMessage('User type must be customer, vendor, or worker'),
  // Worker-specific fields (optional)
  body('city')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('City cannot be empty'),
  body('dailyRate')
    .optional()
    .isNumeric()
    .withMessage('Daily rate must be a number')
    .isFloat({ min: 0 })
    .withMessage('Daily rate cannot be negative'),
  body('aadhaarNumber')
    .optional()
    .matches(/^\d{12}$/)
    .withMessage('Aadhaar number must be 12 digits'),
  body('experience')
    .optional()
    .isIn(['0-1 Year', '1-3 Years', '3-5 Years', '5+ Years'])
    .withMessage('Invalid experience level'),
  body('skills')
    .optional()
    .custom((value) => {
      const validSkills = require('../models/SkillReference');
      let skillsArray = [];
      
      if (typeof value === 'string') {
        skillsArray = value.split(',').map(id=>parseInt(id.trim()));
      } else if (Array.isArray(value)) {
        skillsArray = value.map(id => parseInt(id));
      } else {
        throw new Error('Skills must be coma-separated string of IDs or array');
      }
      
      const validIds = skillsReference.map(s => s.id);
      const invalidIds = skillsArray.filter(id => !validIds.includes(id));
      
      if (invalidIds.length>0){
        throw new Error (`Invalid skill IDs: ${invalidIds.join(',')}`);
      }
      return true;
    }),
  // Vendor/Contractor-specific fields (optional)
  body('ownerName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Owner name cannot be empty'),
  body('companyName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Company name cannot be empty'),
  body('panNumber')
    .optional()
    .matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
    .withMessage('Please provide a valid PAN number (e.g. ABCDE1234F)'),
  body('gstNumber')
    .optional()
    .matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
    .withMessage('Please provide a valid GST number (e.g., 27XXXXX0000X1ZX)'),
  body('licenseNumber')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('License number cannot be empty'),
  body('projectTypes')
    .optional()
    .custom((value) => {
      const validProjectTypes = ['Residential Building', 'Commercial Building', 'Industrial Project', 'Infrastructure', 'Renovation', 'Interior Design'];
      let projectTypesArray = [];
      
      if (typeof value === 'string') {
        projectTypesArray = value.split(',').map(s => s.trim());
      } else if (Array.isArray(value)) {
        projectTypesArray = value;
      } else {
        throw new Error('Project types must be a string or array');
      }
      
      const invalidTypes = projectTypesArray.filter(type => !validProjectTypes.includes(type));
      if (invalidTypes.length > 0) {
        throw new Error(`Invalid project types: ${invalidTypes.join(', ')}`);
      }
      
      return true;
    }),
];

const loginValidation = [
  body('phone')
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Please provide a valid 10-digit phone number'),
  body('password').notEmpty().withMessage('Password is required'),
];

const adminLoginValidation = [
  body('email').isEmail().withMessage('Please provide a valid email address'),
  body('password').notEmpty().withMessage('Password is required'),
];

const verifyOtpValidation = [
  body('phone')
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Please provide a valid 10-digit phone number'),
  body('otp')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be 6 digits')
    .isNumeric()
    .withMessage('OTP must contain only numbers'),
];

const resendOtpValidation = [
  body('phone')
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Please provide a valid 10-digit phone number'),
];
const forgotPasswordValidation = [
  body('phone')
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Please provide a valid 10-digit phone number'),
];

const verifyResetOtpValidation = [
  body('phone')
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Please provide a valid 10-digit phone number'),
  body('otp')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be 6 digits')
    .isNumeric()
    .withMessage('OTP must contain only numbers'),
];

const resetPasswordValidation = [
  body('phone')
    .matches(/^[6-9]\d{9}$/)
    .withMessage('Please provide a valid 10-digit phone number'),
  body('resetPasswordToken')
    .notEmpty()
    .withMessage('Reset password token is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  body('confirmPassword')
    .notEmpty()
    .withMessage('Please confirm your password'),
];

// Public routes
router.post('/register', 
  upload.fields([
    { name: 'profileImage', maxCount: 1 },
    { name: 'companyLogo', maxCount: 1 },
    { name: 'aadhaarFrontImage', maxCount: 1 },
    { name: 'aadhaarBackImage', maxCount: 1 },
    { name: 'panCardImage', maxCount: 1 },
    { name: 'medicalCertificate', maxCount: 1 }
  ]), 
  registerValidation, 
  register
);
router.post('/verify-otp', verifyOtpValidation, verifyOtp);
router.post('/resend-otp', resendOtpValidation, resendOtp);
router.post('/login', loginValidation, login);
router.post('/admin/login', adminLoginValidation, adminLogin);
router.post('/forgot-password', forgotPasswordValidation, forgotPassword);
router.post('/verify-reset-otp', verifyResetOtpValidation, verifyResetOtp);
router.post('/reset-password', resetPasswordValidation, resetPassword);
router.post('/logout', protect, logout);

module.exports = router;
