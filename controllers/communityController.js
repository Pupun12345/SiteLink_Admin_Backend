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

    let filter = { isActive: true };

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
      .populate('comments.userId', 'name profileImage')
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
      comments: post.comments.map(comment => ({
        _id: comment._id,
        userId: comment.userId,
        userName: comment.userName,
        userImage: comment.userImage,
        comment: comment.comment,
        createdAt: comment.createdAt,
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
    const images = req.files && req.files.images
      ? req.files.images.map(file => `/uploads/${file.path.split('uploads')[1]}`)
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
      .populate('likes.userId', 'name')
      .populate('comments.userId', 'name profileImage');

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
        comments: populatedPost.comments,
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
      .populate('likes.userId', 'name')
      .populate('comments.userId', 'name profileImage');

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

// @desc    Add comment to a post
// @route   POST /api/community/posts/:postId/comment
// @access  Private
exports.addComment = async (req, res) => {
  try {
    const { postId } = req.params;
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

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const newComment = {
      userId: userId,
      userName: user.name,
      userImage: user.profileImage,
      comment: comment.trim(),
      createdAt: new Date(),
    };

    post.comments.push(newComment);
    post.commentsCount += 1;
    await post.save();

    const updatedPost = await Post.findById(postId)
      .populate('postedBy', 'name profileImage')
      .populate('likes.userId', 'name')
      .populate('comments.userId', 'name profileImage');

    res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: {
        _id: updatedPost._id,
        commentsCount: updatedPost.commentsCount,
        comments: updatedPost.comments.map(comment => ({
          _id: comment._id,
          userId: comment.userId,
          userName: comment.userName,
          userImage: comment.userImage,
          comment: comment.comment,
          createdAt: comment.createdAt,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error adding comment',
      error: error.message,
    });
  }
};

// @desc    Delete comment from a post
// @route   DELETE /api/community/posts/:postId/comment/:commentId
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

    const commentIndex = post.comments.findIndex(
      comment => comment._id.toString() === commentId
    );

    if (commentIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found',
      });
    }

    const comment = post.comments[commentIndex];

    // Check if user owns the comment or is admin
    if (comment.userId.toString() !== userId.toString() && req.user.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to delete this comment',
      });
    }

    post.comments.splice(commentIndex, 1);
    post.commentsCount = Math.max(0, post.commentsCount - 1);
    await post.save();

    res.status(200).json({
      success: true,
      message: 'Comment deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting comment',
      error: error.message,
    });
  }
};


