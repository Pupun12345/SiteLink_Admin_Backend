const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimiter');
const { getUploadSignature, confirmUpload } = require('../controllers/uploadController');

// 30 signature requests per 15 minutes per IP — prevents signature farming.
const signatureLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many upload requests. Please wait a few minutes.',
});

// @route   POST /api/uploads/signature
// @access  Private
router.post('/signature', protect, signatureLimiter, getUploadSignature);

// @route   POST /api/uploads/confirm
// @access  Private
router.post('/confirm', protect, confirmUpload);

module.exports = router;
