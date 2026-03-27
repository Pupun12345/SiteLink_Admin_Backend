const express = require('express');
const router = express.Router();
const {
  workerData,
  getCurrentAssignment,
  getWorkerAssignments,
  markWorkerArrival,
  completeAssignment,
  assignWorker
} = require('../controllers/workerHomeController');
const { protect } = require('../middleware/auth');

// Worker home data
router.get('/data', protect, workerData);

// Worker assignments
router.get('/current-assignment', protect, getCurrentAssignment);
router.get('/assignments', protect, getWorkerAssignments);
router.put('/assignments/:assignmentId/mark-arrival', protect, markWorkerArrival);
router.put('/assignments/:assignmentId/complete', protect, completeAssignment);

// Assign worker (for vendors/admins)
router.post('/assign-worker', protect, assignWorker);

module.exports = router;