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
router.get('/profile', getAdminUserProfile);

router.use(protect);
router.use(adminOnly);

router.post('/', createAdminUser);
router.get('/', getAllAdminUsers);
router.put('/:id', updateAdminUser);
router.delete('/:id', deleteAdminUser);

module.exports = router;
