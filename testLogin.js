const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');

const testLogin = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const email = 'admin@sitelink.in';
    const testPassword = 'Rahuljee1@'; // Change this to your actual password

    console.log('Testing login for:', email);
    console.log('Testing with password:', testPassword);
    console.log('==========================================\n');

    // Find user with lowercase email
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user) {
      console.log('❌ User not found');
      process.exit(1);
    }

    console.log('✅ User found');
    console.log('User role:', user.role);
    console.log('User userType:', user.userType);

    if (user.role !== 'admin') {
      console.log('❌ User is not an admin');
      process.exit(1);
    }

    console.log('✅ User is admin\n');

    // Test password comparison
    console.log('Testing password...');
    const isMatch = await user.comparePassword(testPassword);
    
    if (isMatch) {
      console.log('✅ Password matches!');
      console.log('\n==========================================');
      console.log('LOGIN SHOULD WORK WITH:');
      console.log('Email:', email);
      console.log('Password:', testPassword);
      console.log('==========================================\n');
    } else {
      console.log('❌ Password does NOT match');
      console.log('\nTrying direct bcrypt comparison...');
      const directMatch = await bcrypt.compare(testPassword, user.password);
      console.log('Direct bcrypt result:', directMatch);
      
      console.log('\n⚠️  The password you entered is incorrect.');
      console.log('If you forgot the password, you need to reset it.');
    }

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

testLogin();
