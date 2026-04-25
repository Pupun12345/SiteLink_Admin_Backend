const Post = require('../models/Post');
const Assignment = require('../models/Assignment');
const User = require('../models/User');

// @desc    Get community feed (posts from vendors and workers)
// @route   GET /api/community/feed
// @access  Private
exports.getCommunityFeed = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const category = req.query.category || null;
    const posterType = req.query.posterType || null;

    let filter = { isActive: true, approvalStatus: 'approved' };

    if (category) {
      filter.category = category;
    }

    if (posterType) {
      filter.posterType = posterType;
    }

    const skip = (page - 1) * limit;

    const posts = await Post.find(filter)
      .populate('postedBy', 'name profileImage')
      .populate('likes.userId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Post.countDocuments(filter);

    // Format posts for UI display
    const formattedPosts = posts.map(post => ({
      _id: post._id,
      content: post.content,
      images: post.images,
      category: post.category,
      posterName: post.posterName,
      posterImage: post.posterImage,
      posterType: post.posterType,
      companyName: post.companyName,
      verification: post.verification,
      location: post.location,
      likesCount: post.likesCount,
      commentsCount: post.commentsCount,
      shares: post.shares,
      createdAt: post.createdAt,
      likes: post.likes.map(like => ({
        userId: like.userId?._id,
        userName: like.userId?.name,
      })),
    }));

    res.status(200).json({
      success: true,
      data: formattedPosts,
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
    const { content, category, location } = req.body;
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Handle image uploads
    const images = req.files && req.files.length > 0
      ? req.files.map(file => `/uploads/posts/${file.filename}`)
      : [];

    const postData = {
      content,
      category: category || 'general',
      postedBy: userId,
      posterName: user.name,
      posterImage: user.profileImage,
      posterType: user.userType,
      companyName: user.companyName || user.ownerName || null,
      images,
      location: location || user.city || null,
      verification: user.isVerified ? 'verified' : 'unverified',
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
        category: populatedPost.category,
        posterName: populatedPost.posterName,
        posterImage: populatedPost.posterImage,
        posterType: populatedPost.posterType,
        companyName: populatedPost.companyName,
        verification: populatedPost.verification,
        location: populatedPost.location,
        likesCount: populatedPost.likesCount,
        commentsCount: populatedPost.commentsCount,
        shares: populatedPost.shares,
        createdAt: populatedPost.createdAt,
        likes: populatedPost.likes,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating post',
      error: error.message,
    });
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

// @desc    Get pending posts for admin approval
// @route   GET /api/community/posts/pending
// @access  Admin only
exports.getPendingPosts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const posts = await Post.find({ approvalStatus: 'pending' })
      .populate('postedBy', 'name profileImage userType')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Post.countDocuments({ approvalStatus: 'pending' });

    res.status(200).json({
      success: true,
      data: posts,
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

// @desc    Approve a post
// @route   PUT /api/community/posts/:postId/approve
// @access  Admin only
exports.approvePost = async (req, res) => {
  try {
    const { postId } = req.params;
    const adminId = req.user._id;

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    post.approvalStatus = 'approved';
    post.approvedBy = adminId;
    post.approvedAt = new Date();
    post.autoApproved = false;

    await post.save();

    res.status(200).json({
      success: true,
      message: 'Post approved successfully',
      data: post,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error approving post',
      error: error.message,
    });
  }
};

// @desc    Reject a post
// @route   PUT /api/community/posts/:postId/reject
// @access  Admin only
exports.rejectPost = async (req, res) => {
  try {
    const { postId } = req.params;
    const { reason } = req.body;
    const adminId = req.user._id;

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Rejection reason is required',
      });
    }

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found',
      });
    }

    post.approvalStatus = 'rejected';
    post.approvedBy = adminId;
    post.approvedAt = new Date();
    post.rejectionReason = reason.trim();
    post.isActive = false;

    await post.save();

    res.status(200).json({
      success: true,
      message: 'Post rejected successfully',
      data: post,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error rejecting post',
      error: error.message,
    });
  }
};

// @desc    Auto-approve posts older than 1 hour
// @route   POST /api/community/posts/auto-approve
// @access  System/Cron
exports.autoApprovePosts = async (req, res) => {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const result = await Post.updateMany(
      {
        approvalStatus: 'pending',
        createdAt: { $lte: oneHourAgo },
      },
      {
        $set: {
          approvalStatus: 'approved',
          autoApproved: true,
          approvedAt: new Date(),
        },
      }
    );

    res.status(200).json({
      success: true,
      message: `Auto-approved ${result.modifiedCount} posts`,
      count: result.modifiedCount,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error auto-approving posts',
      error: error.message,
    });
  }
};


