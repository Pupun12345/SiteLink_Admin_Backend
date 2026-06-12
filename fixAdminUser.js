const mongoose = require('mongoose');
require('dotenv').config();

const User = require('./models/User');

const fixAdminUser = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Update the existing admin user
    const result = await User.updateOne(
      { 
        email: 'admin@sitelink.com',
        role: 'admin' 
      },
      { 
        $set: { 
          isPhoneVerified: true,
          isVerified: true,
          verificationStatus: 'verified'
        } 
      }
    );

    if (result.matchedCount === 0) {
      console.log('❌ Admin user not found with email: admin@sitelink.com');
    } else if (result.modifiedCount > 0) {
      console.log('✅ Admin user updated successfully!');
      console.log('The admin can now login with:');
      console.log('Email: admin@sitelink.com');
      console.log('Password: (your existing password)');
    } else {
      console.log('ℹ️ Admin user already has correct settings');
    }

    process.exit(0);

  } catch (error) {
    console.error('❌ Error fixing admin user:', error);
    process.exit(1);
  }
};

fixAdminUser();
