const express = require('express');
const router = express.Router();
const { getAllPolicies, createOrUpdatePolicy, deletePolicyVersion } = require('../controllers/legalController');
const { adminOnly, protect } = require('../middleware/auth');


// Admin routes
router.get('/policies', getAllPolicies);
router.post('/policies', protect, adminOnly, createOrUpdatePolicy);
router.delete('/policies/:id', protect, adminOnly, deletePolicyVersion);

module.exports = router;
