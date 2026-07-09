const express = require('express');
const { 
    totalWorkers, 
    totalVendors, 
    overview, 
    getChartData,
    getYearData,
    getRecentActivity,
    revenueStats,
    getSubscriptionStats
} = require('../controllers/statsController');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

// Admin-only endpoints - requires JWT auth
router.get('/total-workers', protect, adminOnly, totalWorkers);
router.get('/total-vendors', protect, adminOnly, totalVendors);
router.get('/overview', protect, adminOnly, overview);
router.get('/chart-data', protect, adminOnly, getChartData);
router.get('/year-data', protect, adminOnly, getYearData);
router.get('/recent-activity', protect, adminOnly, getRecentActivity);
router.get('/revenue-stats',protect, adminOnly, revenueStats);
router.get('/revenue-stats/subscriptions', protect, adminOnly, getSubscriptionStats);

module.exports = router;
