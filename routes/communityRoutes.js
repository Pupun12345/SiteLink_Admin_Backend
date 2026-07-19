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
} = require('../controllers/communityController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

// GET community feed
router.get('/feed', protect, getCommunityFeed);

// POST create post
router.post('/posts', protect, upload.fields([{ name: 'images', maxCount: 5 }, { name: 'video', maxCount: 1 }]), createPost);
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