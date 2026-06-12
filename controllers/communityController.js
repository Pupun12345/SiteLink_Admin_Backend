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
    const posterType = req.query.posterType || null;

    let postFilter = { isActive: true, approvalStatus: 'approved' };
    let jobFilter = { isActive: true, approvalStatus: 'approved' };

    if (posterType) {
      postFilter.posterType = posterType;
    }

    // Fetch posts
    const posts = await Post.find(postFilter)
      .populate('postedBy', 'name profileImage')
      .populate('likes.userId', 'name')
      .lean();

    // Fetch jobs
    const jobs = await Job.find(jobFilter)
      .populate('postedBy', 'name profileImage companyName')
      .populate('likes.userId', 'name')
      .lean();

    // Format posts
    const formattedPosts = posts.map(post => ({
      _id: post._id,
      contentType: 'post',
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
      likes: post.likes.map(like => ({
        userId: like.userId?._id,
        userName: like.userId?.name,
      })),
    }));

    // Format jobs
    const formattedJobs = jobs.map(job => ({
      _id: job._id,
      contentType: 'job',
      title: job.title,
      company: job.company,
      location: job.location,
      quantity: job.quantity,
      salary: job.salary,
      salaryType: job.salaryType,
      isUrgent: job.isUrgent,
      duration: job.duration,
      description: job.description,
      experience: job.experience,
      status: job.status,
      applicationsCount: job.applicationsCount,
      posterName: job.postedBy?.name,
      posterImage: job.postedBy?.profileImage,
      companyName: job.postedBy?.companyName || job.company,
      likesCount: job.likesCount,
      commentsCount: job.commentsCount,
      createdAt: job.createdAt,
      likes: job.likes?.map(like => ({
        userId: like.userId?._id,
        userName: like.userId?.name,
      })) || [],
    }));

    // Combine and sort by createdAt
    const combinedFeed = [...formattedPosts, ...formattedJobs]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Apply pagination
    const skip = (page - 1) * limit;
    const paginatedFeed = combinedFeed.slice(skip, skip + limit);
    const total = combinedFeed.length;

    res.status(200).json({
      success: true,
      data: paginatedFeed,
      pagination: {
        current: page,
        limit: limit,
        total: total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching community feed',
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
      ? req.files.images.map(file => `/uploads/posts/${file.filename}`)
      : [];

    const video = req.files?.video?.[0]
      ? `/uploads/posts/${req.files.video[0].filename}`
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
      verification: user.verificationStatus || 'unverified',
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

// @desc    Get pending posts and jobs for admin approval
// @route   GET /api/community/posts/pending
// @access  Admin only
exports.getPendingPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Fetch pending posts
    const posts = await Post.find({ approvalStatus: 'pending' })
      .populate('postedBy', 'name profileImage userType')
      .lean();

    // Fetch pending jobs
    const jobs = await Job.find({ approvalStatus: 'pending' })
      .populate('postedBy', 'name profileImage userType companyName')
      .lean();

    // Format posts with proper data
    const formattedPosts = posts.map(post => {
      const posterImage = post.posterImage || post.postedBy?.profileImage;
      return {
        ...post,
        contentType: 'post',
        posterImage: posterImage,
        posterName: post.posterName || post.postedBy?.name,
        posterType: post.posterType || post.postedBy?.userType
      };
    });

    // Format jobs with proper data
    const formattedJobs = jobs.map(job => {
      const posterImage = job.postedBy?.profileImage;
      return {
        ...job,
        contentType: 'job',
        posterImage: posterImage,
        posterName: job.postedBy?.name,
        posterType: job.postedBy?.userType
      };
    });

    // Combine and sort by createdAt
    const combinedPending = [...formattedPosts, ...formattedJobs]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Apply pagination
    const paginatedPending = combinedPending.slice(skip, skip + limit);
    const total = combinedPending.length;

    res.status(200).json({
      success: true,
      data: paginatedPending,
      pagination: {
        current: page,
        limit: limit,
        total: total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching pending posts',
      error: error.message,
    });
  }
};

// @desc    Approve a post or job
// @route   PUT /api/community/posts/:postId/approve
// @access  Admin only
exports.approvePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const adminId = req.user._id;
    const { contentType } = req.body;

    let item;
    if (contentType === 'job') {
      item = await Job.findById(postId);
    } else {
      item = await Post.findById(postId);
    }

    if (!item) {
      return res.status(404).json({
        success: false,
        message: `${contentType === 'job' ? 'Job' : 'Post'} not found`,
      });
    }

    item.approvalStatus = 'approved';
    item.approvedBy = adminId;
    item.approvedAt = new Date();
    if (contentType !== 'job') {
      item.autoApproved = false;
    }

    await item.save();

    res.status(200).json({
      success: true,
      message: `${contentType === 'job' ? 'Job' : 'Post'} approved successfully`,
      data: item,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error approving item',
      error: error.message,
    });
  }
};

// @desc    Reject a post or job
// @route   PUT /api/community/posts/:postId/reject
// @access  Admin only
exports.rejectPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { reason, contentType } = req.body;
    const adminId = req.user._id;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required',
      });
    }

    let item;
    if (contentType === 'job') {
      item = await Job.findById(postId);
    } else {
      item = await Post.findById(postId);
    }

    if (!item) {
      return res.status(404).json({
        success: false,
        message: `${contentType === 'job' ? 'Job' : 'Post'} not found`,
      });
    }

    item.approvalStatus = 'rejected';
    item.approvedBy = adminId;
    item.approvedAt = new Date();
    item.rejectionReason = reason.trim();
    item.isActive = false;

    await item.save();

    res.status(200).json({
      success: true,
      message: `${contentType === 'job' ? 'Job' : 'Post'} rejected successfully`,
      data: item,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error rejecting item',
      error: error.message,
    });
  }
};

// @desc    Auto-approve posts and jobs older than 24 hours
// @route   POST /api/community/posts/auto-approve
// @access  System/Cron
exports.autoApprovePosts = async (req, res) => {
  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours

    // Auto-approve posts
    const postResult = await Post.updateMany(
      {
        approvalStatus: 'pending',
        createdAt: { $lte: twentyFourHoursAgo },
      },
      {
        $set: {
          approvalStatus: 'approved',
          autoApproved: true,
          approvedAt: new Date(),
        },
      }
    );

    // Auto-approve jobs
    const jobResult = await Job.updateMany(
      {
        approvalStatus: 'pending',
        createdAt: { $lte: twentyFourHoursAgo },
      },
      {
        $set: {
          approvalStatus: 'approved',
          approvedAt: new Date(),
        },
      }
    );

    res.status(200).json({
      success: true,
      message: `Auto-approved ${postResult.modifiedCount} posts and ${jobResult.modifiedCount} jobs after 24 hours`,
      posts: postResult.modifiedCount,
      jobs: jobResult.modifiedCount,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error auto-approving items',
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

