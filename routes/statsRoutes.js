const express = require('express');
const { 
    totalWorkers, 
    totalVendors, 
    overview, 
    getChartData, 
    getRecentActivity 
} = require('../controllers/statsController');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// Admin-only endpoints - requires JWT auth
router.get('/total-workers', protect, adminOnly, totalWorkers);
router.get('/total-vendors', protect, adminOnly, totalVendors);
router.get('/overview', protect, adminOnly, overview);
router.get('/chart-data', protect, adminOnly, getChartData);
router.get('/recent-activity', protect, adminOnly, getRecentActivity);

module.exports = router;
