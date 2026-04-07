const express = require('express');
const router = express.Router();
const {
  getSystemHealth,
  getApiStats,
  getSystemLogs,
  getSystemAlerts,
  exportSystemReport
} = require('../controllers/systemController');
const { protect } = require('../middleware/auth');

// Middleware to check if user is admin
const adminOnly = (req, res, next) => {
  if (req.user && (req.user.userType === 'admin' || req.user.role === 'admin')) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }
};

// GET system health metrics
router.get('/health', protect, adminOnly, getSystemHealth);

// GET API usage statistics
router.get('/api-stats', protect, adminOnly, getApiStats);

// GET system logs
router.get('/logs', protect, adminOnly, getSystemLogs);

// GET system alerts
router.get('/alerts', protect, adminOnly, getSystemAlerts);

// GET export system report
router.get('/export-report', protect, adminOnly, exportSystemReport);

module.exports = router;