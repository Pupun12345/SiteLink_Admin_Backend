const express = require('express');
const { adminForgotPassword } = require('../controllers/forgotPasswordController');

const router = express.Router();

router.post('/admin-forgot-password', adminForgotPassword);

module.exports = router;
