const Job = require('../models/job');
const User = require('../models/User');
const Comment = require('../models/Comment');
const Application = require('../models/Application');

// @desc    Get all jobs
// @route   GET /api/jobs
// @access  Public
exports.getJobs = async (req, res) => {
  try {
    const { location, type, search } = req.query;

    let filter = {};

    if (location) {
      filter.location = { $regex: location, $options: 'i' };
    }

    if (type) {
      filter.type = type;
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
        { skills: { $regex: search, $options: 'i' } },
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
        role: applicant.skills && applicant.skills.length > 0 ? applicant.skills[0].skillName : 'Worker',
        status: application.status,
        applied: timeApplied,
        avatar: applicant.profileImage || `https://ui-avatars.io/api/?name=${encodeURIComponent(applicant.name)}&background=random`,
        experience: applicant.experience || 'Not specified',
        location: applicant.city || 'Not specified',
        skills: applicant.skills ? applicant.skills.map(s => s.skillName) : [],
        phone: applicant.phone,
        email: applicant.email,
        dailyRate: applicant.dailyRate || application.proposedRate,
        coverLetter: application.coverLetter,
        proposedRate: application.proposedRate,
        availability: application.availability
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
    const job = await Job.create({
      ...req.body,
      postedBy: req.user.id
    });

    res.status(201).json({
      success: true,
      data: job,
    });
  } catch (error) {
    res.status(400).json({
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

// @desc    Get comments for a job
// @route   GET /api/jobs/:id/comments
// @access  Public
exports.getCommentsByJob = async (req, res) => {
  try {
    const { id: jobId } = req.params;
    const { page = 1, limit = 10, sortBy = 'newest' } = req.query;

    // Check if job exists
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    let sortCriteria = {};
    switch (sortBy) {
      case 'oldest':
        sortCriteria = { createdAt: 1 };
        break;
      case 'popular':
        sortCriteria = { likesCount: -1, createdAt: -1 };
        break;
      case 'newest':
      default:
        sortCriteria = { createdAt: -1 };
        break;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const comments = await Comment.find({
      jobId,
      parentComment: null,
      status: 'active'
    })
    .populate('userId', 'name profileImage userType verificationStatus')
    .populate({
      path: 'replies',
      match: { status: 'active' },
      populate: {
        path: 'userId',
        select: 'name profileImage userType verificationStatus'
      },
      options: { sort: { createdAt: 1 }, limit: 3 }
    })
    .sort(sortCriteria)
    .skip(skip)
    .limit(parseInt(limit));

    const totalComments = await Comment.countDocuments({
      jobId,
      parentComment: null,
      status: 'active'
    });

    const transformedComments = comments.map(comment => ({
      _id: comment._id,
      comment: comment.comment,
      userId: comment.userId._id,
      userName: comment.userId.name,
      userImage: comment.userId.profileImage || null,
      userType: comment.userId.userType,
      isVerified: comment.userId.verificationStatus === 'verified',
      likesCount: comment.likesCount,
      repliesCount: comment.repliesCount,
      isEdited: comment.isEdited,
      editedAt: comment.editedAt,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      replies: comment.replies ? comment.replies.map(reply => ({
        _id: reply._id,
        comment: reply.comment,
        userId: reply.userId._id,
        userName: reply.userId.name,
        userImage: reply.userId.profileImage || null,
        userType: reply.userId.userType,
        isVerified: reply.userId.verificationStatus === 'verified',
        likesCount: reply.likesCount,
        isEdited: reply.isEdited,
        editedAt: reply.editedAt,
        createdAt: reply.createdAt,
        updatedAt: reply.updatedAt
      })) : []
    }));

    res.status(200).json({
      success: true,
      data: transformedComments,
      pagination: {
        current: parseInt(page),
        limit: parseInt(limit),
        total: totalComments,
        pages: Math.ceil(totalComments / parseInt(limit))
      },
      meta: {
        jobTitle: job.title,
        totalComments,
        sortBy
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

// @desc    Add comment to a job
// @route   POST /api/jobs/:id/comments
// @access  Private
exports.addComment = async (req, res) => {
  try {
    const { id: jobId } = req.params;
    const { comment, parentComment = null } = req.body;
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

    // Check if job exists
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    if (parentComment) {
      const parentCommentDoc = await Comment.findById(parentComment);
      if (!parentCommentDoc || parentCommentDoc.jobId.toString() !== jobId) {
        return res.status(404).json({
          success: false,
          message: 'Parent comment not found',
        });
      }
    }

    // Create comment
    const newComment = await Comment.create({
      jobId,
      userId,
      comment: comment.trim(),
      parentComment
    });

    await newComment.populate('userId', 'name profileImage userType verificationStatus');


    const responseData = {
      _id: newComment._id,
      comment: newComment.comment,
      userId: newComment.userId._id,
      userName: newComment.userId.name,
      userImage: newComment.userId.profileImage || null,
      userType: newComment.userId.userType,
      isVerified: newComment.userId.verificationStatus === 'verified',
      likesCount: newComment.likesCount,
      repliesCount: newComment.repliesCount,
      isEdited: newComment.isEdited,
      createdAt: newComment.createdAt,
      updatedAt: newComment.updatedAt
    };

    res.status(201).json({
      success: true,
      message: parentComment ? 'Reply added successfully' : 'Comment added successfully',
      data: responseData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to add comment',
      error: error.message,
    });
  }
};

// @desc    Update comment
// @route   PUT /api/jobs/:jobId/comments/:commentId
// @access  Private
exports.updateComment = async (req, res) => {
  try {
    const { jobId, commentId } = req.params;
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


    const existingComment = await Comment.findOne({
      _id: commentId,
      jobId,
      status: 'active'
    }).populate('userId', 'name profileImage userType verificationStatus');

    if (!existingComment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    if (existingComment.userId._id.toString() !== userId ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this comment',
      });
    }

    // Update comment
    existingComment.comment = comment.trim();
    existingComment.isEdited = true;
    existingComment.editedAt = new Date();
    await existingComment.save();

    const responseData = {
      _id: existingComment._id,
      comment: existingComment.comment,
      userId: existingComment.userId._id,
      userName: existingComment.userId.name,
      userImage: existingComment.userId.profileImage || null,
      userType: existingComment.userId.userType,
      isVerified: existingComment.userId.verificationStatus === 'verified',
      likesCount: existingComment.likesCount,
      repliesCount: existingComment.repliesCount,
      isEdited: existingComment.isEdited,
      editedAt: existingComment.editedAt,
      createdAt: existingComment.createdAt,
      updatedAt: existingComment.updatedAt
    };

    res.status(200).json({
      success: true,
      message: 'Comment updated successfully',
      data: responseData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update comment',
      error: error.message,
    });
  }
};

// @desc    Delete comment
// @route   DELETE /api/jobs/:jobId/comments/:commentId
// @access  Private
exports.deleteComment = async (req, res) => {
  try {
    const { jobId, commentId } = req.params;
    const userId = req.user.id;

    const comment = await Comment.findOne({
      _id: commentId,
      jobId,
      status: 'active'
    });

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    if (comment.userId.toString() !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this comment',
      });
    }

    comment.status = 'deleted';
    await comment.save();
    // await Comment.deleteOne({ _id: commentId });

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

// @desc    Like/Unlike comment
// @route   PUT /api/jobs/:jobId/comments/:commentId/like
// @access  Private
exports.toggleCommentLike = async (req, res) => {
  try {
    const { jobId, commentId } = req.params;
    const userId = req.user.id;

    const comment = await Comment.findOne({
      _id: commentId,
      jobId,
      status: 'active'
    });

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }


    const existingLikeIndex = comment.likes.findIndex(
      like => like.userId.toString() === userId
    );

    let message = '';
    if (existingLikeIndex > -1) {
      // Unlike
      comment.likes.splice(existingLikeIndex, 1);
      comment.likesCount = Math.max(0, comment.likesCount - 1);
      message = 'Comment unliked';
    } else {
      // Like
      comment.likes.push({ userId });
      comment.likesCount += 1;
      message = 'Comment liked';
    }

    await comment.save();

    res.status(200).json({
      success: true,
      message,
      data: {
        _id: comment._id,
        likesCount: comment.likesCount,
        isLiked: existingLikeIndex === -1
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to toggle like',
      error: error.message,
    });
  }
};

// @desc    Apply to a job
// @route   POST /api/jobs/:id/apply
// @access  Private
exports.applyToJob = async (req, res) => {
  try {
    const { id: jobId } = req.params;
    const applicantId = req.user.id;
    const { coverLetter, proposedRate, availability } = req.body;

    // Check if job exists
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }

    // Check if user is a worker
    const user = await User.findById(applicantId);
    if (user.userType !== 'worker') {
      return res.status(403).json({
        success: false,
        message: 'Only workers can apply to jobs',
      });
    }

    const existingApplication = await Application.findOne({
      job: jobId,
      applicant: applicantId,
    });

    if (existingApplication) {
      return res.status(400).json({
        success: false,
        message: 'You have already applied to this job',
      });
    }

    const application = await Application.create({
      job: jobId,
      applicant: applicantId,
      coverLetter,
      proposedRate,
      availability: availability || 'flexible',
    });

    await Job.findByIdAndUpdate(jobId, {
      $inc: { applicationsCount: 1 }
    });

    await application.populate('applicant', 'name profileImage userType');

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      data: application,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to apply to job',
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
        role: applicant.skills && applicant.skills.length > 0 ? applicant.skills[0].skillName : 'Worker',
        status: application.status,
        applied: application.createdAt,
        avatar: applicant.profileImage || `https://ui-avatars.io/api/?name=${encodeURIComponent(applicant.name)}&background=random`,
        experience: applicant.experience || 'Not specified',
        location: applicant.city || 'Not specified',
        skills: applicant.skills ? applicant.skills.map(s => s.skillName) : [],
        phone: applicant.phone,
        email: applicant.email,
        dailyRate: applicant.dailyRate || application.proposedRate,
        coverLetter: application.coverLetter,
        proposedRate: application.proposedRate,
        availability: application.availability,
        reviewedAt: application.reviewedAt,
        notes: application.notes
      };
    });

    res.status(200).json({
      success: true,
      data: transformedApplications,
      pagination: {
        current: parseInt(page),
        limit: parseInt(limit),
        total: totalApplications,
        pages: Math.ceil(totalApplications / parseInt(limit))
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
