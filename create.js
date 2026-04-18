const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();


const User = require('../SiteLink_Backend/models/User.js');

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const existingAdmin = await User.findOne({ email: 'admin@sitelink.in' });

    if (existingAdmin) {
      console.log('❌ Admin already exists');
      process.exit();
    }

    const hashedPassword = await bcrypt.hash('Admin@123', 10);

    const admin = new User({
      name: 'SiteLink Admin',
      email: 'admin@sitelink.in',
      phone: '9876585201',
      password: hashedPassword,
      role: 'admin',
      userType: 'admin',
      isVerified: true,
      verificationStatus: 'verified',
    });

    await admin.save();

    console.log('✅ Admin created successfully');
    process.exit();

  } catch (error) {
    console.error('❌ Error creating admin:', error);
    process.exit(1);
  }
};

createAdmin();