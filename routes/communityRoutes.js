const express = require('express');
const router = express.Router();
const {
  getCommunityFeed,
  createPost,
  likeUnlikePost,
  deletePost,
  addComment,
  updateComment,
  deleteComment,
  getCommentsByPost,
  getAdminPosts,
} = require('../controllers/communityController');
const { protect, adminOnly } = require('../middleware/auth');

// GET community feed
router.get('/feed', protect, getCommunityFeed);

// GET admin posts listing
router.get('/admin-posts', protect, adminOnly, getAdminPosts);

// POST create post (images/video are Cloudinary URLs from direct browser upload)
router.post('/posts', protect, createPost);
// PUT like/unlike post
router.put('/posts/:postId/like', protect, likeUnlikePost);

// DELETE post
router.delete('/posts/:postId', protect, deletePost);

// NOTE: job approve/reject/auto-approve routes removed — vendor jobs are
// auto-approved at creation in the app backend now (no admin review step).

// Comment routes
router.post('/posts/:id/comments', protect, addComment);
router.put('/posts/:postId/comments/:commentId', protect, updateComment);
router.delete('/posts/:postId/comments/:commentId', protect, deleteComment);
router.get('/posts/:id/comments', getCommentsByPost);

module.exports = router;