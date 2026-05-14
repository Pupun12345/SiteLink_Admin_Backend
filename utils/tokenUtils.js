const jwt = require('jsonwebtoken');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// Send token response
const sendTokenResponse = (user, statusCode, res) => {
  const token = generateToken(user._id);

  const userData = {
    id: user._id,
    name: user.name,
    phone: user.phone,
    email: user.email,
    userType: user.userType,
    role: user.role,
    profileImage: user.profileImage,
    isVerified: user.isVerified,
    isPhoneVerified: user.isPhoneVerified,
  };

  // Add worker-specific fields
  if (user.userType === 'worker') {
    userData.city = user.city;
    userData.dailyRate = user.dailyRate;
    userData.aadhaarNumber = user.aadhaarNumber;
    userData.aadhaarFrontImage = user.aadhaarFrontImage;
    userData.aadhaarBackImage = user.aadhaarBackImage;
    userData.experience = user.experience;
    userData.skills = user.skills;
  }

  // Add vendor-specific fields
  if (user.userType === 'vendor') {
    userData.companyLogo = user.companyLogo;
    userData.ownerName = user.ownerName;
    userData.companyName = user.companyName;
    userData.panNumber = user.panNumber;
    userData.panCardImage = user.panCardImage;
    userData.gstNumber = user.gstNumber;
    userData.licenseNumber = user.licenseNumber;
    userData.projectTypes = user.projectTypes;
    userData.city = user.city;
  }

  res.status(statusCode).json({
    success: true,
    token,
    user: userData,
  });
};

module.exports = { generateToken, sendTokenResponse };
