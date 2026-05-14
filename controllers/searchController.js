const User = require('../models/User');
const Job = require('../models/job');
const HelpSupport = require('../models/HelpSupport');

// @desc    Search and filter workers
// @route   GET /api/search/workers
// @access  Public
exports.searchWorkers = async (req, res) => {
  try {
    const {
      city,
      skills,
      experience,
      minRate,
      maxRate,
      search,
      sortBy,
      order,
      page = 1,
      limit = 10,
    } = req.query;

    let filter = { userType: 'worker' };

    // City filter
    if (city) {
      filter.city = { $regex: city, $options: 'i' };
    }

    // Skills filter - search in skills array
    if (skills) {
      const skillsArray = skills.split(',').map(skill => skill.trim());
      filter['skills.skillName'] = { $in: skillsArray.map(s => new RegExp(s, 'i')) };
    }

    // Experience filter
    if (experience) {
      filter.experience = experience;
    }

    // Daily rate range filter
    if (minRate || maxRate) {
      filter.dailyRate = {};
      if (minRate) filter.dailyRate.$gte = Number(minRate);
      if (maxRate) filter.dailyRate.$lte = Number(maxRate);
    }

    // General search - search by name, city
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
        { 'skills.skillName': { $regex: search, $options: 'i' } },
      ];
    }

    // Sorting
    let sort = {};
    if (sortBy) {
      sort[sortBy] = order === 'desc' ? -1 : 1;
    } else {
      sort.createdAt = -1; // Default sort by newest
    }

    // Pagination
    const skip = (page - 1) * limit;

    const workers = await User.find(filter)
      .select('-password -otp -otpExpire -otpAttempts -resetPasswordToken -resetPasswordExpire')
      .sort(sort)
      .limit(Number(limit))
      .skip(skip);

    const total = await User.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: workers.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      data: workers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message,
    });
  }
};

// @desc    Search and filter vendors
// @route   GET /api/search/vendors
// @access  Public
exports.searchVendors = async (req, res) => {
  try {
    const {
      city,
      projectTypes,
      search,
      isVerified,
      sortBy,
      order,
      page = 1,
      limit = 10,
    } = req.query;

    let filter = { userType: 'vendor' };

    // City filter
    if (city) {
      filter.city = { $regex: city, $options: 'i' };
    }

    // Project types filter
    if (projectTypes) {
      const typesArray = projectTypes.split(',').map(type => type.trim());
      filter.projectTypes = { $in: typesArray };
    }

    // Verified filter
    if (isVerified !== undefined) {
      filter.verificationStatus = isVerified === 'true' ? 'verified' : 'pending';
    }

    // General search - search by name, company name, owner name
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { companyName: { $regex: search, $options: 'i' } },
        { ownerName: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
      ];
    }

    // Sorting
    let sort = {};
    if (sortBy) {
      sort[sortBy] = order === 'desc' ? -1 : 1;
    } else {
      sort.createdAt = -1; // Default sort by newest
    }

    // Pagination
    const skip = (page - 1) * limit;

    const vendors = await User.find(filter)
      .select('-password -otp -otpExpire -otpAttempts -resetPasswordToken -resetPasswordExpire')
      .sort(sort)
      .limit(Number(limit))
      .skip(skip);

    const total = await User.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: vendors.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      data: vendors,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message,
    });
  }
};

// @desc    Search and filter jobs (enhanced)
// @route   GET /api/search/jobs
// @access  Public
exports.searchJobs = async (req, res) => {
  try {
    const {
      location,
      type,
      search,
      skills,
      company,
      sortBy,
      order,
      page = 1,
      limit = 10,
    } = req.query;

    let filter = {};

    // Location filter
    if (location) {
      filter.location = { $regex: location, $options: 'i' };
    }

    // Job type filter
    if (type) {
      filter.type = type;
    }

    // Company filter
    if (company) {
      filter.company = { $regex: company, $options: 'i' };
    }

    // Skills filter
    if (skills) {
      const skillsArray = skills.split(',').map(skill => skill.trim());
      filter.skills = { $in: skillsArray.map(s => new RegExp(s, 'i')) };
    }

    // General search
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { skills: { $regex: search, $options: 'i' } },
      ];
    }

    // Sorting
    let sort = {};
    if (sortBy) {
      sort[sortBy] = order === 'desc' ? -1 : 1;
    } else {
      sort.createdAt = -1; // Default sort by newest
    }

    // Pagination
    const skip = (page - 1) * limit;

    const jobs = await Job.find(filter)
      .populate('postedBy', 'name companyName')
      .sort(sort)
      .limit(Number(limit))
      .skip(skip);

    const total = await Job.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: jobs.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      data: jobs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message,
    });
  }
};

// @desc    Search help/support tickets
// @route   GET /api/search/support
// @access  Private/Admin
exports.searchSupport = async (req, res) => {
  try {
    // Additional check for admin role
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Access denied. Admin role required.' 
      });
    }

    const {
      search,
      email,
      phone,
      sortBy,
      order,
      page = 1,
      limit = 10,
    } = req.query;

    let filter = {};

    // Email filter
    if (email) {
      filter.email = { $regex: email, $options: 'i' };
    }

    // Phone filter
    if (phone) {
      filter.phone = { $regex: phone, $options: 'i' };
    }

    // General search
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } },
      ];
    }

    // Sorting
    let sort = {};
    if (sortBy) {
      sort[sortBy] = order === 'desc' ? -1 : 1;
    } else {
      sort.createdAt = -1; // Default sort by newest
    }

    // Pagination
    const skip = (page - 1) * limit;

    const tickets = await HelpSupport.find(filter)
      .populate('user', 'name email phone')
      .sort(sort)
      .limit(Number(limit))
      .skip(skip);

    const total = await HelpSupport.countDocuments(filter);

    res.status(200).json({
      success: true,
      count: tickets.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
      data: tickets,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message,
    });
  }
};

// @desc    Global search across all entities
// @route   GET /api/search/global
// @access  Public
exports.globalSearch = async (req, res) => {
  try {
    const { query, limit = 5 } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a search query',
      });
    }

    const searchRegex = { $regex: query, $options: 'i' };

    // Search workers
    const workers = await User.find({
      userType: 'worker',
      $or: [
        { name: searchRegex },
        { city: searchRegex },
        { 'skills.skillName': searchRegex },
      ],
    })
      .select('name city skills dailyRate experience profileImage')
      .limit(Number(limit));

    // Search vendors
    const vendors = await User.find({
      userType: 'vendor',
      $or: [
        { name: searchRegex },
        { companyName: searchRegex },
        { ownerName: searchRegex },
        { city: searchRegex },
      ],
    })
      .select('name companyName ownerName city projectTypes verificationStatus profileImage companyLogo')
      .limit(Number(limit));

    // Search jobs
    const jobs = await Job.find({
      $or: [
        { title: searchRegex },
        { company: searchRegex },
        { location: searchRegex },
        { skills: searchRegex },
      ],
    })
      .select('title company location type salary')
      .limit(Number(limit));

    res.status(200).json({
      success: true,
      data: {
        workers: {
          count: workers.length,
          results: workers,
        },
        vendors: {
          count: vendors.length,
          results: vendors,
        },
        jobs: {
          count: jobs.length,
          results: jobs,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message,
    });
  }
};

// @desc    Get filter options for workers
// @route   GET /api/search/workers/filters
// @access  Public
exports.getWorkerFilters = async (req, res) => {
  try {
    // Get unique cities
    const cities = await User.distinct('city', { userType: 'worker', city: { $ne: null } });

    // Get unique skills
    const workers = await User.find({ userType: 'worker' }).select('skills');
    const skillsSet = new Set();
    workers.forEach(worker => {
      worker.skills.forEach(skill => {
        if (skill.skillName) skillsSet.add(skill.skillName);
      });
    });

    // Get rate range
    const rateStats = await User.aggregate([
      { $match: { userType: 'worker', dailyRate: { $ne: null } } },
      {
        $group: {
          _id: null,
          minRate: { $min: '$dailyRate' },
          maxRate: { $max: '$dailyRate' },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        cities: cities.sort(),
        skills: Array.from(skillsSet).sort(),
        experiences: ['0-1 Year', '1-3 Years', '3-5 Years', '5+ Years'],
        rateRange: rateStats.length > 0 ? rateStats[0] : { minRate: 0, maxRate: 0 },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message,
    });
  }
};

// @desc    Get filter options for vendors
// @route   GET /api/search/vendors/filters
// @access  Public
exports.getVendorFilters = async (req, res) => {
  try {
    // Get unique cities
    const cities = await User.distinct('city', { userType: 'vendor', city: { $ne: null } });

    // Get unique project types
    const projectTypes = [
      'Residential Building',
      'Commercial Building',
      'Industrial Project',
      'Infrastructure',
      'Renovation',
      'Interior Design',
    ];

    res.status(200).json({
      success: true,
      data: {
        cities: cities.sort(),
        projectTypes,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message,
    });
  }
};

// @desc    Get filter options for jobs
// @route   GET /api/search/jobs/filters
// @access  Public
exports.getJobFilters = async (req, res) => {
  try {
    // Get unique locations
    const locations = await Job.distinct('location');

    // Get unique companies
    const companies = await Job.distinct('company');

    // Get unique skills
    const jobs = await Job.find().select('skills');
    const skillsSet = new Set();
    jobs.forEach(job => {
      job.skills.forEach(skill => {
        if (skill) skillsSet.add(skill);
      });
    });

    res.status(200).json({
      success: true,
      data: {
        locations: locations.sort(),
        companies: companies.sort(),
        skills: Array.from(skillsSet).sort(),
        types: ['Full-time', 'Part-time'],
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message,
    });
  }
};
