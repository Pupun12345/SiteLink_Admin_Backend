const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

const createAdminProfile = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('📡 Connected to database');

    const existingAdmin = await User.findOne({ email: 'admin@sitelink.co' });

    if (existingAdmin) {
      console.log('❌ Admin already exists');
      process.exit();
    }

    const admin = new User({
      name: 'Admin',
      email: 'admin@sitelink.co',
      phone: '9999999980',
      password: 'Admin@123',
      role: 'admin',
      userType: 'admin',
      isVerified: true,
      verificationStatus: 'verified',
      isProfileCreated: true,
    });

    await admin.save();
    console.log('✅ Admin created successfully');
    console.log('📧 Email: admin@sitelink.co');
    console.log('📱 Phone: 9999999980');
    console.log('🔑 Password: Admin@123');
    process.exit();

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

createAdminProfile();
