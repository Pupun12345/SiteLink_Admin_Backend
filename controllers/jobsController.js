const Job = require('../models/job');
const User = require('../models/User');
const Comment = require('../models/Comment');

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

    res.status(200).json({
      success: true,
      count: jobs.length,
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

    // Get sample applicants (workers who might have applied)
    const applicants = await User.find({ 
      userType: 'worker',
      verificationStatus: 'verified'
    })
    .select('name role profileImage createdAt')
    .limit(5)
    .sort({ createdAt: -1 });

    // Transform applicants data
    const transformedApplicants = applicants.map((applicant, index) => ({
      id: applicant._id,
      name: applicant.name,
      role: applicant.role || 'Worker',
      applied: index === 0 ? '2h ago' : index === 1 ? '5h ago' : new Date(applicant.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      status: index % 2 === 0 ? 'shortlisted' : 'pending',
      avatar: applicant.profileImage || 'https://randomuser.me/api/portraits/lego/1.jpg'
    }));

    // Format job data
    const jobData = {
      ...job.toJSON(),
      id: job.jobId,
      role: job.title,
      vendor: job.company,
      qty: job.quantity,
      apps: job.applicationsCount.toString(),
      date: new Date(job.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      applicants: transformedApplicants
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

    // Build sort criteria
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

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get main comments (not replies)
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

    // Get total count for pagination
    const totalComments = await Comment.countDocuments({
      jobId,
      parentComment: null,
      status: 'active'
    });

    // Transform comments data
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