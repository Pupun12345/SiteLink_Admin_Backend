const User = require('../models/User');
const PlatformSettings = require('../models/PlatformSettings');

// Get list of workers pending document verification
exports.getPendingWorkers = async (req, res) => {
  try {
    const workers = await User.find({
      userType: 'worker',
      verificationStatus: 'pending',
    }).select('name phone role experience city profileImage verificationStatus');

    return res.json({
      success: true,
      count: workers.length,
      data: workers,
    });
  } catch (error) {
    console.error('getPendingWorkers error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get worker details (for verification screen)
exports.getWorkerDetails = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid worker ID format' });
    }

    const worker = await User.findById(id).select(
      'name age phone experience city dailyRate profileImage aadhaarFrontImage aadhaarBackImage medicalCertificate certificates verificationStatus isVerified skills userType adminRating adminRatingComment ratedAt'
    );

    if (!worker || worker.userType !== 'worker') {
      return res.status(404).json({ success: false, message: 'Worker not found' });
    }

    // Get platform settings to show required documents
    const platformSettings = await PlatformSettings.getOrCreateSettings();
    const requiredDocuments = platformSettings.verificationRules.worker;

    return res.json({ 
      success: true, 
      data: {
        ...worker.toObject(),
        requiredDocuments
      }
    });
  } catch (error) {
    console.error('getWorkerDetails error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Verify worker documents
exports.verifyWorker = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID format' });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.verificationStatus = 'verified';
    user.isVerified = true;
    user.verificationRejectedReason = null;
    user.verificationReviewedAt = new Date();

    await user.save({ validateModifiedOnly: true });

    return res.json({
      success: true,
      message: `${user.userType.charAt(0).toUpperCase() + user.userType.slice(1)} verified successfully`,
      data: {
        id: user._id,
        verificationStatus: user.verificationStatus,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    console.error('verifyWorker error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Reject worker verification with a reason
exports.rejectWorker = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Validate ObjectId format
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID format' });
    }

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required' });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.verificationStatus = 'rejected';
    user.isVerified = false;
    user.verificationRejectedReason = reason.trim();
    user.verificationReviewedAt = new Date();

    await user.save({ validateModifiedOnly: true });

    return res.json({
      success: true,
      message: `${user.userType.charAt(0).toUpperCase() + user.userType.slice(1)} verification rejected`,
      data: {
        id: user._id,
        verificationStatus: user.verificationStatus,
        rejectionReason: user.verificationRejectedReason,
      },
    });
  } catch (error) {
    console.error('rejectWorker error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Rate worker (admin only)
exports.rateWorker = async (req, res) => {
  try {
    const { id } = req.params;
    let { rating, comment } = req.body;

    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID format' });
    }

    rating = parseFloat(rating);

    if (!rating || isNaN(rating) || rating < 0.1 || rating > 5.0) {
      return res.status(400).json({ success: false, message: 'Rating must be between 0.1 and 5.0' });
    }

    // Round to 1 decimal place
    rating = Math.round(rating * 10) / 10;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.verificationStatus !== 'verified') {
      return res.status(400).json({ success: false, message: 'Only verified users can be rated' });
    }

    user.adminRating = rating;
    user.adminRatingComment = comment || null;
    user.ratedAt = new Date();

    await user.save({ validateModifiedOnly: true });

    return res.json({
      success: true,
      message: `${user.userType.charAt(0).toUpperCase() + user.userType.slice(1)} rated successfully`,
      data: {
        id: user._id,
        adminRating: user.adminRating,
        adminRatingComment: user.adminRatingComment,
        ratedAt: user.ratedAt,
      },
    });
  } catch (error) {
    console.error('rateWorker error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get list of vendors pending document verification
exports.getPendingVendors = async (req, res) => {
  try {
    const vendors = await User.find({
      userType: 'vendor',
      verificationStatus: 'pending',
    }).select('companyName ownerName phone city companyLogo verificationStatus createdAt email gstNumber');

    return res.json({
      success: true,
      count: vendors.length,
      data: vendors,
    });
  } catch (error) {
    console.error('getPendingVendors error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get list of vendors optionally filtered by verification status
exports.getVendors = async (req, res) => {
  try {
    const { status } = req.query;
    const query = { userType: 'vendor' };

    if (status && status !== 'all') {
      query.verificationStatus = status;
    }

    const vendors = await User.find(query).select(
      'companyName ownerName phone city companyLogo verificationStatus createdAt email gstNumber adminRating projectTypes panCardImage'
    );

    return res.json({
      success: true,
      count: vendors.length,
      data: vendors,
    });
  } catch (error) {
    console.error('getVendors error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get vendor details (for verification screen)
exports.getVendorDetails = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid vendor ID format' });
    }

    const vendor = await User.findById(id).select(
      'companyName ownerName phone email city gstNumber panNumber licenseNumber panCardImage companyLogo verificationStatus isVerified projectTypes userType adminRating adminRatingComment ratedAt'
    );

    if (!vendor || vendor.userType !== 'vendor') {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    // Get platform settings to show required documents
    const platformSettings = await PlatformSettings.getOrCreateSettings();
    const requiredDocuments = platformSettings.verificationRules.vendor;

    return res.json({ 
      success: true, 
      data: {
        ...vendor.toObject(),
        requiredDocuments
      }
    });
  } catch (error) {
    console.error('getVendorDetails error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Verify vendor documents
exports.verifyVendor = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid vendor ID format' });
    }

    const vendor = await User.findById(id);

    if (!vendor || vendor.userType !== 'vendor') {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    vendor.verificationStatus = 'verified';
    vendor.isVerified = true;
    vendor.verificationRejectedReason = null;
    vendor.verificationReviewedAt = new Date();

    await vendor.save({ validateModifiedOnly: true });

    return res.json({
      success: true,
      message: 'Vendor verified successfully',
      data: {
        id: vendor._id,
        verificationStatus: vendor.verificationStatus,
        isVerified: vendor.isVerified,
      },
    });
  } catch (error) {
    console.error('verifyVendor error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Reject vendor verification with a reason
exports.rejectVendor = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Validate ObjectId format
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid vendor ID format' });
    }

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required' });
    }

    const vendor = await User.findById(id);

    if (!vendor || vendor.userType !== 'vendor') {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    vendor.verificationStatus = 'rejected';
    vendor.isVerified = false;
    vendor.verificationRejectedReason = reason.trim();
    vendor.verificationReviewedAt = new Date();

    await vendor.save({ validateModifiedOnly: true });

    return res.json({
      success: true,
      message: 'Vendor verification rejected',
      data: {
        id: vendor._id,
        verificationStatus: vendor.verificationStatus,
        rejectionReason: vendor.verificationRejectedReason,
      },
    });
  } catch (error) {
    console.error('rejectVendor error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Rate vendor (admin only)
exports.rateVendor = async (req, res) => {
  try {
    const { id } = req.params;
    let { rating, comment } = req.body;

    // Validate ObjectId format
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid vendor ID format' });
    }

    rating = parseInt(rating, 10);

    if (!rating || isNaN(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    const vendor = await User.findById(id);

    if (!vendor || vendor.userType !== 'vendor') {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    if (vendor.verificationStatus !== 'verified') {
      return res.status(400).json({ success: false, message: 'Only verified vendors can be rated' });
    }

    vendor.adminRating = rating;
    vendor.adminRatingComment = comment || null;
    vendor.ratedAt = new Date();

    await vendor.save({ validateModifiedOnly: true });

    return res.json({
      success: true,
      message: 'Vendor rated successfully',
      data: {
        id: vendor._id,
        adminRating: vendor.adminRating,
        adminRatingComment: vendor.adminRatingComment,
        ratedAt: vendor.ratedAt,
      },
    });
  } catch (error) {
    console.error('rateVendor error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get all users for admin user management
exports.getAllUsers = async (req, res) => {
  try {
    const { userType, status, page = 1, limit = 10 } = req.query;

    const query = {};

    if (userType && userType !== 'all') {
      query.userType = userType;
    }

    if (status && status !== 'all') {
      query.verificationStatus = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(query)
      .select('name email phone userType verificationStatus isVerified createdAt profileImage companyName ownerName city role experience adminRating')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    const transformedUsers = users.map(user => ({
      _id: user._id,
      name: user.userType === 'vendor' ? user.companyName : user.name,
      email: user.email || '',
      type: user.userType.charAt(0).toUpperCase() + user.userType.slice(1),
      status: user.verificationStatus.charAt(0).toUpperCase() + user.verificationStatus.slice(1),
      join: user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
      plan: 'Basic',
      lastActive: 'Recently',
      avatar: user.profileImage || (user.userType === 'vendor' ? user.companyLogo : 'https://randomuser.me/api/portraits/lego/1.jpg'),
      phone: user.phone,
      city: user.city,
      role: user.role || (user.userType === 'vendor' ? 'Vendor' : 'Worker'),
      experience: user.experience,
      adminRating: user.adminRating || null,
    }));

    return res.json({
      success: true,
      count: transformedUsers.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      data: transformedUsers,
    });
  } catch (error) {
    console.error('getAllUsers error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get user details for admin user profile view
exports.getUserDetails = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID format' });
    }

    const user = await User.findById(id).select(
      'name email phone userType verificationStatus isVerified createdAt profileImage companyName ownerName city role experience age dailyRate aadhaarFrontImage aadhaarBackImage medicalCertificate certificates skills gstNumber panNumber licenseNumber panCardImage companyLogo projectTypes adminRating adminRatingComment ratedAt'
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const transformedUser = {
      _id: user._id,
      name: user.userType === 'vendor' ? user.companyName : user.name,
      email: user.email || '',
      phone: user.phone,
      userType: user.userType,
      type: user.userType.charAt(0).toUpperCase() + user.userType.slice(1),
      status: user.verificationStatus.charAt(0).toUpperCase() + user.verificationStatus.slice(1),
      join: user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '',
      createdAt: user.createdAt,
      plan: 'Basic',
      lastActive: 'Recently',
      avatar: user.profileImage || (user.userType === 'vendor' ? user.companyLogo : 'https://randomuser.me/api/portraits/lego/1.jpg'),
      city: user.city,
      role: user.role || (user.userType === 'vendor' ? 'Vendor' : 'Worker'),
      experience: user.experience,
      verified: user.isVerified,
      twoFactor: false,
      lastPasswordChange: 'Unknown',
      accountStatus: user.verificationStatus.toUpperCase(),
      department: user.userType === 'vendor' ? 'Vendor' : 'Worker',
      location: user.city ? `${user.city}, India` : 'Unknown',
      employeeId: `SL-${user._id.toString().slice(-4)}`,
      adminRating: user.adminRating || null,
      adminRatingComment: user.adminRatingComment || null,
      ratedAt: user.ratedAt || null,
      ...(user.userType === 'worker' && {
        age: user.age,
        dailyRate: user.dailyRate,
        aadhaarFrontImage: user.aadhaarFrontImage,
        aadhaarBackImage: user.aadhaarBackImage,
        medicalCertificate: user.medicalCertificate,
        certificates: user.certificates,
        skills: user.skills
      }),
      ...(user.userType === 'vendor' && {
        ownerName: user.ownerName,
        gstNumber: user.gstNumber,
        panNumber: user.panNumber,
        licenseNumber: user.licenseNumber,
        panCardImage: user.panCardImage,
        companyLogo: user.companyLogo,
        projectTypes: user.projectTypes,
      })
    };

    return res.json({ success: true, data: transformedUser });
  } catch (error) {
    console.error('getUserDetails error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
