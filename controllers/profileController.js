const PlatformSettings = require('../models/PlatformSettings');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const fs = require('fs');

// Get Profile
exports.getProfile = async (req, res) => {
  try {
    // Check if user is from AdminUser model (has permissions object)
    if (req.user.permissions) {
      return res.json({
        success: true,
        user: {
          id: req.user._id,
          name: req.user.name,
          email: req.user.email,
          role: 'admin_user',
          profileImage: req.user.profileImage,
          permissions: req.user.permissions,
          createdAt: req.user.createdAt
        }
      });
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Return appropriate response based on user type
    if (user.role === 'admin' || user.role === 'super_admin') {
      return res.json({
        success: true,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          profileImage: user.profileImage,
          createdAt: user.createdAt
        }
      });
    }

    // Regular User response
    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        userType: user.userType,
        role: user.role,
        profileImage: user.profileImage,
        aadhaarFrontImage: user.aadhaarFrontImage,
        aadhaarBackImage: user.aadhaarBackImage,
        medicalCertificate: user.medicalCertificate,
        panCardImage: user.panCardImage,
        city: user.city,
        dailyRate: user.dailyRate,
        aadhaarNumber: user.aadhaarNumber,
        experience: user.experience,
        skills: user.skills,
        companyLogo: user.companyLogo,
        ownerName: user.ownerName,
        companyName: user.companyName,
        panNumber: user.panNumber,
        gstNumber: user.gstNumber,
        licenseNumber: user.licenseNumber,
        projectTypes: user.projectTypes,
        certificates: user.certificates,
        isVerified: user.isVerified,
        verificationStatus: user.verificationStatus,
        verificationRejectedReason: user.verificationRejectedReason,
        verificationReviewedAt: user.verificationReviewedAt,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Change Password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Please provide current and new password' });
    }

    const user = await User.findById(req.user.id).select('+password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create Profile - Customer
exports.createCustomerProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.userType !== 'customer') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { name, email, city, role } = req.body;
    if (!role) {
      return res.status(400).json({ success: false, message: 'Role is required' });
    }
    if (name) user.name = name;
    if (email) user.email = email;
    if (city) user.city = city;
    user.role = role;

    if (req.files?.profileImage) user.profileImage = req.files.profileImage[0].path;

    await user.save();

    res.json({
      success: true,
      message: 'Customer profile created successfully',
      user: { id: user._id, name: user.name, phone: user.phone, email: user.email, userType: user.userType, role: user.role, profileImage: user.profileImage, city: user.city }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create Profile - Worker
exports.createWorkerProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user || user.userType !== 'worker') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const mandatoryDocuments = await PlatformSettings.getOrCreateSettings().then(settings => settings.verificationRules.worker);

    const fieldMap = {
      idProof: () => req.files?.aadhaarFrontImage?.[0] && req.files?.aadhaarBackImage?.[0],
      age: () => req.body?.age && parseInt(req.body.age) > 0,
      medicalCertificate: () => req.files?.medicalCertificate?.[0]
    };

    const rule = Object.entries(mandatoryDocuments);

    for (const [key, value] of rule) {
      if (value) {
        const validator = fieldMap[key];
        if (!validator) {
          console.warn(`No validator found for mandatory field: ${key}`);
          continue;
        }
        if (!validator()) {
          return res.status(400).json({
            success: false,
            message: `Missing or invalid mandatory document: ${key}`
          });
        }
      }
    }

    const { name, email, city, dailyRate, aadhaarNumber, experience, skills, role } = req.body;
    if (!role) {
      return res.status(400).json({ success: false, message: 'Role is required' });
    }
    if (name) user.name = name;
    if (email) user.email = email;
    if (city) user.city = city;
    if (dailyRate) user.dailyRate = dailyRate;
    if (aadhaarNumber) user.aadhaarNumber = aadhaarNumber;
    if (experience) user.experience = experience;
    if (skills) user.skills = typeof skills === 'string' ? JSON.parse(skills) : skills;
    user.role = role;

    if (req.files) {
      if (req.files.profileImage) user.profileImage = req.files.profileImage[0].path;
      if (req.files.aadhaarFrontImage) user.aadhaarFrontImage = req.files.aadhaarFrontImage[0].path;
      if (req.files.aadhaarBackImage) user.aadhaarBackImage = req.files.aadhaarBackImage[0].path;
      if (req.files.medicalCertificate) user.medicalCertificate = req.files.medicalCertificate[0].path;
      if (req.files.certificateImages) {
        user.certificates = req.files.certificateImages.map(file => file.path);
      }
    }

    await user.save();

    res.json({
      success: true,
      message: 'Worker profile created successfully',
      user: { id: user._id, name: user.name, phone: user.phone, email: user.email, userType: user.userType, role: user.role, profileImage: user.profileImage, city: user.city, dailyRate: user.dailyRate, aadhaarNumber: user.aadhaarNumber, experience: user.experience, skills: user.skills }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create Profile - Vendor
exports.createVendorProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.userType !== 'vendor') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const mandatoryDocuments = await PlatformSettings.getOrCreateSettings().then(settings => settings.verificationRules.vendor);

    const fieldMap = {
      gstNumber: () => req.body?.gstNumber,
      licenseNumber: () => req.body?.licenseNumber,
      ownerName: () => req.files?.ownerName
    };

    const rule = Object.entries(mandatoryDocuments);

    for (const [key, value] of rule) {
      if (value && !fieldMap[key]()) {
        return res.status(400).json({
          success: false,
          message: `Missing mandatory document: ${key}`
        });
      }
    }

    const { name, email, city, ownerName, companyName, panNumber, gstNumber, licenseNumber, projectTypes, role, whatsappNumber, website } = req.body;
    if (!role) {
      return res.status(400).json({ success: false, message: 'Role is required' });
    }
    if (!whatsappNumber) {
      return res.status(400).json({ success: false, message: 'WhatsApp number is required for vendors' });
    }
    if (!website) {
      return res.status(400).json({ success: false, message: 'Website is required for vendors' });
    }
    if (name) user.name = name;
    if (email) user.email = email;
    if (city) user.city = city;
    if (ownerName) user.ownerName = ownerName;
    if (companyName) user.companyName = companyName;
    if (panNumber) user.panNumber = panNumber;
    if (gstNumber) user.gstNumber = gstNumber;
    if (licenseNumber) user.licenseNumber = licenseNumber;
    if (whatsappNumber) user.whatsappNumber = whatsappNumber;
    if (website) user.website = website;
    if (projectTypes) user.projectTypes = typeof projectTypes === 'string' ? JSON.parse(projectTypes) : projectTypes;
    user.role = role;

    if (req.files) {
      if (req.files.profileImage) user.profileImage = req.files.profileImage[0].path;
      if (req.files.companyLogo) user.companyLogo = req.files.companyLogo[0].path;
      if (req.files.panCardImage) user.panCardImage = req.files.panCardImage[0].path;
    }

    await user.save();

    res.json({
      success: true,
      message: 'Vendor profile created successfully',
      user: { id: user._id, name: user.name, phone: user.phone, email: user.email, userType: user.userType, role: user.role, profileImage: user.profileImage, city: user.city, ownerName: user.ownerName, companyName: user.companyName, panNumber: user.panNumber, gstNumber: user.gstNumber, licenseNumber: user.licenseNumber, projectTypes: user.projectTypes, companyLogo: user.companyLogo }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Edit Profile - Customer
exports.editCustomerProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.userType !== 'customer') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { name, email, city } = req.body;
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (city) updateData.city = city;

    if (req.files?.profileImage) {
      if (user.profileImage) fs.unlink(user.profileImage, () => { });
      updateData.profileImage = req.files.profileImage[0].path;
    }

    Object.assign(user, updateData);
    await user.save();

    res.json({
      success: true,
      message: 'Customer profile updated successfully',
      user: { id: user._id, name: user.name, phone: user.phone, email: user.email, userType: user.userType, profileImage: user.profileImage, city: user.city }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Edit Profile - Worker
exports.editWorkerProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.userType !== 'worker') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const mandatoryDocuments = await PlatformSettings.getOrCreateSettings().then(settings => settings.verificationRules.worker);

    const fieldMap = {
      idProof: () => req.files?.aadhaarFrontImage && req.files?.aadhaarBackImage,
      age: () => req.body?.age,
      medicalCertificate: () => req.files?.medicalCertificate
    };

    const rule = Object.entries(mandatoryDocuments);

    for (const [key, value] of rule) {
      if (value && !fieldMap[key]()) {
        return res.status(400).json({
          success: false,
          message: `Missing mandatory document: ${key}`
        });
      }
    }

    const { name, email, city, dailyRate, aadhaarNumber, experience, skills } = req.body;
    const updateData = {};
    let documentsUpdated = false;

    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (city) updateData.city = city;
    if (dailyRate) updateData.dailyRate = dailyRate;
    if (aadhaarNumber) {
      updateData.aadhaarNumber = aadhaarNumber;
      documentsUpdated = true;
    }
    if (experience) updateData.experience = experience;
    if (skills) updateData.skills = typeof skills === 'string' ? JSON.parse(skills) : skills;

    if (req.files) {
      if (req.files.profileImage) {
        if (user.profileImage) fs.unlink(user.profileImage, () => { });
        updateData.profileImage = req.files.profileImage[0].path;
      }
      if (req.files.aadhaarFrontImage) {
        if (user.aadhaarFrontImage) fs.unlink(user.aadhaarFrontImage, () => { });
        updateData.aadhaarFrontImage = req.files.aadhaarFrontImage[0].path;
        documentsUpdated = true;
      }
      if (req.files.aadhaarBackImage) {
        if (user.aadhaarBackImage) fs.unlink(user.aadhaarBackImage, () => { });
        updateData.aadhaarBackImage = req.files.aadhaarBackImage[0].path;
        documentsUpdated = true;
      }
      if (req.files.medicalCertificate) {
        if (user.medicalCertificate) fs.unlink(user.medicalCertificate, () => { });
        updateData.medicalCertificate = req.files.medicalCertificate[0].path;
        documentsUpdated = true;
      }
      if (req.files.certificateImages) {
        updateData.certificates = req.files.certificateImages.map(file => file.path);
        documentsUpdated = true;
      }
    }

    Object.assign(user, updateData);

    if (documentsUpdated) {
      user.verificationStatus = 'pending';
      user.verificationRejectedReason = null;
      user.verificationReviewedAt = null;
    }

    await user.save();

    res.json({
      success: true,
      message: 'Worker profile updated successfully',
      user: { id: user._id, name: user.name, phone: user.phone, email: user.email, userType: user.userType, profileImage: user.profileImage, city: user.city, dailyRate: user.dailyRate, aadhaarNumber: user.aadhaarNumber, experience: user.experience, skills: user.skills }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Edit Profile - Vendor
exports.editVendorProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.userType !== 'vendor') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const mandatoryDocuments = await PlatformSettings.getOrCreateSettings().then(settings => settings.verificationRules.vendor);

    const fieldMap = {
      gstNumber: () => req.body?.gstNumber,
      licenseNumber: () => req.body?.licenseNumber,
      ownerName: () => req.files?.ownerName
    };

    const rule = Object.entries(mandatoryDocuments);

    for (const [key, value] of rule) {
      if (value && !fieldMap[key]()) {
        return res.status(400).json({
          success: false,
          message: `Missing mandatory document: ${key}`
        });
      }
    }

    const { name, email, city, ownerName, companyName, panNumber, gstNumber, licenseNumber, projectTypes, whatsappNumber, website } = req.body;
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (city) updateData.city = city;
    if (ownerName) updateData.ownerName = ownerName;
    if (companyName) updateData.companyName = companyName;
    if (panNumber) updateData.panNumber = panNumber;
    if (gstNumber) updateData.gstNumber = gstNumber;
    if (licenseNumber) updateData.licenseNumber = licenseNumber;
    if (whatsappNumber) updateData.whatsappNumber = whatsappNumber;
    if (website) updateData.website = website;
    if (projectTypes) updateData.projectTypes = typeof projectTypes === 'string' ? JSON.parse(projectTypes) : projectTypes;

    if (req.files) {
      if (req.files.profileImage) {
        if (user.profileImage) fs.unlink(user.profileImage, () => { });
        updateData.profileImage = req.files.profileImage[0].path;
      }
      if (req.files.companyLogo) {
        if (user.companyLogo) fs.unlink(user.companyLogo, () => { });
        updateData.companyLogo = req.files.companyLogo[0].path;
      }
      if (req.files.panCardImage) {
        if (user.panCardImage) fs.unlink(user.panCardImage, () => { });
        updateData.panCardImage = req.files.panCardImage[0].path;
      }
    }

    Object.assign(user, updateData);
    await user.save();

    res.json({
      success: true,
      message: 'Vendor profile updated successfully',
      user: { id: user._id, name: user.name, phone: user.phone, email: user.email, userType: user.userType, profileImage: user.profileImage, city: user.city, ownerName: user.ownerName, companyName: user.companyName, panNumber: user.panNumber, gstNumber: user.gstNumber, licenseNumber: user.licenseNumber, projectTypes: user.projectTypes, companyLogo: user.companyLogo }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create Profile - Admin
exports.createAdminProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { name, email } = req.body;
    if (name) user.name = name;
    if (email) user.email = email;

    if (req.files?.profileImage) user.profileImage = req.files.profileImage[0].path;

    await user.save();

    res.json({
      success: true,
      message: 'Admin profile created successfully',
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        role: user.role, 
        profileImage: user.profileImage 
      }
    });
  } catch (error) {
    console.error('Create admin profile error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Edit Profile - Admin
exports.editAdminProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    console.log('Found user:', user ? user._id : 'not found');
    
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { name, email } = req.body;
    if (name) user.name = name;
    if (email) user.email = email;

    if (req.files?.profileImage) {
      console.log('New profile image uploaded:', req.files.profileImage[0].path);
      if (user.profileImage) {
        fs.unlink(user.profileImage, (err) => {
          if (err) console.error('Error deleting old profile image:', err);
        });
      }
      user.profileImage = req.files.profileImage[0].path;
    }

    await user.save();
    console.log('User saved successfully with profileImage:', user.profileImage);

    res.json({
      success: true,
      message: 'Admin profile updated successfully',
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        role: user.role, 
        profileImage: user.profileImage 
      }
    });
  } catch (error) {
    console.error('Edit admin profile error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
