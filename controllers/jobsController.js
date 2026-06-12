const Job = require('../models/job');
const User = require('../models/User');
const Application = require('../models/Application');

// @desc    Get all jobs
// @route   GET /api/jobs
// @access  Public
exports.getJobs = async (req, res) => {
  try {
    const { location, salaryType, search } = req.query;

    let filter = {};

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
      .populate('postedBy', 'name companyName')
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
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message,
    });
  }
};

// @desc    Get single job by ID with applicants
// @route   GET /api/jobs/:id
// @access  Public
exports.getJobById = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).populate('postedBy', 'name companyName');

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    const applications = await Application.find({ job: req.params.id })
      .populate('applicant', 'name profileImage userType verificationStatus city dailyRate experience skills phone email')
      .sort({ createdAt: -1 })
      .limit(10);

    // Transform applications data
    const transformedApplicants = applications.map((application) => {
      const applicant = application.applicant;
      const timeApplied = application.createdAt;

      return {
        id: application._id,
        applicantId: applicant._id,
        name: applicant.name,
        role: applicant.primarySkill || (applicant.skills && applicant.skills.length > 0 ? applicant.skills[0].skillName : 'Worker'),
        status: application.status,
        applied: timeApplied,
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

    const actualApplicationsCount = await Application.countDocuments({ job: req.params.id });

    const jobData = {
      ...job.toJSON(),
      applicants: transformedApplicants,
      applicationsCount: actualApplicationsCount
    };

    res.status(200).json({
      success: true,
      data: jobData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Invalid Job ID',
      error: error.message,
    });
  }
};

// @desc    Create a new job
// @route   POST /api/jobs
// @access  Private
exports.createJob = async (req, res) => {
  try {
    const { title, company, location, quantity, salary, salaryType, isUrgent, duration, description, experience } = req.body;

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

    const companyVerified = await User.findOne({ name: company.trim().toLowerCase(), isVerified: true });
    if (!companyVerified) {
      return res.status(400).json({
        success: false,
        message: 'Company name must match a verified company in our system'
      });
    }

    const job = await Job.create({
      title: title.trim(),
      company: company.trim(),
      location: location.trim(),
      quantity: workersNeeded.toString(),
      salary: parsedSalary,
      salaryType: salaryType,
      isUrgent: isUrgent || false,
      duration: duration ? duration.trim() : '',
      description: description.trim(),
      experience: exp.toString(),
      postedBy: req.user.id,
      isActive: true,
      approvalStatus: 'pending'
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
    const job = await Job.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
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
