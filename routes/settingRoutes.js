const express = require("express");
const router = express.Router();
const { getProfile, updateProfile, changePassword } = require("../controllers/settingsController");
const { protect, adminOnly } = require('../middleware/auth'
);
const upload = require('../middleware/upload');

router.use(protect);
router.use(adminOnly);

router.get("/profile", getProfile);

router.put('/admin/edit', upload.fields([
    { name: 'profileImage', maxCount: 1 }
]), updateProfile);

router.put("/change-password", changePassword);

module.exports = router;