const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AdminUser = require('../models/AdminUser');
const BlacklistedToken = require('../models/BlacklistedToken');

exports.protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route',
    });
  }

  try {
    // CHECK IF TOKEN IS BLACKLISTED
    const blacklisted = await BlacklistedToken.findOne({ token });

    if (blacklisted) {
      return res.status(401).json({
        success: false,
        message: 'Token has been logged out',
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if it's an admin user
    if (decoded.type === 'admin_user') {
      req.user = await AdminUser.findById(decoded.id);
      if (!req.user || !req.user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Admin user not found or inactive',
        });
      }
      req.user.userType = 'admin';
    } else {
      // Get regular user
      req.user = await User.findById(decoded.id);

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User not found',
        });
      }
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
};


exports.adminOnly = (req, res, next) => {
  // Allow both super admin admin users (with permissions object)
  if (req.user && (req.user.userType === 'admin' || req.user.permissions)) {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admins only.',
    });
  }
}
// Authorize specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route`,
      });
    }

    next();
  };
};

