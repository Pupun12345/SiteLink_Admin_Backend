const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');

const resetPassword = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const email = 'admin@sitelink.in';
    const newPassword = 'Admin@123'; // Change this to your desired password

    console.log('Resetting password for:', email);
    console.log('New password will be:', newPassword);
    console.log('==========================================\n');

    // Find admin user
    const admin = await User.findOne({ email: email.toLowerCase() });

    if (!admin) {
      console.log('❌ Admin not found');
      process.exit(1);
    }

    console.log('✅ Admin found:', admin.name);

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password directly (bypassing the pre-save hook to avoid double hashing)
    await User.updateOne(
      { _id: admin._id },
      { $set: { password: hashedPassword } }
    );

    console.log('✅ Password updated successfully!\n');

    // Verify the password works
    const updatedAdmin = await User.findById(admin._id).select('+password');
    const isMatch = await bcrypt.compare(newPassword, updatedAdmin.password);

    if (isMatch) {
      console.log('✅ Password verification successful!\n');
      console.log('==========================================');
      console.log('YOU CAN NOW LOGIN WITH:');
      console.log('Email:', email);
      console.log('Password:', newPassword);
      console.log('==========================================\n');
    } else {
      console.log('❌ Password verification failed');
    }

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

resetPassword();
