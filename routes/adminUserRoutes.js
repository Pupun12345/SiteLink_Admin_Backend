const express = require('express');
const {
  createAdminUser,
  getAllAdminUsers,
  updateAdminUser,
  deleteAdminUser,
  adminUserLogin,
  getAdminUserProfile,
} = require('../controllers/adminUserController');
const { protect, adminOnly } = require('../middleware/auth');

const router = express.Router();

router.post('/login', adminUserLogin);
// Profile needs an authenticated admin (reads req.user) — was unprotected.
router.get('/profile', protect, getAdminUserProfile);

router.use(protect);
router.use(adminOnly);

router.post('/', createAdminUser);
router.get('/', getAllAdminUsers);
router.put('/:id', updateAdminUser);
router.delete('/:id', deleteAdminUser);

module.exports = router;
