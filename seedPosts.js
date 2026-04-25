const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Post = require('./models/Post');
const User = require('./models/User');

dotenv.config();

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

const samplePosts = [
  {
    content: 'Looking for skilled carpenters for a residential project in Mumbai. Duration: 2 months. Good pay and accommodation provided.',
    category: 'work',
    posterType: 'vendor',
    verification: 'verified',
    approvalStatus: 'pending',
  },
  {
    content: 'Just completed my plumbing certification! Ready to take on new projects. Available for both residential and commercial work.',
    category: 'skill',
    posterType: 'worker',
    verification: 'verified',
    approvalStatus: 'pending',
  },
  {
    content: 'Important: New safety regulations for construction sites effective from next month. All workers must complete the safety training.',
    category: 'announcement',
    posterType: 'admin',
    verification: 'verified',
    approvalStatus: 'pending',
  },
  {
    content: 'Need electricians for a commercial building project in Bangalore. Must have 3+ years experience. Contact for details.',
    category: 'work',
    posterType: 'vendor',
    verification: 'verified',
    approvalStatus: 'pending',
  },
  {
    content: 'Successfully completed a major renovation project! Thanks to the amazing team. Here are some photos of our work.',
    category: 'general',
    posterType: 'worker',
    verification: 'unverified',
    approvalStatus: 'pending',
  },
  {
    content: 'Does anyone know good suppliers for construction materials in Delhi? Looking for competitive prices and quality products.',
    category: 'general',
    posterType: 'vendor',
    verification: 'verified',
    approvalStatus: 'pending',
  },
  {
    content: 'Offering free welding training sessions this weekend at our workshop. Limited seats available. First come first serve!',
    category: 'skill',
    posterType: 'vendor',
    verification: 'verified',
    approvalStatus: 'pending',
  },
  {
    content: 'Urgent requirement: Mason workers needed for a housing project in Pune. Immediate joining. Good daily wages.',
    category: 'work',
    posterType: 'vendor',
    verification: 'verified',
    approvalStatus: 'pending',
  },
  {
    content: 'Platform maintenance scheduled for this Sunday 2 AM - 6 AM. Services may be temporarily unavailable during this time.',
    category: 'announcement',
    posterType: 'admin',
    verification: 'verified',
    approvalStatus: 'pending',
  },
  {
    content: 'Just learned a new technique for tile installation. The results are amazing! Happy to share tips with fellow workers.',
    category: 'skill',
    posterType: 'worker',
    verification: 'verified',
    approvalStatus: 'pending',
  },
  {
    content: 'Looking for painting contractors for multiple residential units. Long-term project with steady work. Serious inquiries only.',
    category: 'work',
    posterType: 'vendor',
    verification: 'verified',
    approvalStatus: 'pending',
  },
  {
    content: 'What are the best practices for working in extreme heat conditions? Share your experiences and tips!',
    category: 'general',
    posterType: 'worker',
    verification: 'unverified',
    approvalStatus: 'pending',
  },
];

const seedPosts = async () => {
  try {
    await connectDB();

    // Find users to assign posts to
    const workers = await User.find({ userType: 'worker' }).limit(5);
    const vendors = await User.find({ userType: 'vendor' }).limit(5);
    const admins = await User.find({ userType: 'admin' }).limit(2);

    if (workers.length === 0 && vendors.length === 0 && admins.length === 0) {
      console.log('No users found in database. Please create users first.');
      process.exit(1);
    }

    // Clear existing posts (optional)
    console.log('Clearing existing posts...');
    await Post.deleteMany({});

    // Create posts
    console.log('Creating sample posts...');
    const postsToCreate = [];

    for (const postData of samplePosts) {
      let user;
      
      if (postData.posterType === 'worker' && workers.length > 0) {
        user = workers[Math.floor(Math.random() * workers.length)];
      } else if (postData.posterType === 'vendor' && vendors.length > 0) {
        user = vendors[Math.floor(Math.random() * vendors.length)];
      } else if (postData.posterType === 'admin' && admins.length > 0) {
        user = admins[Math.floor(Math.random() * admins.length)];
      } else {
        // Fallback to any available user
        const allUsers = [...workers, ...vendors, ...admins];
        if (allUsers.length > 0) {
          user = allUsers[Math.floor(Math.random() * allUsers.length)];
        }
      }

      if (user) {
        postsToCreate.push({
          ...postData,
          postedBy: user._id,
          posterName: user.name,
          posterImage: user.profileImage || null,
          posterType: user.userType,
          companyName: user.companyName || user.ownerName || null,
          location: user.city || 'Mumbai',
          likesCount: Math.floor(Math.random() * 50),
          commentsCount: Math.floor(Math.random() * 20),
          shares: Math.floor(Math.random() * 10),
          createdAt: new Date(Date.now() - Math.random() * 3600000), // Random time within last hour
        });
      }
    }

    const createdPosts = await Post.insertMany(postsToCreate);
    console.log(`✅ Successfully created ${createdPosts.length} sample posts`);

    // Display summary
    console.log('\n📊 Posts Summary:');
    console.log(`- Pending posts: ${createdPosts.filter(p => p.approvalStatus === 'pending').length}`);
    console.log(`- Worker posts: ${createdPosts.filter(p => p.posterType === 'worker').length}`);
    console.log(`- Vendor posts: ${createdPosts.filter(p => p.posterType === 'vendor').length}`);
    console.log(`- Admin posts: ${createdPosts.filter(p => p.posterType === 'admin').length}`);

    console.log('\n✨ Sample posts created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding posts:', error);
    process.exit(1);
  }
};

seedPosts();
