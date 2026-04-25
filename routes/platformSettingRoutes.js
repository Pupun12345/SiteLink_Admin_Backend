const express = require('express');
const {
  editPlanAmount,
  notificationSettings,
  verificationRulesSettings,
  languageSettings,
  getSettings,
} = require('../controllers/platformSettingController');
const { protect } = require('../middleware/auth');

const router = express.Router();

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

router.use(protect);
router.use(adminOnly);

// Platform settings routes
router.get('/', getSettings);
router.put('/plans', editPlanAmount);
router.put('/notifications', notificationSettings);
router.put('/verification-rules', verificationRulesSettings);
router.put('/language', languageSettings);

module.exports = router;
