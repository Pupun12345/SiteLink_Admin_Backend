const express = require('express');
const router = express.Router();
const {
  getCommunityFeed,
  createPost,
  likeUnlikePost,
  deletePost,
  getPendingJobs,
  approveJob,
  rejectJob,
  autoApproveJobs,
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

// Legacy job-only approval routes
router.get('/jobs/pending', protect, adminOnly, getPendingJobs);
router.put('/jobs/:jobId/approve', protect, adminOnly, approveJob);
router.put('/jobs/:jobId/reject', protect, adminOnly, rejectJob);
router.post('/jobs/auto-approve', autoApproveJobs);

// Comment routes
router.post('/posts/:id/comments', protect, addComment);
router.put('/posts/:postId/comments/:commentId', protect, updateComment);
router.delete('/posts/:postId/comments/:commentId', protect, deleteComment);
router.get('/posts/:id/comments', getCommentsByPost);

module.exports = router;