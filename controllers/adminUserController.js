const AdminUser = require('../models/AdminUser');
const jwt = require('jsonwebtoken');

// Create new admin user
exports.createAdminUser = async (req, res) => {
  try {
    const { email, password, name, permissions } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ success: false, message: 'Email, password, and name are required' });
    }

    const existingAdmin = await AdminUser.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ success: false, message: 'Admin user already exists' });
    }

    const adminUser = await AdminUser.create({
      email,
      password,
      name,
      permissions: permissions || {},
      createdBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: 'Admin user created successfully',
      data: {
        id: adminUser._id,
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role,
        permissions: adminUser.permissions,
      },
    });
  } catch (error) {
    console.error('createAdminUser error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get all admin users
exports.getAllAdminUsers = async (req, res) => {
  try {
    const adminUsers = await AdminUser.find({ isActive: true })
      .select('email name role permissions createdAt lastLogin')
      .populate('createdBy', 'name email');

    return res.json({
      success: true,
      count: adminUsers.length,
      data: adminUsers,
    });
  } catch (error) {
    console.error('getAllAdminUsers error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Update admin user permissions
exports.updateAdminUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { permissions, name, isActive } = req.body;

    const adminUser = await AdminUser.findById(id);
    if (!adminUser) {
      return res.status(404).json({ success: false, message: 'Admin user not found' });
    }

    if (permissions) adminUser.permissions = { ...adminUser.permissions, ...permissions };
    if (name) adminUser.name = name;
    if (typeof isActive !== 'undefined') adminUser.isActive = isActive;

    await adminUser.save();

    return res.json({
      success: true,
      message: 'Admin user updated successfully',
      data: {
        id: adminUser._id,
        email: adminUser.email,
        name: adminUser.name,
        permissions: adminUser.permissions,
        isActive: adminUser.isActive,
      },
    });
  } catch (error) {
    console.error('updateAdminUser error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Delete admin user
exports.deleteAdminUser = async (req, res) => {
  try {
    const { id } = req.params;

    const adminUser = await AdminUser.findById(id);
    if (!adminUser) {
      return res.status(404).json({ success: false, message: 'Admin user not found' });
    }

    adminUser.isActive = false;
    await adminUser.save();

    return res.json({
      success: true,
      message: 'Admin user deleted successfully',
    });
  } catch (error) {
    console.error('deleteAdminUser error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Admin user login
exports.adminUserLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const adminUser = await AdminUser.findOne({ email, isActive: true }).select('+password');
    if (!adminUser) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await adminUser.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    adminUser.lastLogin = new Date();
    await adminUser.save();

    const token = jwt.sign(
      { id: adminUser._id, type: 'admin_user' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: adminUser._id,
        email: adminUser.email,
        name: adminUser.name,
        role: adminUser.role,
        permissions: adminUser.permissions,
      },
    });
  } catch (error) {
    console.error('adminUserLogin error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
