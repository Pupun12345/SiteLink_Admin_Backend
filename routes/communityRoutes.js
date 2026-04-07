const express = require('express');
const router = express.Router();
const {
  getCommunityFeed,
  createPost,
  likeUnlikePost,
  deletePost,
} = require('../controllers/communityController');
const { protect } = require('../middleware/auth');

// GET community feed
router.get('/feed', protect, getCommunityFeed);

// POST create post
router.post('/posts', protect, createPost);

// PUT like/unlike post
router.put('/posts/:postId/like', protect, likeUnlikePost);

// DELETE post
router.delete('/posts/:postId', protect, deletePost);

module.exports = router;