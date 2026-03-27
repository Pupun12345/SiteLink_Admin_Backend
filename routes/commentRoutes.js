const express = require('express');
const router = express.Router();
const {
  getCommentsByJob,
  createComment,
  updateComment,
  deleteComment,
} = require('../controllers/commentsController');
const { protect } = require('../middleware/auth');

// Job feed comment routes
router.get('/jobs/:jobId/comments', getCommentsByJob);
router.post('/jobs/:jobId/comments', protect, createComment);

// Single comment routes
router.put('/comments/:id', protect, updateComment);
router.delete('/comments/:id', protect, deleteComment);

module.exports = router;