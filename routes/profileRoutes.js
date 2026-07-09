const express = require('express');
const router = express.Router();
const { 
  createCustomerProfile, 
  editCustomerProfile,
  createAdminProfile,
  editAdminProfile,
  getProfile,
  changePassword,
  createWorkerProfile,
  createVendorProfile,
  getStates,
  getCitiesByState,
  getSkills
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

// Admin Profile Routes
router.post('/admin/create', protect, upload.fields([
  { name: 'profileImage', maxCount: 1 }
]), createAdminProfile);

router.put('/admin/edit', protect, upload.fields([
  { name: 'profileImage', maxCount: 1 }
]), editAdminProfile);

// Get Profile
router.get('/me', protect, getProfile);

// Change Password
router.put('/change-password', protect, changePassword);

// Worker Profile Routes
router.post('/worker/create', protect, upload.fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'workSamplesPhoto', maxCount: 10 },
  { name: 'experienceCertificate', maxCount: 1 },
  { name: 'governmentID', maxCount: 1 }
]), createWorkerProfile);

// Vendor Profile Routes
router.post('/vendor/create', protect, upload.fields([
  { name: 'profileImage', maxCount: 1 },
  { name: 'companyLogo', maxCount: 1 },
  {name: 'gstCertificate', maxCount: 1},
  { name: 'panCardImage', maxCount: 1 },
]), createVendorProfile);

// Location Routes
router.get('/states', getStates);
router.get('/cities/:stateId', getCitiesByState);

// Skills Route
router.get('/skills', getSkills);

module.exports = router;
