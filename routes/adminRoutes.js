const express = require('express');
const {
  getPendingWorkers,
  getWorkerDetails,
  verifyWorker,
  rejectWorker,
  rateWorker,
  getPendingVendors,
  getVendors,
  getVendorDetails,
  verifyVendor,
  rejectVendor,
  rateVendor,
  getAllUsers,
  getUserDetails,
} = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication and admin role
router.use(protect);
router.use(adminOnly);

// Admin-only user management
router.get('/users', getAllUsers);
router.get('/users/:id', getUserDetails);
router.put('/users/:id/verify', verifyWorker);
router.put('/users/:id/reject', rejectWorker);
router.put('/users/:id/rate', rateWorker);

// Admin-only worker verification endpoints
router.get('/workers/pending', getPendingWorkers);
router.get('/workers/:id', getWorkerDetails);
router.put('/workers/:id/verify', verifyWorker);
router.put('/workers/:id/reject', rejectWorker);
router.put('/workers/:id/rate', rateWorker);

// Admin-only vendor verification endpoints
router.get('/vendors/pending', getPendingVendors);
router.get('/vendors', getVendors);
router.get('/vendors/:id', getVendorDetails);
router.put('/vendors/:id/verify', verifyVendor);
router.put('/vendors/:id/reject', rejectVendor);
router.put('/vendors/:id/rate', rateVendor);

module.exports = router;
