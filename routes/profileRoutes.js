const express = require('express');
const router = express.Router();
const { 
  createCustomerProfile, 
  createWorkerProfile, 
  createVendorProfile,
  editCustomerProfile,
  editWorkerProfile,
  editVendorProfile,
  getProfile 
} = require('../controllers/profileController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Customer Profile Routes
router.post('/customer/create', protect, upload.fields([
  { name: 'profileImage', maxCount: 1 }
]), createCustomerProfile);

router.put('/customer/edit', protect, upload.fields([
  { name: 'profileImage', maxCount: 1 }
]), editCustomerProfile);

// Worker Profile Routes
router.post('/worker/create', protect, upload.fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'aadhaarFrontImage', maxCount: 1 },
  { name: 'aadhaarBackImage', maxCount: 1 },
  { name: 'certificateImages', maxCount: 5 },
  { name: 'medicalCertificate', maxCount: 1 },
]), createWorkerProfile);

router.put('/worker/edit', protect, upload.fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'aadhaarFrontImage', maxCount: 1 },
  { name: 'aadhaarBackImage', maxCount: 1 },
  { name: 'certificateImages', maxCount: 5 },
  { name: 'medicalCertificate', maxCount: 1 },
]), editWorkerProfile);

// Vendor Profile Routes
router.post('/vendor/create', protect, upload.fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'companyLogo', maxCount: 1 },
  { name: 'panCardImage', maxCount: 1 }
]), createVendorProfile);

router.put('/vendor/edit', protect, upload.fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'companyLogo', maxCount: 1 },
  { name: 'panCardImage', maxCount: 1 }
]), editVendorProfile);

// Get Profile (Common for all user types)
router.get('/me', protect, getProfile);

module.exports = router;
