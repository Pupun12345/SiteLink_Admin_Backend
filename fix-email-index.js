const mongoose = require('mongoose');
require('dotenv').config();

const fixEmailIndex = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/sitelink');
    console.log('Connected to MongoDB');

    // Get the users collection
    const db = mongoose.connection.db;
    const collection = db.collection('users');

    // Check existing indexes
    console.log('\n📋 Current indexes:');
    const indexes = await collection.indexes();
    indexes.forEach(index => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key));
    });

    // Drop the old email_1 index
    console.log('\n🗑️  Dropping old email_1 index...');
    try {
      await collection.dropIndex('email_1');
      console.log('✅ Successfully dropped email_1 index');
    } catch (error) {
      if (error.codeName === 'IndexNotFound') {
        console.log('ℹ️  email_1 index not found (already dropped or never existed)');
      } else {
        throw error;
      }
    }
    
    // Create new sparse unique index on email
    console.log('\n🔧 Creating new sparse unique index on email...');
    await collection.createIndex(
      { email: 1 },
      { 
        unique: true, 
        sparse: true,
        name: 'email_1'
      }
    );
    console.log('✅ Successfully created sparse unique index on email');

    // Verify new indexes
    console.log('\n📋 Updated indexes:');
    const newIndexes = await collection.indexes();
    newIndexes.forEach(index => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key));
      if (index.name === 'email_1') {
        console.log(`    sparse: ${index.sparse}, unique: ${index.unique}`);
      }
    });

    console.log('\n✅ Email index fixed successfully!');
    console.log('   Now multiple users can register without providing email.\n');

  } catch (error) {
    console.error('❌ Error fixing email index:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
};

fixEmailIndex();
