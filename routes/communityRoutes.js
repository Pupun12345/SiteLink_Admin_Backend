const express = require('express');
const router = express.Router();
const {
  getCommunityFeed,
  createPost,
  likeUnlikePost,
  deletePost,
  getPendingPosts,
  approvePost,
  rejectPost,
  autoApprovePosts,
  addComment,
  updateComment,
  deleteComment,
  getCommentsByPost,
} = require('../controllers/communityController');
const { protect, adminOnly } = require('../middleware/auth');
const upload = require('../middleware/upload');

// GET community feed
router.get('/feed', protect, getCommunityFeed);

// POST create post
router.post('/posts', protect, upload.fields([{ name: 'images', maxCount: 5 }, { name: 'video', maxCount: 1 }]), createPost);
// PUT like/unlike post
router.put('/posts/:postId/like', protect, likeUnlikePost);

// DELETE post
router.delete('/posts/:postId', protect, deletePost);

// Admin routes for post approval
router.get('/posts/pending', protect, adminOnly, getPendingPosts);
router.put('/posts/:postId/approve', protect, adminOnly, approvePost);
router.put('/posts/:postId/reject', protect, adminOnly, rejectPost);
router.post('/posts/auto-approve', autoApprovePosts);

// Comment routes
router.post('/posts/:id/comments', protect, addComment);
router.put('/posts/:postId/comments/:commentId', protect, updateComment);
router.delete('/posts/:postId/comments/:commentId', protect, deleteComment);
router.get('/posts/:id/comments', getCommentsByPost);

module.exports = router;