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
  autoApprove,
} = require('../controllers/adminController');
const { protect, adminOnly, checkPermission } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication and admin role
router.use(protect);
router.use(adminOnly);

// Admin-only user management
router.get('/users', checkPermission('canManageUsers'), getAllUsers);
router.get('/users/:id', checkPermission('canManageUsers'), getUserDetails);
router.put('/users/:id/verify', checkPermission('canVerifyUsers'), verifyWorker);
router.put('/users/:id/reject', checkPermission('canVerifyUsers'), rejectWorker);
router.put('/users/:id/rate', checkPermission('canVerifyUsers'), rateWorker);

// Admin-only worker verification endpoints
router.get('/workers/pending', checkPermission('canVerifyUsers'), getPendingWorkers);
router.get('/workers/:id', checkPermission('canVerifyUsers'), getWorkerDetails);
router.put('/workers/:id/verify', checkPermission('canVerifyUsers'), verifyWorker);
router.put('/workers/:id/auto-verify', checkPermission('canVerifyUsers'), autoApprove);
router.put('/workers/:id/reject', checkPermission('canVerifyUsers'), rejectWorker);
router.put('/workers/:id/rate', checkPermission('canVerifyUsers'), rateWorker);

// Admin-only vendor verification endpoints
router.get('/vendors/pending', checkPermission('canVerifyUsers'), getPendingVendors);
router.get('/vendors', checkPermission('canVerifyUsers'), getVendors);
router.get('/vendors/:id', checkPermission('canVerifyUsers'), getVendorDetails);
router.put('/vendors/:id/verify', checkPermission('canVerifyUsers'), verifyVendor);
router.put('/vendors/:id/auto-verify', checkPermission('canVerifyUsers'), autoApprove);
router.put('/vendors/:id/reject', checkPermission('canVerifyUsers'), rejectVendor);
router.put('/vendors/:id/rate', checkPermission('canVerifyUsers'), rateVendor);

module.exports = router;
