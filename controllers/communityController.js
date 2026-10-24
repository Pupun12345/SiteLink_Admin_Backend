const Post = require('../models/Post');
const Job = require('../models/job');
const Assignment = require('../models/Assignment');
const User = require('../models/User');
const Comment = require('../models/Comment');
const notifyUser = require('../utils/notifyUser');

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
      // Exclude admin timed posts that have expired
      $or: [
        { isAdminPost: { $ne: true } },
        { isAdminPost: true, isPermanent: true },
        { isAdminPost: true, expiresAt: null },
        { isAdminPost: true, expiresAt: { $gt: new Date() } },
      ],
    };

    const [posts, total] = await Promise.all([
      Post.find(filter)
        .populate("postedBy", "name profileImage")
        .populate("likes.userId", "name")
        .sort({ isAdminPost: -1, createdAt: -1 })
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
    const isAdmin = req.user.userType === 'admin' || !!req.user.permissions;

    // For admin users req.user is an AdminUser doc (no User collection entry)
    let posterName, posterImage, posterType, companyName, verification, postedById;

    if (isAdmin) {
      posterName = req.user.name || 'SiteLink Admin';
      posterImage = req.user.profileImage || null;
      posterType = 'admin';
      companyName = 'SiteLink';
      verification = 'verified';
      postedById = req.user._id;
    } else {
      const user = await User.findById(req.user._id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      posterName = user.name;
      posterImage = user.profileImage;
      posterType = user.userType;
      companyName = user.companyName || user.ownerName || null;
      verification = user.verificationStatus || 'unverified';
      postedById = user._id;
    }

    const images = req.files?.images
      ? req.files.images.map(file => file.path)
      : [];

    const video = req.files?.video?.[0]
      ? req.files.video[0].path
      : null;

    let isAdminPost = false;
    let isPermanent = false;
    let expiresAt = null;
    if (isAdmin) {
      isAdminPost = true;
      const { postDuration } = req.body;
      if (postDuration === 'permanent') {
        isPermanent = true;
      } else if (postDuration && !isNaN(Number(postDuration))) {
        expiresAt = new Date(Date.now() + Number(postDuration) * 60 * 60 * 1000);
      }
    }

    const post = await Post.create({
      content,
      feeling: feeling || null,
      postedBy: postedById,
      posterName,
      posterImage,
      posterType,
      companyName,
      images,
      video,
      verification,
      approvalStatus: 'approved',
      approvedAt: new Date(),
      isAdminPost,
      isPermanent,
      expiresAt,
    });

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      data: {
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
        likes: [],
        approvalStatus: post.approvalStatus,
        approvedAt: post.approvedAt,
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

    const isAdmin = req.user.userType === 'admin' || !!req.user.permissions;
    if (post.postedBy.toString() !== req.user._id.toString() && !isAdmin) {
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

// @desc    Get all admin posts (job + general) for admin panel
// @route   GET /api/community/admin-posts
// @access  Admin only
exports.getAdminPosts = async (req, res) => {
  try {
    const { type } = req.query; // 'post' | 'job' | undefined
    const filter = { posterType: 'admin' };
    if (type === 'post' || type === 'job') filter.contentType = type;

    const posts = await Post.find(filter).sort({ createdAt: -1 });
    const Job = require('../models/job');
    const jobs = type === 'post' ? [] : await Job.find({ postedBy: { $exists: true } })
      .populate('postedBy', 'name userType')
      .sort({ createdAt: -1 })
      .then(all => all.filter(j => {
        const u = j.postedBy;
        return u && (u.userType === 'admin');
      }));

    return res.status(200).json({
      success: true,
      data: { posts, jobs },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error fetching admin posts', error: error.message });
  }
};

// NOTE: getPendingJobs / approveJob / rejectJob / autoApproveJobs removed —
// vendor jobs are auto-approved at creation in the app backend now, so the
// admin job-approval workflow no longer exists.

// @desc    Add comment (or reply) to a post
// @route   POST /api/community/posts/:id/comments
// @access  Private
exports.addComment = async (req, res) => {
  try {
    const { id: postId } = req.params;
    const { comment, parentComment = null } = req.body;
    const userId = req.user._id;

    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Comment cannot be empty' });
    }

    if (comment.length > 500) {
      return res.status(400).json({ success: false, message: 'Comment cannot exceed 500 characters' });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    if (parentComment) {
      const parentDoc = await Comment.findById(parentComment);
      if (!parentDoc || parentDoc.postId.toString() !== postId) {
        return res.status(404).json({ success: false, message: 'Parent comment not found' });
      }
    }

    const newComment = await Comment.create({
      postId,
      userId,
      comment: comment.trim(),
      parentComment,
    });

    await Post.updateOne({ _id: postId }, { $inc: { commentsCount: 1 } });

    await newComment.populate('userId', 'name profileImage userType verificationStatus');

    if (post.postedBy && post.postedBy.toString() !== userId.toString()) {
      notifyUser(post.postedBy, {
        type: 'new_comment',
        title: 'New Comment',
        body: `${newComment.userId.name || 'Someone'} commented on your post.`,
        data: { postId: post._id, commentId: newComment._id },
      }).catch((e) => console.error('[addComment] notifyUser failed:', e.message));
    }

    res.status(201).json({
      success: true,
      message: parentComment ? 'Reply added successfully' : 'Comment added successfully',
      data: {
        _id: newComment._id,
        comment: newComment.comment,
        userId: newComment.userId._id,
        userName: newComment.userId.name,
        userImage: newComment.userId.profileImage || null,
        userType: newComment.userId.userType,
        isVerified: newComment.userId.verificationStatus === 'verified',
        parentComment: newComment.parentComment,
        likesCount: newComment.likesCount,
        isEdited: newComment.isEdited,
        createdAt: newComment.createdAt,
        updatedAt: newComment.updatedAt,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to add comment', error: error.message });
  }
};

// @desc    Update comment
// @route   PUT /api/community/posts/:postId/comments/:commentId
// @access  Private
exports.updateComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { comment } = req.body;
    const userId = req.user._id;

    if (!comment || comment.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Comment cannot be empty' });
    }

    if (comment.length > 500) {
      return res.status(400).json({ success: false, message: 'Comment cannot exceed 500 characters' });
    }

    const existing = await Comment.findById(commentId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    if (existing.userId.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this comment' });
    }

    existing.comment = comment.trim();
    existing.isEdited = true;
    existing.editedAt = new Date();
    await existing.save();

    res.status(200).json({ success: true, message: 'Comment updated successfully', data: existing });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update comment', error: error.message });
  }
};

// @desc    Delete comment (and its replies)
// @route   DELETE /api/community/posts/:postId/comments/:commentId
// @access  Private
exports.deleteComment = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    const userId = req.user._id;
    const isAdmin = req.user.userType === 'admin' || !!req.user.permissions;

    const existing = await Comment.findById(commentId);
    if (!existing || existing.postId.toString() !== postId) {
      return res.status(404).json({ success: false, message: 'Comment not found' });
    }

    if (existing.userId.toString() !== userId.toString() && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this comment' });
    }

    // Delete comment + all its replies
    const deleted = await Comment.deleteMany({ $or: [{ _id: commentId }, { parentComment: commentId }] });
    await Post.updateOne({ _id: postId }, { $inc: { commentsCount: -deleted.deletedCount } });

    res.status(200).json({ success: true, message: 'Comment deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete comment', error: error.message });
  }
};

// @desc    Get comments for a post (top-level with nested replies)
// @route   GET /api/community/posts/:id/comments
// @access  Public
exports.getCommentsByPost = async (req, res) => {
  try {
    const { id: postId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [topLevel, total] = await Promise.all([
      Comment.find({ postId, parentComment: null, status: 'active' })
        .populate('userId', 'name profileImage userType verificationStatus')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Comment.countDocuments({ postId, parentComment: null, status: 'active' }),
    ]);

    const topLevelIds = topLevel.map(c => c._id);
    const replies = await Comment.find({ postId, parentComment: { $in: topLevelIds }, status: 'active' })
      .populate('userId', 'name profileImage userType verificationStatus')
      .sort({ createdAt: 1 });

    const fmt = (c) => ({
      _id: c._id,
      comment: c.comment,
      userId: c.userId?._id,
      userName: c.userId?.name,
      userImage: c.userId?.profileImage || null,
      userType: c.userId?.userType,
      isVerified: c.userId?.verificationStatus === 'verified',
      parentComment: c.parentComment,
      likesCount: c.likesCount,
      isEdited: c.isEdited,
      createdAt: c.createdAt,
    });

    const data = topLevel.map(c => ({
      ...fmt(c),
      replies: replies
        .filter(r => r.parentComment.toString() === c._id.toString())
        .map(fmt),
    }));

    res.status(200).json({
      success: true,
      data,
      pagination: {
        current: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch comments', error: error.message });
  }
};

