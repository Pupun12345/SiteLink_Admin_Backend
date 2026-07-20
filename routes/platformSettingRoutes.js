const express = require('express');
const {
  getPlans,
  createPlan,
  editPlanAmount,
  deletePlan,
  notificationSettings,
  verificationRulesSettings,
  languageSettings,
  getSettings,
  addSkill,
  updateSupportContact,
} = require('../controllers/platformSettingController');
const { protect } = require('../middleware/auth');

const router = express.Router();

const adminOnly = (req, res, next) => {
  if (req.user && (req.user.userType === 'admin' || req.user.role === 'admin')) {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Access denied. Admin privileges required.' });
  }
};

router.use(protect);
router.use(adminOnly);

router.get('/', getSettings);
router.get('/plans', getPlans);
router.post('/plans', createPlan);
router.put('/plans/:id', editPlanAmount);
router.delete('/plans/:id', deletePlan);
router.put('/notifications', notificationSettings);
router.put('/verification-rules', verificationRulesSettings);
router.put('/language', languageSettings);
router.put('/support-contact', updateSupportContact);
router.post('/skills', addSkill);

module.exports = router;
