const Job = require('../models/job');
const User = require('../models/User');
const Application = require('../models/Application');
const mongoose = require("mongoose");
const Amenity = require('../models/amenities');

// @desc    Get all jobs
// @route   GET /api/jobs
// @access  Public
exports.getJobs = async (req, res) => {
  try {
    const { location, salaryType, search } = req.query;

    let filter = { "approvalStatus": "approved" };

    if (location) {
      filter.location = { $regex: location, $options: 'i' };
    }

    if (salaryType) {
      filter.salaryType = salaryType;
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const jobs = await Job.find(filter)
      .populate("postedBy", "name companyName")
      .populate("amenities", "id name category icon")
      .sort({ createdAt: -1 });

    // Update applicationsCount for each job from Application collection
    const jobsWithCounts = await Promise.all(
      jobs.map(async (job) => {
        const count = await Application.countDocuments({ job: job._id });
        const jobObj = job.toObject();
        jobObj.applicationsCount = count;
        return jobObj;
      })
    );

    res.status(200).json({
      success: true,
      count: jobsWithCounts.length,
      data: jobsWithCounts,
    });
  } catch (error) {
    console.error("GET JOB ERROR:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};


// @desc    Get single job by ID with applicants
// @route   GET /api/jobs/:id
// @access  Public
exports.getJobById = async (req, res) => {
  try {
    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Job ID",
      });
    }

    // Get job details
    const job = await Job.findById(req.params.id)
      .populate("postedBy", "name companyName")
      .populate("amenities", "id name category icon");

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    // Get applications for this job
    const applications = await Application.find({
      job: req.params.id,
    })
      .populate(
        "applicant",
        "name profileImage userType verificationStatus city workState salaryType salary experience skills phone email primarySkill"
      )
      .sort({ createdAt: -1 })
      .limit(10);

    // Transform applications data
    const transformedApplicants = applications
      .filter((application) => application.applicant) // avoid null applicants
      .map((application) => {
        const applicant = application.applicant;
        const timeApplied = application.createdAt;

        return {
          id: application._id,
          applicantId: applicant._id,
          name: applicant.name,

          role:
            applicant.primarySkill ||
              (
                applicant.skills &&
                applicant.skills.length > 0
              )
              ? (
                applicant.primarySkill ||
                applicant.skills[0]?.skillName ||
                "Worker"
              )
              : "Worker",

          status: application.status,
          applied: timeApplied,

          avatar:
            applicant.profileImage ||
            `https://ui-avatars.io/api/?name=${encodeURIComponent(
              applicant.name
            )}&background=random`,

          experience: applicant.experience || "Not specified",

          location: applicant.city || "Not specified",

          skills: applicant.skills
            ? applicant.skills.map((skill) =>
              typeof skill === "object"
                ? skill.skillName
                : skill
            )
            : [],

          phone: applicant.phone,
          email: applicant.email,

          dailyRate:
            applicant.dailyRate ||
            applicant.salary ||
            null,

          coverLetter: application.coverLetter,

          applicationExperience:
            application.experience,
        };
      });

    // Count all applications
    const actualApplicationsCount =
      await Application.countDocuments({
        job: req.params.id,
      });

    // Preserve existing response structure
    const jobData = {
      ...job.toJSON(),
      applicants: transformedApplicants,
      applicationsCount: actualApplicationsCount,
    };

    return res.status(200).json({
      success: true,
      data: jobData,
    });
  } catch (error) {
    console.error("GET JOB ERROR:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch job",
    });
  }
};


// @desc    Create a new job
// @route   POST /api/jobs
// @access  Private
exports.createJob = async (req, res) => {
  try {
    const { title, company, location, latitude, longitude, quantity, salary, salaryType, isUrgent, duration, description, experience, amenities } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        message: 'Account verification required for posting jobs. Please wait for your account to be verified before creating a job.'
      });
    }

    if (user.userType === 'worker' || user.userType === 'customer') {
      return res.status(403).json({
        success: false,
        message: 'Only Vendor or Admin can create jobs'
      });
    }

    if (!title || !company || !location || !description || !experience) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    if (salaryType && !['daily', 'weekly', 'monthly'].includes(salaryType.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid salary type.Salary type must be one of: daily, weekly, monthly',
      });
    }

    const parsedSalary = Number(salary);
    if (
      isNaN(parsedSalary) ||
      parsedSalary < 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid salary'
      });
    }

    if (experience && isNaN(experience)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Experience value.Experience must be a number'
      });
    }

    const exp = Number(experience);
    if (
      isNaN(exp) ||
      exp < 0 ||
      exp > 60
    ) {
      return res.status(400).json({
        success: false,
        message: 'Experience must be between 0 and 60 years'
      });
    }

    // Validate Amenities
    let amenityObjectIds = [];

    if (amenities && !Array.isArray(amenities)) {
      return res.status(400).json({
        success: false,
        message: "Amenities must be an array.",
      });
    }

    if (amenities && amenities.length > 0) {
      const Amenity = require('../models/amenities');
      const amenityDocs = await Amenity.find({
        _id: { $in: amenities },
      }).select("_id");

      if (amenityDocs.length !== amenities.length) {
        return res.status(400).json({
          success: false,
          message: "One or more selected amenities are invalid.",
        });
      }

      amenityObjectIds = amenityDocs.map((amenity) => amenity._id);
    }

    const workersNeeded = Number(quantity);
    if (
      isNaN(workersNeeded) ||
      workersNeeded <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be greater than 0'
      });
    }

    const job = await Job.create({
      title: title.trim(),
      company: company.trim(),
      location: location.trim(),
      latitude: latitude ? latitude.trim() : undefined,
      longitude: longitude ? longitude.trim() : undefined,
      quantity: workersNeeded.toString(),
      salary: parsedSalary,
      salaryType: salaryType,
      isUrgent: isUrgent || false,
      duration: duration ? duration.trim() : '',
      description: description.trim(),
      experience: exp.toString(),
      amenities:amenityObjectIds,
      postedBy: req.user.id,
      isActive: true,
      // Jobs are auto-approved now (no admin review workflow) — admin-created
      // jobs go live immediately, matching the app backend's behavior.
      approvalStatus: 'approved',
      approvedBy: req.user.id,
      approvedAt: new Date(),
    });

    res.status(201).json({
      success: true,
      data: job,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create job',
      error: error.message,
    });
  }
};

// @desc    Update job
// @route   PUT /api/jobs/:id
// @access  Private
exports.updateJob = async (req, res) => {
  try {
    const updateData = { ...req.body };

    if (updateData.amenities) {
      const validAmenities = await Amenity.countDocuments({
        _id: { $in: updateData.amenities },
      });

      if (validAmenities !== updateData.amenities.length) {
        return res.status(400).json({
          success: false,
          message: "Invalid amenities selected.",
        });
      }
    }

    const job = await Job.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    res.status(200).json({
      success: true,
      data: job,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'Failed to update job',
      error: error.message,
    });
  }
};

// @desc    Delete job
// @route   DELETE /api/jobs/:id
// @access  Private
exports.deleteJob = async (req, res) => {
  try {
    const job = await Job.findByIdAndDelete(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Job deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete job',
      error: error.message,
    });
  }
};

// Helper function to check and update job status
const checkAndUpdateJobStatus = async (jobId) => {
  try {
    const job = await Job.findById(jobId);
    if (!job) return;

    // Count accepted applications
    const acceptedCount = await Application.countDocuments({
      job: jobId,
      status: 'accepted'
    });

    const workersNeeded = parseInt(job.quantity) || 0;

    // If accepted applications meet or exceed quantity, mark as Filled
    if (acceptedCount >= workersNeeded && job.status !== 'Filled') {
      job.status = 'Filled';
      await job.save();
      console.log(`Job ${jobId} marked as Filled: ${acceptedCount}/${workersNeeded} workers`);
    }
  } catch (error) {
    console.error('Error checking job status:', error);
  }
};

// @desc    Update application status
// @route   PUT /api/jobs/:jobId/applications/:applicationId
// @access  Private
exports.updateApplicationStatus = async (req, res) => {
  try {
    const { jobId, applicationId } = req.params;
    const { status, notes } = req.body;
    const userId = req.user.id;

    // Check if job exists
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    if (job.postedBy.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this application',
      });
    }

    const application = await Application.findOneAndUpdate(
      { _id: applicationId, job: jobId },
      {
        status,
        notes,
        reviewedBy: userId,
        reviewedAt: new Date(),
      },
      { new: true }
    ).populate('applicant', 'name profileImage userType');

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found',
      });
    }

    // Check and update job status after application status change
    await checkAndUpdateJobStatus(jobId);

    res.status(200).json({
      success: true,
      message: 'Application status updated successfully',
      data: application,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update application status',
      error: error.message,
    });
  }
};

// @desc    Get applications for a job
// @route   GET /api/jobs/:id/applications
// @access  Private
exports.getJobApplications = async (req, res) => {
  try {
    const { id: jobId } = req.params;
    const { status, page = 1, limit = 10 } = req.query;
    const userId = req.user.id;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    if (job.postedBy.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view applications for this job',
      });
    }

    let filter = { job: jobId };
    if (status) {
      filter.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const applications = await Application.find(filter)
      .populate('applicant', 'name profileImage userType verificationStatus city dailyRate experience skills phone email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalApplications = await Application.countDocuments(filter);

    const transformedApplications = applications.map((application) => {
      const applicant = application.applicant;
      return {
        id: application._id,
        applicantId: applicant._id,
        name: applicant.name,
        role: applicant.primarySkill || (applicant.skills && applicant.skills.length > 0 ? applicant.skills[0].skillName : 'Worker'),
        status: application.status,
        applied: application.createdAt,
        avatar: applicant.profileImage || `https://ui-avatars.io/api/?name=${encodeURIComponent(applicant.name)}&background=random`,
        experience: applicant.experience || 'Not specified',
        location: applicant.city || 'Not specified',
        skills: applicant.skills ? applicant.skills.map(s => s.skillName) : [],
        phone: applicant.phone,
        email: applicant.email,
        dailyRate: applicant.dailyRate || applicant.salary,
        coverLetter: application.coverLetter,
        applicationExperience: application.experience
      };
    });

    res.status(200).json({
      success: true,
      data: {
        applications: transformedApplications,
        pagination: {
          total: totalApplications,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(totalApplications / parseInt(limit))
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch applications',
      error: error.message,
    });
  }
};

// @desc    Like/Unlike a job
// @route   PUT /api/jobs/:jobId/like
// @access  Private
exports.likeUnlikeJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.id;

    const job = await Job.findById(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    const likeIndex = job.likes.findIndex(like => like.userId.toString() === userId.toString());

    if (likeIndex > -1) {
      // Unlike
      job.likes.splice(likeIndex, 1);
      job.likesCount = Math.max(0, job.likesCount - 1);
    } else {
      // Like
      job.likes.push({
        userId: userId,
        likedAt: new Date(),
      });
      job.likesCount += 1;
    }

    await job.save();

    const updatedJob = await Job.findById(jobId)
      .populate('postedBy', 'name profileImage')
      .populate('likes.userId', 'name');

    res.status(200).json({
      success: true,
      message: likeIndex > -1 ? 'Job unliked' : 'Job liked',
      data: {
        _id: updatedJob._id,
        likesCount: updatedJob.likesCount,
        likes: updatedJob.likes,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error liking/unliking job',
      error: error.message,
    });
  }
};

// @desc    Add comment to a job
// @route   POST /api/jobs/:id/comments
// @access  Private
exports.addJobComment = async (req, res) => {
  try {
    const { id: jobId } = req.params;
    const { comment } = req.body;
    const userId = req.user.id;

    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Comment cannot be empty',
      });
    }

    if (comment.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Comment cannot exceed 500 characters',
      });
    }

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    const user = await User.findById(userId);
    const newComment = {
      userId,
      userName: user.name,
      userImage: user.profileImage,
      comment: comment.trim(),
      createdAt: new Date(),
    };

    job.comments.push(newComment);
    job.commentsCount = job.comments.length;
    await job.save();

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: newComment
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to add comment',
      error: error.message,
    });
  }
};

// @desc    Get comments for a job
// @route   GET /api/jobs/:id/comments
// @access  Public
exports.getJobComments = async (req, res) => {
  try {
    const { id: jobId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const comments = job.comments.slice(skip, skip + parseInt(limit));

    res.status(200).json({
      success: true,
      data: comments,
      pagination: {
        current: parseInt(page),
        limit: parseInt(limit),
        total: job.commentsCount,
        pages: Math.ceil(job.commentsCount / parseInt(limit))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch comments',
      error: error.message,
    });
  }
};

// @desc    Delete comment from job
// @route   DELETE /api/jobs/:jobId/comments/:commentId
// @access  Private
exports.deleteJobComment = async (req, res) => {
  try {
    const { jobId, commentId } = req.params;
    const userId = req.user.id;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    const commentIndex = job.comments.findIndex(c => c._id.toString() === commentId);
    if (commentIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    const user = await User.findById(userId);
    if (job.comments[commentIndex].userId.toString() !== userId.toString() && user.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this comment',
      });
    }

    job.comments.splice(commentIndex, 1);
    job.commentsCount = job.comments.length;
    await job.save();

    res.status(200).json({
      success: true,
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete comment',
      error: error.message,
    });
  }
};


exports.fetchAllAmenities = async (req, res) => {
  try {
    const data = await Amenity.find().sort({ category: 1, id: 1 });
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch amenities",
      error: error.message,
    });
  }
};

exports.getGroupedAmenities = async (req, res) => {
  try {
    const data = await Amenity
      .find()
      .sort({ category: 1, id: 1 })
      .select("_id id name category icon");

    const grouped = {};

    data.forEach((amenity) => {
      if (!grouped[amenity.category]) {
        grouped[amenity.category] = {
          category: amenity.category,
          icon: amenity.icon,
          amenities: [],
        };
      }

      grouped[amenity.category].amenities.push({
        _id: amenity._id,
        id: amenity.id,
        name: amenity.name,
      });
    });

    return res.status(200).json({
      success: true,
      data: Object.values(grouped),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch amenities",
      error: error.message,
    });
  }
};

exports.getAllCategories = async (req, res) => {
  try {
    const categories = await Amenity.distinct("category");
    return res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.addAmenities = async (req, res) => {
  try {
    const { name, category } = req.body;

    const userId = req.user.id;

    const user = await User.findById(userId).select("userType");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (
      user.userType === "worker" ||
      user.userType === "customer"
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to add amenities",
      });
    }

    const CATEGORY_ICONS = {
      "Financial Benefits": "💰",
      "Accommodation & Food": "🏠",
      "Travel": "🚌",
      "Safety & Medical": "🛡️",
      "Leave": "📅",
      "Work & Career": "📈",
      "Employee Rewards": "🏆",
    };

    if (!CATEGORY_ICONS[category]) {
      return res.status(400).json({
        success: false,
        message: "Invalid category",
      });
    }

    const existingAmenity = await Amenity.findOne({ name });

    if (existingAmenity) {
      return res.status(400).json({
        success: false,
        message: "Amenity already exists",
      });
    }

    const lastAmenity = await Amenity.findOne().sort({ id: -1 });

    const nextId = lastAmenity ? lastAmenity.id + 1 : 1;

    const amenity = await Amenity.create({
      id: nextId,
      name,
      category,
      icon: CATEGORY_ICONS[category],
      createdBy: userId,
    });

    return res.status(201).json({
      success: true,
      message: "Amenity added successfully",
      data: amenity,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.updateAmenity = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category } = req.body;

    const user = await User.findById(req.user.id).select("userType");

    if (!user || user.userType !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can update amenities",
      });
    }

    const CATEGORY_ICONS = {
      "Financial Benefits": "💰",
      "Accommodation & Food": "🏠",
      "Travel": "🚌",
      "Safety & Medical": "🛡️",
      "Leave": "📅",
      "Work & Career": "📈",
      "Employee Rewards": "🏆",
    };

    if (category && !CATEGORY_ICONS[category]) {
      return res.status(400).json({
        success: false,
        message: "Invalid category",
      });
    }

    // Prevent duplicate names
    if (name) {
      const existingAmenity = await Amenity.findOne({
        name,
        _id: { $ne: id },
      });

      if (existingAmenity) {
        return res.status(400).json({
          success: false,
          message: "Amenity with this name already exists",
        });
      }
    }

    const amenity = await Amenity.findByIdAndUpdate(
      id,
      {
        ...(name && { name }),
        ...(category && {
          category,
          icon: CATEGORY_ICONS[category],
        }),
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!amenity) {
      return res.status(404).json({
        success: false,
        message: "Amenity not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Amenity updated successfully",
      data: amenity,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

exports.deleteAmenity = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(req.user.id).select("userType");

    if (!user || user.userType !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can delete amenities",
      });
    }

    // Check if any job is using this amenity
    const jobUsingAmenity = await Job.findOne({
      amenities: id,
    });

    if (jobUsingAmenity) {
      return res.status(400).json({
        success: false,
        message:
          "Cannot delete amenity because it is being used in one or more jobs.",
      });
    }

    const amenity = await Amenity.findByIdAndDelete(id);

    if (!amenity) {
      return res.status(404).json({
        success: false,
        message: "Amenity not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Amenity deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
