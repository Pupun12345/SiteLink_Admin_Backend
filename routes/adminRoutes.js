const express = require('express');
const {
  getPendingWorkers,
  getWorkerDetails,
  verifyWorker,
  rejectWorker,
  rateWorker,
  getPendingVendors,
  getVendorDetails,
  verifyVendor,
  rejectVendor,
  rateVendor,
  getAllUsers,
  getAllWorkersAndVendors,
  getUserDetails,
  updateUserDetails,
  deleteUser,
  autoApprove,
  addSkillsToWorker,
  removeSkillFromWorker,
} = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication and admin role
router.use(protect);
router.use(adminOnly);

// Admin-only user management
router.get('/users', getAllUsers);
router.get("/vendor-worker",getAllWorkersAndVendors);
router.get('/users/:id', getUserDetails);
router.put('/users/:id', updateUserDetails);
router.put('/users/:id/verify', verifyWorker);
router.put('/users/:id/reject', rejectWorker);
router.put('/users/:id/rate', rateWorker);
router.put('/users/:id/suspend', (req, res) => res.status(501).json({ success: false, message: 'Not implemented yet' }));
router.put('/users/:id/ban', (req, res) => res.status(501).json({ success: false, message: 'Not implemented yet' }));
router.put('/users/:id/activate', verifyWorker);
router.delete('/users/:id', deleteUser);

// Admin-only worker verification endpoints
router.get('/workers/pending', getPendingWorkers);
router.get('/workers/:id', getWorkerDetails);
router.put('/workers/:id/verify', verifyWorker);
router.put('/workers/:id/auto-verify', autoApprove);
router.put('/workers/:id/reject', rejectWorker);
router.put('/workers/:id/rate', rateWorker);
router.put('/workers/:id/skills', addSkillsToWorker);
router.delete('/workers/:id/skills/:skillId', removeSkillFromWorker);

// Admin-only vendor verification endpoints
router.get('/vendors/pending', getPendingVendors);
router.get('/vendors/:id', getVendorDetails);
router.put('/vendors/:id/verify', verifyVendor);
router.put('/vendors/:id/auto-verify', autoApprove);
router.put('/vendors/:id/reject', rejectVendor);
router.put('/vendors/:id/rate', rateVendor);

module.exports = router;