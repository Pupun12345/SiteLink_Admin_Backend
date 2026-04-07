const User = require('../models/User');
const PlatformSettings = require('../models/PlatformSettings');
const { validateRequiredDocuments } = require('../utils/platformSettingsUtils');
const { sendTokenResponse, generateToken } = require('../utils/tokenUtils');
const { generateOTP, getOTPExpiry } = require('../utils/otpUtils');
const { validationResult } = require('express-validator');
const skillsReference = require('../models/SkillReference');
const BlacklistedToken = require('../models/BlacklistedToken');
const crypto = require('crypto');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { name, phone, password, confirmPassword, userType, role } = req.body;

    // Check if passwords match
    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match',
      });
    }

    // Get uploaded file paths
    const profileImage = req.files && req.files['profileImage'] 
      ? req.files['profileImage'][0].path 
      : null;
    const companyLogo = req.files && req.files['companyLogo'] 
      ? req.files['companyLogo'][0].path 
      : null;
    const aadhaarFrontImage = req.files && req.files['aadhaarFrontImage'] 
      ? req.files['aadhaarFrontImage'][0].path 
      : null;
    const aadhaarBackImage = req.files && req.files['aadhaarBackImage'] 
      ? req.files['aadhaarBackImage'][0].path 
      : null;
    const panCardImage = req.files && req.files ['panCardImage']
     ? req.files['panCardImage'][0].path
     : null;
    const medicalCertificate = req.files && req.files['medicalCertificate']
     ? req.files['medicalCertificate'][0].path
     : null;

    // Check if user already exists
    const userExists = await User.findOne({ phone });

    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this phone number',
      });
    }

    // Validate userType
    const validUserTypes = ['customer', 'vendor', 'worker'];
    const finalUserType = userType && validUserTypes.includes(userType) ? userType : 'customer';

    // Validate required documents based on platform settings
    if (finalUserType === 'worker' || finalUserType === 'vendor') {
      const documentValidation = await validateRequiredDocuments(finalUserType, req.files, req.body);
      
      if (!documentValidation.success) {
        return res.status(400).json({
          success: false,
          message: `${documentValidation.message} as per current platform settings`,
          errors: documentValidation.errors
        });
      }
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpire = getOTPExpiry();

    // Create user data object
    const userData = {
      name,
      phone,
      password,
      userType: finalUserType,
      role: role || 'user',
      profileImage,
      companyLogo,
      aadhaarFrontImage,
      aadhaarBackImage,
      panCardImage,
      medicalCertificate,
      otp,
      otpExpire,
      otpAttempts: 0,
      isVerified: false,
    };

    // Add email if provided
    if (req.body.email) {
      userData.email = req.body.email;
    }

    // Add worker-specific fields if provided
    if (req.body.city) {
      userData.city = req.body.city;
    }
    if (req.body.dailyRate) {
      userData.dailyRate = req.body.dailyRate;
    }
    if (req.body.aadhaarNumber) {
      userData.aadhaarNumber = req.body.aadhaarNumber;
    }
    if (req.body.experience) {
      userData.experience = req.body.experience;
    }
    if (req.body.skills) {
     let skillsIds = [];
     
     if(typeof req.body.skills === 'string'){
      skillsIds = req.body.skills.split(',').map(id=>parseInt(id.trim()));
     }
     else if (Array.isArray(req.body.skills)){
      skillsIds = req.body.skills.map(id=>parseInt(id));
     }
     
     userData.skills = skillsIds.map(id => {
      const skill = skillsReference.find(s=>s.id === id);
      if(skill){
        return {
          skillId: skill.id,
          skillName: skill.name
        };
      }
     }).filter(Boolean);
     }
    

    // Add vendor/contractor-specific fields if provided
    if (req.body.ownerName) {
      userData.ownerName = req.body.ownerName;
    }
    if (req.body.companyName) {
      userData.companyName = req.body.companyName;
    }
    if (req.body.panNumber){
      userData.panCardImage = req.body.panNumber;
    }
    if (req.body.gstNumber) {
      userData.gstNumber = req.body.gstNumber;
    }
    if (req.body.licenseNumber) {
      userData.licenseNumber = req.body.licenseNumber;
    }
    if (req.body.projectTypes) {
      // Handle project types as array (can be sent as comma-separated string or JSON array)
      if (typeof req.body.projectTypes === 'string') {
        userData.projectTypes = req.body.projectTypes.split(',').map(type => type.trim());
      } else if (Array.isArray(req.body.projectTypes)) {
        userData.projectTypes = req.body.projectTypes;
      }
    }

    // Create user with OTP (not verified yet)
    const user = await User.create(userData);

    // In production, send OTP via SMS
    // For development, we'll return it in the response
    console.log(`OTP for +91${phone}: ${otp}`);

    res.status(200).json({
      success: true,
      message: 'Registration successful. OTP sent to +91' + phone,
      data: {
        phone: user.phone,
        otp: otp, // Remove this in production!
        expiresIn: '10 minutes',
      },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: error.message,
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { phone, password } = req.body;

    // Validate phone & password
    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide phone number and password',
      });
    }

    // Check for user (include password for comparison)
    const user = await User.findOne({ phone }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check if user is verified by OTP
    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your account with OTP before logging in',
      });
    }

    // Worker accounts require admin document verification
    if (user.userType === 'worker' && user.verificationStatus !== 'verified') {
      return res.status(403).json({
        success: false,
        message: 'Worker account pending admin verification',
        verificationStatus: user.verificationStatus,
      });
    }

    // Check if password matches
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Send token response
    sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error('Login error:', error);
    next(error);
  }
};

// @desc    Admin login (email/password)
// @route   POST /api/auth/admin/login
// @access  Public
exports.adminLogin = async (req, res, next) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
      });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password',
      });
    }

    // Find admin user
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user || user.role !== 'admin') {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check if password matches
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Send token response
    const token = generateToken(user._id);

    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    return res.status(200).json({
      success: true,
      token,
      redirectTo: '/admin/dashboard',
      user: userData,
    });
    
  } catch (error) {
    console.error('Admin login error:', error);
    next(error);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
   next(error);
  }
};

// @desc    Verify OTP
// @route   POST /api/auth/verify-otp
// @access  Public
exports.verifyOtp = async (req, res, next) => {
  try {
    const { phone, otp } = req.body;

    // Validate phone & OTP
    if (!phone || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Please provide phone number and OTP',
      });
    }

    // Find user with OTP and phone
    const user = await User.findOne({ phone }).select('+otp +otpExpire +otpAttempts');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if user is already verified
    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Account is already verified',
      });
    }

    // Check if OTP matches
    if (user.otp !== otp) {
      // Increment OTP attempts
      user.otpAttempts = (user.otpAttempts || 0) + 1;
      await user.save();

      // Check if max attempts reached
      if (user.otpAttempts >= 3) {
        // Clear OTP and require resend
        user.otp = undefined;
        user.otpExpire = undefined;
        user.otpAttempts = 0;
        await user.save();

        return res.status(400).json({
          success: false,
          message: 'Maximum OTP attempts reached. Please request a new OTP.',
        });
      }

      return res.status(400).json({
        success: false,
        message: `Invalid OTP. ${3 - user.otpAttempts} attempts remaining.`,
      });
    }

    // Check if OTP has expired
    if (user.otpExpire < Date.now()) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.',
      });
    }

    // Verify user and clear OTP fields
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpire = undefined;
    user.otpAttempts = 0;
    await user.save();

    // Send token response after successful verification
    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Resend OTP
// @route   POST /api/auth/resend-otp
// @access  Public
exports.resendOtp = async (req, res, next) => {
  try {
    const { phone } = req.body;

    // Validate phone
    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Please provide phone number',
      });
    }

    // Find user
    const user = await User.findOne({ phone }).select('+otp +otpExpire +otpAttempts');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if user is already verified
    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: 'Account is already verified',
      });
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpExpire = getOTPExpiry();

    // Reset OTP attempts and update OTP
    user.otp = otp;
    user.otpExpire = otpExpire;
    user.otpAttempts = 0;
    await user.save();

    // In production, send OTP via SMS
    console.log(`New OTP for +91${phone}: ${otp}`);

    res.status(200).json({
      success: true,
      message: 'OTP resent successfully to +91' + phone,
      data: {
        phone: user.phone,
        otp: otp, // Remove this in production!
        expiresIn: '10 minutes',
      },
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    next(error);
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private

exports.logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "No token provided",
      });
    }

    // Save token to blacklist
    await BlacklistedToken.create({ token });

    res.status(200).json({
      success: true,
      message: "User logged out successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Logout failed",
    });
  }
};

// @desc Forgot password - Send OTP
// @route Post /api/auth/forgot-password
// @access Public
exports.forgotPassword = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Please provide phone number',
      });
    }

    const user = await User.findOne({ phone }).select('+otp +otpExpire +otpAttempts');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const otp = generateOTP();
    const otpExpire = getOTPExpiry();

    user.otp = otp;
    user.otpExpire = otpExpire;
    user.otpAttempts = 0;
    await user.save();

    console.log(`OTP for +91${phone}: ${otp}`);

    res.status(200).json({
      success: true,
      message: 'OTP sent to +91' + phone,
      data: {
        phone: user.phone,
        otp: otp,
        expiresIn: '10 minutes',
      },
    });
  } catch (error) {
    console.log('Forgot Password error: ', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

  //@desc Verify OTP for password Reser
  //@route Post/api/auth/verify-reset-otp
  //@access Public
  exports.verifyResetOtp = async(req,res) => {
    try{
      const { phone , otp } = req.body;
      if(!phone || !otp){
        return res.status(400).json({
          success:false,
          message: 'Please provide valid phone number and Otp'
        });
      }
      const user = await User.findOne({phone}).select('+otp +otpExpire +otpAttempts');

      if(!user){
        return res.status(404).json({
          success:false,
          message: 'User not found',
        });
      }
      if(user.otp !== otp){
        user.otpAttempts = (user.otpAttempts || 0)+ 1;
        await user.save ();

        if (user.otpAttempts >= 3){
          user.otp = undefined;
          user.otpExpire = undefined;
          user.otpAttempts = 0;
          await user.save();

          return res.status(400).json({
            success: false,
            messsage:' Maximun OTP attempts reached',
          });
        }

        return res.status(400).json({
          success: false,
          message: `Invalid OTP. ${3 - user.otpAttempts} attempts remaining.`,
        });
      }

      if(user.otpExpire < Date.now()){
        return res.status(400).json({
          success:false,
          message: 'OTP has expired. Please Request a new OTP',
        });
      }
     
      const  resetToken = crypto.randomBytes(32).toString('hex');

      user.resetPasswordToken = resetToken;
      user.resetPasswordExpire = Date.now() + 15*60*1000;

      user.otp = undefined;
      user.otpExpire = undefined;
      user.otpAttempts = 0;

      await user.save();

      res.status(200).json({
        success:true,
        message: ' OTP verified Successfully. Use the token to reset your password.',
        data: {
          phone : user.phone,
          resetPasswordToken: resetToken,
          expiresIn: '15 minutes',
        },
      });

    } catch (error){
      console.error('verify reset OTP error:', error);
      res.status(500).json({
        success:false,
        message:'server error',
      });
    }
};

exports.resetPassword = async ( req , res ) => {
  try{
    const { phone, resetPasswordToken, newPassword, confirmPassword} = req.body;

    if(!phone || !resetPasswordToken || !newPassword || !confirmPassword){
      return res.status(400).json({
        success: false,
        message: ' Please provide phone, token, and password',
      });
    }

    if (newPassword !== confirmPassword){
      return res.status(400).json({
        success:false,
        message: 'Passwords do not match',
      });
    }

    if (newPassword.length < 8){
      return res.status(400).json({
        success:false,
        message:'Password must be at least 8 characters',
      });
    }

    const user = await user.findOne({ phone }).select('+resetPasswordToken +resetPasswordExpire +password');

    if(!user){
      return res.status(404).json({
        success:false,
        message: 'User not found',
      })
    }

    if(user.resetPasswordToken !== resetPasswordToken){
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token',
      });
    }

   
    if (user.resetPasswordExpire < Date.now()) {
      return res.status(400).json({
        success: false,
        message: 'Reset token has expired. Please request a new one.',
      });
    }

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now login with your new password.',
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

