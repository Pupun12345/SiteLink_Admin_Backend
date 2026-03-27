const express = require('express');
const router = express.Router();
const {
  getCommunityFeed,
  createPost,
  likeUnlikePost,
  deletePost,
  addComment,
  deleteComment,
} = require('../controllers/communityController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/feed', protect, getCommunityFeed);
router.post('/posts', protect, upload.fields([
  { name: 'images', maxCount: 5 }
]), createPost);
router.put('/posts/:postId/like', protect, likeUnlikePost);
router.post('/posts/:postId/comment', protect, addComment);
router.delete('/posts/:postId/comment/:commentId', protect, deleteComment);
router.delete('/posts/:postId', protect, deletePost);

module.exports = router;
