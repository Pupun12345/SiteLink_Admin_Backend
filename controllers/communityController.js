const Post = require('../models/Post');
const Job = require('../models/job');
const Assignment = require('../models/Assignment');
const User = require('../models/User');

// @desc    Get community feed (posts and jobs from vendors and workers)
// @route   GET /api/community/feed
// @access  Private
exports.getCommunityFeed = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {
      isActive: true,
      approvalStatus: "approved",
    };

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .populate("postedBy", "name profileImage")
        .populate("likes.userId", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      Post.countDocuments(filter),
    ]);

    const formattedPosts = posts.map((post) => ({
      type: "post",
      _id: post._id,
      content: post.content,
      images: post.images,
      video: post.video,
      feeling: post.feeling,
      posterName: post.posterName,
      posterImage: post.posterImage,
      posterType: post.posterType,
      companyName: post.companyName,
      verification: post.verification,
      likesCount: post.likesCount,
      commentsCount: post.commentsCount,
      createdAt: post.createdAt,
      likes: (post.likes || []).map((like) => ({
        userId: like.userId?._id,
        userName: like.userId?.name,
      })),
    }));

    res.status(200).json({
      success: true,
      data: formattedPosts,
      pagination: {
        current: page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching community feed",
      error: error.message,
    });
  }
};

// @desc    Create a community post
// @route   POST /api/community/posts
// @access  Private
exports.createPost = async (req, res) => {
  try {
    const { content, feeling } = req.body;
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const images = req.files?.images
      ? req.files.images.map(file => file.path)
      : [];

    const video = req.files?.video?.[0]
      ? req.files.video[0].path
      : null;

    const postData = {
      content,
      feeling: feeling || null,
      postedBy: userId,
      posterName: user.name,
      posterImage: user.profileImage,
      posterType: user.userType,
      companyName: user.companyName || user.ownerName || null,
      images,
      video,
      verification: user.verificationStatus || "unverified",
      approvalStatus: "approved",
      approvedAt: new Date(),
    };

    const post = await Post.create(postData);

    const populatedPost = await Post.findById(post._id)
      .populate('postedBy', 'name profileImage')
      .populate('likes.userId', 'name');

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      data: {
        _id: populatedPost._id,
        content: populatedPost.content,
        images: populatedPost.images,
        video: populatedPost.video,
        feeling: populatedPost.feeling,
        posterName: populatedPost.posterName,
        posterImage: populatedPost.posterImage,
        posterType: populatedPost.posterType,
        companyName: populatedPost.companyName,
        verification: populatedPost.verification,
        likesCount: populatedPost.likesCount,
        commentsCount: populatedPost.commentsCount,
        createdAt: populatedPost.createdAt,
        likes: populatedPost.likes,
        approvalStatus: populatedPost.approvalStatus,
        approvedAt: populatedPost.approvedAt
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error creating post', error: error.message });
  }
};

// @desc    Like/Unlike a post
// @route   PUT /api/community/posts/:postId/like
// @access  Private
exports.likeUnlikePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user._id;

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    const likeIndex = post.likes.findIndex(like => like.userId.toString() === userId.toString());

    if (likeIndex > -1) {
      // Unlike
      post.likes.splice(likeIndex, 1);
      post.likesCount = Math.max(0, post.likesCount - 1);
    } else {
      // Like
      post.likes.push({
        userId: userId,
        likedAt: new Date(),
      });
      post.likesCount += 1;
    }

    await post.save();

    const updatedPost = await Post.findById(postId)
      .populate('postedBy', 'name profileImage')
      .populate('likes.userId', 'name');

    res.status(200).json({
      success: true,
      message: likeIndex > -1 ? 'Post unliked' : 'Post liked',
      data: {
        _id: updatedPost._id,
        likesCount: updatedPost.likesCount,
        likes: updatedPost.likes,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error liking/unliking post',
      error: error.message,
    });
  }
};

// @desc    Delete a post
// @route   DELETE /api/community/posts/:postId
// @access  Private
exports.deletePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = req.user._id;

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    if (post.postedBy.toString() !== userId.toString() && req.user.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to delete this post',
      });
    }

    await Post.findByIdAndDelete(postId);

    res.status(200).json({
      success: true,
      message: 'Post deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting post',
      error: error.message,
    });
  }
};


// @desc    Approve a post or job
// @route   PUT /api/community/posts/:id/approve
// @access  Admin only
exports.approvePost = async (req, res) => {
  try {
    const { id } = req.params;
    const { contentType } = req.body;
    const adminId = req.user._id;

    const Model = contentType === 'job' ? Job : Post;
    const item = await Model.findById(id);

    if (!item) {
      return res.status(404).json({ success: false, message: `${contentType || 'Item'} not found` });
    }

    item.approvalStatus = 'approved';
    item.approvedBy = adminId;
    item.approvedAt = new Date();
    await item.save();

    res.status(200).json({ success: true, message: 'Approved successfully', data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error approving item', error: error.message });
  }
};

// @desc    Reject a post or job
// @route   PUT /api/community/posts/:id/reject
// @access  Admin only
exports.rejectPost = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, contentType } = req.body;
    const adminId = req.user._id;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required' });
    }

    const Model = contentType === 'job' ? Job : Post;
    const item = await Model.findById(id);

    if (!item) {
      return res.status(404).json({ success: false, message: `${contentType || 'Item'} not found` });
    }

    item.approvalStatus = 'rejected';
    item.approvedBy = adminId;
    item.approvedAt = new Date();
    item.rejectionReason = reason.trim();
    item.isActive = false;
    await item.save();

    res.status(200).json({ success: true, message: 'Rejected successfully', data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error rejecting item', error: error.message });
  }
};

// @desc    Get all pending jobs
// @route   GET /api/community/jobs/pending
// @access  Admin only
exports.getPendingJobs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {
      approvalStatus: "pending",
    };

    const [jobs, total] = await Promise.all([
      Job.find(filter)
        .populate(
          "postedBy",
          "name profileImage userType companyName ownerName"
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Job.countDocuments(filter),
    ]);

    const formattedJobs = jobs.map((job) => ({
      ...job,
      contentType: "job",
      posterName: job.postedBy?.name,
      posterImage: job.postedBy?.profileImage,
      posterType: job.postedBy?.userType,
      companyName:
        job.companyName ||
        job.postedBy?.companyName ||
        job.postedBy?.ownerName ||
        null,
    }));

    res.status(200).json({
      success: true,
      data: formattedJobs,
      pagination: {
        current: page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching pending jobs",
      error: error.message,
    });
  }
};

// @desc    Approve a job
// @route   PUT /api/community/jobs/:jobId/approve
// @access  Admin only
exports.approveJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const adminId = req.user._id;

    const job = await Job.findById(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    job.approvalStatus = "approved";
    job.approvedBy = adminId;
    job.approvedAt = new Date();

    await job.save();

    res.status(200).json({
      success: true,
      message: "Job approved successfully",
      data: job,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error approving job",
      error: error.message,
    });
  }
};


// @desc    Reject a job
// @route   PUT /api/community/jobs/:jobId/reject
// @access  Admin only
exports.rejectJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { reason } = req.body;
    const adminId = req.user._id;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required",
      });
    }

    const job = await Job.findById(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    job.approvalStatus = "rejected";
    job.approvedBy = adminId;
    job.approvedAt = new Date();
    job.rejectionReason = reason.trim();
    job.isActive = false;

    await job.save();

    res.status(200).json({
      success: true,
      message: "Job rejected successfully",
      data: job,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error rejecting job",
      error: error.message,
    });
  }
};

// @desc    Auto-approve jobs older than 12 hours
// @route   POST /api/community/jobs/auto-approve
// @access  System/Cron
exports.autoApproveJobs = async (req, res) => {
  try {
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);

    const result = await Job.updateMany(
      {
        approvalStatus: "pending",
        createdAt: { $lte: twelveHoursAgo },
      },
      {
        $set: {
          approvalStatus: "approved",
          approvedAt: new Date(),
        },
      }
    );

    res.status(200).json({
      success: true,
      message: `Auto-approved ${result.modifiedCount} jobs after 12 hours`,
      jobs: result.modifiedCount,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error auto-approving jobs",
      error: error.message,
    });
  }
};

// @desc    Add comment to a post
// @route   POST /api/posts/:id/comments
// @access  Private
exports.addComment = async (req, res) => {
  try {
    const { id: postId } = req.params;
    const { comment } = req.body;
    const userId = req.user._id;

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

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
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

    post.comments.push(newComment);
    post.commentsCount = post.comments.length;
    await post.save();

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

// @desc    Update comment
// @route   PUT /api/posts/:postId/comments/:commentId
// @access  Private
exports.updateComment = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const { comment } = req.body;
    const userId = req.user._id;

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

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    const commentIndex = post.comments.findIndex(c => c._id.toString() === commentId);
    if (commentIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    if (post.comments[commentIndex].userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this comment',
      });
    }

    post.comments[commentIndex].comment = comment.trim();
    await post.save();

    res.status(200).json({
      success: true,
      message: 'Comment updated successfully',
      data: post.comments[commentIndex]
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
// @route   DELETE /api/posts/:postId/comments/:commentId
// @access  Private
exports.deleteComment = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const userId = req.user._id;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    const commentIndex = post.comments.findIndex(c => c._id.toString() === commentId);
    if (commentIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    if (post.comments[commentIndex].userId.toString() !== userId.toString() && req.user.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this comment',
      });
    }

    post.comments.splice(commentIndex, 1);
    post.commentsCount = post.comments.length;
    await post.save();

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

// @desc    Get comments for a post
// @route   GET /api/posts/:id/comments
// @access  Public
exports.getCommentsByPost = async (req, res) => {
  try {
    const { id: postId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const comments = post.comments.slice(skip, skip + parseInt(limit));

    res.status(200).json({
      success: true,
      data: comments,
      pagination: {
        current: parseInt(page),
        limit: parseInt(limit),
        total: post.commentsCount,
        pages: Math.ceil(post.commentsCount / parseInt(limit))
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

