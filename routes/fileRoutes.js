const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { downloadFile } = require('../controllers/fileController');

// @route   GET /api/files/download?url=<encoded>&label=<optional>
// @access  Private
router.get('/download', protect, downloadFile);

module.exports = router;
