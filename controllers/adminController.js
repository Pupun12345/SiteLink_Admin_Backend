const User = require('../models/User');
const PlatformSettings = require('../models/PlatformSettings');
const jobPost = require('../models/job');
const Post = require('../models/Post');

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
      'name age phone experience city dailyRate profileImage aadhaarFrontImage aadhaarBackImage medicalCertificate certificates verificationStatus verificationStatus skills userType adminRating adminRatingComment ratedAt'
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

exports.autoApprove = async (req, res) => {
  try {
    const { id } = req.params;
    let { rating } = req.body;

    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID format' });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (rating) {
      rating = parseFloat(rating);
      if (isNaN(rating) || rating < 0.1 || rating > 5.0) {
        return res.status(400).json({ success: false, message: 'Rating must be between 0.1 and 5.0' });
      }
      rating = Math.round(rating * 10) / 10;
    }

    // Set verification status
    user.verificationStatus = 'verified';
    user.isVerified = true;
    user.verificationRejectedReason = null;
    user.verificationReviewedAt = new Date();

    // Set rating if provided
    if (rating) {
      user.adminRating = rating;
      user.ratedAt = new Date();
    }

    await user.save({ validateModifiedOnly: true });

    return res.json({
      success: true,
      message: `${user.userType.charAt(0).toUpperCase() + user.userType.slice(1)} verified and rated successfully`,
      data: {
        id: user._id,
        verificationStatus: user.verificationStatus,
        isVerified: user.isVerified,
        adminRating: user.adminRating,
        ratedAt: user.ratedAt,
      },
    });
  } catch (error) {
    console.error('autoApprove error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}


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

// Add skills to worker (admin only)
exports.addSkillsToWorker = async (req, res) => {
  try {
    const { id } = req.params;
    const { skills } = req.body;

    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID format' });
    }

    if (!skills || !Array.isArray(skills) || skills.length === 0) {
      return res.status(400).json({ success: false, message: 'Skills array is required' });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.userType !== 'worker') {
      return res.status(400).json({ success: false, message: 'Can only add skills to workers' });
    }

    // Merge new skills with existing ones, avoiding duplicates
    const existingSkillIds = user.skills.map(s => s.skillId);
    const newSkills = skills.filter(skill => !existingSkillIds.includes(skill.skillId));

    user.skills = [...user.skills, ...newSkills];
    await user.save({ validateModifiedOnly: true });

    return res.json({
      success: true,
      message: 'Skills added successfully',
      data: {
        id: user._id,
        skills: user.skills,
      },
    });
  } catch (error) {
    console.error('addSkillsToWorker error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Remove skill from worker (admin only)
exports.removeSkillFromWorker = async (req, res) => {
  try {
    const { id, skillId } = req.params;

    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID format' });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.userType !== 'worker') {
      return res.status(400).json({ success: false, message: 'Can only remove skills from workers' });
    }

    user.skills = user.skills.filter(skill => skill.skillId !== parseInt(skillId));
    await user.save({ validateModifiedOnly: true });

    return res.json({
      success: true,
      message: 'Skill removed successfully',
      data: {
        id: user._id,
        skills: user.skills,
      },
    });
  } catch (error) {
    console.error('removeSkillFromWorker error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get list of vendors pending document verification
exports.getPendingVendors = async (req, res) => {
  try {
    const vendors = await User.find({
      userType: 'vendor',
      verificationStatus: 'pending',
    }).select('companyName ownerName phone city companyLogo verificationStatus createdAt email gstNumber whatsappNumber website');

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
      'companyName name phone city companyLogo verificationStatus createdAt email gstNumber adminRating profileImage whatsappNumber website role workArea workState'
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
      'companyName name phone email city gstNumber companyLogo verificationStatus verificationStatus userType adminRating adminRatingComment ratedAt whatsappNumber website role workArea workState profileImage'
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

    const query = { isProfileCreated: true };

    if (userType && userType !== "all") {
      query.userType = userType;
    }

    if (status && status !== "all") {
      query.verificationStatus = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(query)
      .select(`
        name email phone userType verificationStatus createdAt
        profileImage companyName companyLogo city workState
        role website experience adminRating
        workArea gstNumber whatsappNumber primarySkill
        skills willingtoRelocate salaryType salary dateOfBirth gender
      `)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    const transformedUsers = users.map((user) => {
      const commonFields = {
        _id: user._id,
        profileImage: user.profileImage,
        name: user.name,
        email: user.email,
        phone: user.phone,
        userType: user.userType,
        city: user.city,
        workState: user.workState,
        adminRating: user.adminRating,
        verificationStatus:
          user.verificationStatus?.charAt(0).toUpperCase() +
          user.verificationStatus?.slice(1),
        join: user.createdAt
          ? new Date(user.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
          : "",
      };

      if (user.userType === "vendor") {
        return {
          ...commonFields,
          companyLogo: user.companyLogo,
          companyName: user.companyName,
          designation: user.role,
          workArea: user.workArea,
          website: user.website,
          gstNumber: user.gstNumber,
          whatsappNumber: user.whatsappNumber,
        };
      }

      return {
        ...commonFields,
        role: user.role,
        primarySkill: user.primarySkill,
        additionalSkills: user.skills,
        willingtoRelocate: user.willingtoRelocate,
        experience: user.experience,
        salaryType: user.salaryType,
        salary: user.salary,
        location: user.location,
        gender: user.gender,
        dateOfBirth: user.dateOfBirth
      };
    });

    return res.status(200).json({
      success: true,
      count: transformedUsers.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      data: transformedUsers,
    });
  } catch (error) {
    console.error("getAllUsers error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// GET ALL VENDORS AND WORKERS
exports.getAllWorkersAndVendors = async (req, res) => {
  try {
    const { userType, status, page = 1, limit = 10 } = req.query;

    const query = {};

    if (userType && userType !== "all") {
      query.userType = userType;
    }

    if (status && status !== "all") {
      query.verificationStatus = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(query)
      .select(`
        name email phone userType verificationStatus createdAt
        profileImage companyName companyLogo city workState
        role website experience adminRating
        workArea gstNumber whatsappNumber primarySkill
        skills willingtoRelocate salaryType salary
      `)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    const transformedUsers = users.map((user) => {
      const commonFields = {
        _id: user._id,
        profileImage: user.profileImage,
        name: user.name,
        email: user.email,
        phone: user.phone,
        userType: user.userType,
        city: user.city,
        workState: user.workState,
        adminRating: user.adminRating,
        isVerified: user.isVerified,
        verificationRejectedReason: user.verificationRejectedReason,
        verificationStatus:
          user.verificationStatus?.charAt(0).toUpperCase() +
          user.verificationStatus?.slice(1),
        join: user.createdAt
          ? new Date(user.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
          : "",
      };

      if (user.userType === "vendor") {
        return {
          ...commonFields,
          companyLogo: user.companyLogo,
          companyName: user.companyName,
          designation: user.role,
          workArea: user.workArea,
          website: user.website,
          gstNumber: user.gstNumber,
          whatsappNumber: user.whatsappNumber,
        };
      }

      return {
        ...commonFields,
        role: user.role,
        primarySkill: user.primarySkill,
        additionalSkills: user.skills,
        willingtoRelocate: user.willingtoRelocate,
        experience: user.experience,
        salaryType: user.salaryType,
        salary: user.salary,
        location: user.location
      };
    });

    return res.status(200).json({
      success: true,
      count: transformedUsers.length,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      data: transformedUsers,
    });
  } catch (error) {
    console.error("getAllUsers error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Get user details for admin user profile view
exports.getUserDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const regularUser = await User.findById(id);
    let jobs;
    let postedBy = id;

    if (regularUser && regularUser.userType == "vendor") {
      jobs = await jobPost.find({ postedBy });
    }

    if (!regularUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const Posts = await Post.find({ postedBy: regularUser._id }).sort({ createdAt: -1 });

    const user = regularUser.userType === 'worker'
      ? {
        id: regularUser._id,
        name: regularUser.name,
        email: regularUser.email,
        role: regularUser.role,
        phone: regularUser.phone,
        profileImage: regularUser.profileImage,
        primarySkill: regularUser.primarySkill,
        skills: regularUser.skills,
        willingtoRelocate: regularUser.willingtoRelocate,
        posts: Posts,
        workCity: regularUser.city,
        workState: regularUser.workState,
        userType: regularUser.userType,
        createdAt: regularUser.createdAt,
        location: regularUser.location,
        salaryType: regularUser.salaryType,
        salary: regularUser.salary,
        experience: regularUser.experience,
        gender:regularUser.gender,
        dateOfBirth:regularUser.dateOfBirth,
        age: regularUser.age,
        governmentID: regularUser.governmentID,
        workSamplesPhoto: regularUser.workSamplesPhoto,
        certificates: regularUser.certificates,
        verificationStatus: regularUser.verificationStatus,
        experienceDescription: regularUser.experienceDescription,
        documents: [
          {
            name: 'Aadhaar Front',
            type: 'NATIONAL ID PROOF',
            url: regularUser.aadhaarFrontImage,
          },
          {
            name: 'Aadhaar Back',
            type: 'ID BACK',
            url: regularUser.aadhaarBackImage,
          },
          {
            name: 'Medical Certificate',
            type: 'HEALTH CLEARANCE',
            url: regularUser.medicalCertificate,
          },
          {
            name: 'Government ID',
            type: 'IDENTITY PROOF',
            url: regularUser.governmentID,
          },
          {
            name: 'Experience Certificate',
            type: 'EXPERIENCE PROOF',
            url: regularUser.experienceCertificate,
          },
        ],
        workPhotos: Posts,
        contactInfo: {
          email: regularUser.email,
          phone: regularUser.phone,
        },
        adminRating: regularUser.adminRating,
        adminRatingComment: regularUser.adminRatingComment,
        ratedAt: regularUser.ratedAt ? new Date(regularUser.ratedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null,

      }
      : {
        id: regularUser._id,
        name: regularUser.name,
        email: regularUser.email,
        role: regularUser.role,
        profileImage: regularUser.profileImage,
        userType: regularUser.userType,
        createdAt: regularUser.createdAt,
        workCity: regularUser.city,
        workState: regularUser.workState,
        phone: regularUser.phone,
        gstNumber: regularUser.gstNumber,
        companyName: regularUser.companyName,
        companyLogo: regularUser.companyLogo,
        designation: regularUser.role,
        workArea: regularUser.workArea,
        whatsappNumber: regularUser.whatsappNumber,
        website: regularUser.website,
        verificationStatus: regularUser.verificationStatus,
        adminRating: regularUser.adminRating,
        adminRatingComment: regularUser.adminRatingComment,
        ratedAt: regularUser.ratedAt,
        jobPosts: jobs
      };

    return res.json({
      success: true,
      data: user,
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Update user details (admin only)
exports.updateUserDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID format' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Update allowed fields based on user type
    let allowedFields = ['name', 'email', 'phone', 'workCity', 'workState', 'location', 'role', 'primarySkill',
      'experience', 'salary', 'salaryType', 'willingtoRelocate'];

    if (user.userType === 'vendor') {
      allowedFields.push('companyName', 'gstNumber', 'workArea', 'whatsappNumber', 'website');
    }

    allowedFields.forEach(field => {
      if (updates[field] !== undefined && updates[field] !== null) {
        // Special handling for willingtoRelocate boolean
        if (field === 'willingtoRelocate') {
          user[field] = updates[field] === true || updates[field] === 'true';
        } else {
          user[field] = updates[field];
        }
      }
    });

    await user.save({ validateModifiedOnly: true });

    return res.json({
      success: true,
      message: 'User details updated successfully',
      data: user,
    });
  } catch (error) {
    console.error('updateUserDetails error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Delete user (admin only)
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID format' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Delete user's uploaded files
    const filesToDelete = [
      user.profileImage,
      user.aadhaarFrontImage,
      user.aadhaarBackImage,
      user.medicalCertificate,
      user.governmentID,
      user.experienceCertificate,
      user.companyLogo,
      user.panCardImage,
      ...(user.workSamplesPhoto || [])
    ].filter(Boolean);

    filesToDelete.forEach(filePath => {
      const fs = require('fs');
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });

    await User.findByIdAndDelete(id);

    return res.json({
      success: true,
      message: `${user.userType.charAt(0).toUpperCase() + user.userType.slice(1)} deleted successfully`,
    });
  } catch (error) {
    console.error('deleteUser error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};