const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');

const checkAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find admin user
    const admin = await User.findOne({ email: 'admin@sitelink.com' }).select('+password');

    if (!admin) {
      console.log('❌ No admin found with email: admin@sitelink.com\n');
      
      // Check if there are any admins
      const allAdmins = await User.find({ role: 'admin' });
      console.log(`Found ${allAdmins.length} admin(s) in total:`);
      allAdmins.forEach(a => {
        console.log(`  - Email: ${a.email}, Name: ${a.name}, Phone: ${a.phone}`);
      });
    } else {
      console.log('✅ Admin found!');
      console.log('==========================================');
      console.log('Name:', admin.name);
      console.log('Email:', admin.email);
      console.log('Phone:', admin.phone);
      console.log('Role:', admin.role);
      console.log('UserType:', admin.userType);
      console.log('isPhoneVerified:', admin.isPhoneVerified);
      console.log('isVerified:', admin.isVerified);
      console.log('verificationStatus:', admin.verificationStatus);
      console.log('Password Hash:', admin.password ? 'EXISTS' : 'MISSING');
      console.log('==========================================\n');
    }

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

checkAdmin();
