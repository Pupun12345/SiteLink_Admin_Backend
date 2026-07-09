const User = require('../models/User');
const AdminUser = require('../models/AdminUser');
const { sendPasswordEmail, generateTempPassword } = require('../utils/emailUtils');

// @desc    Admin Forgot Password - Unified for both Admin and AdminUser
// @route   POST /api/auth/admin-forgot-password
// @access  Public
exports.adminForgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const emailLower = email.toLowerCase().trim();

    // Check in AdminUser collection first
    let admin = await AdminUser.findOne({ email: emailLower, isActive: true });
    let isAdminUser = true;
    
    // If not found in AdminUser, check in User collection with role admin
    if (!admin) {
      admin = await User.findOne({ email: emailLower, role: 'admin' });
      isAdminUser = false;
    }

    if (!admin) {
      return res.status(404).json({ 
        success: false, 
        message: 'No admin account found with this email address' 
      });
    }

    // Generate temporary password
    const tempPassword = generateTempPassword();

    // Try to send email first before updating database
    try {
      await sendPasswordEmail(emailLower, tempPassword);
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to send email. Please check your email configuration.' 
      });
    }

    // Only update password if email was sent successfully
    admin.password = tempPassword;
    await admin.save();

    return res.json({
      success: true,
      message: 'Temporary password has been sent to your email. Please check your inbox.',
    });

  } catch (error) {
    console.error('adminForgotPassword error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error. Please try again later.' 
    });
  }
};
