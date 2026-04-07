const express = require('express');
const router = express.Router();
const {
  getJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  getCommentsByJob,
  addComment,
  updateComment,
  deleteComment,
  toggleCommentLike,
} = require('../controllers/jobsController');
const { protect } = require('../middleware/auth');

// GET all jobs
router.get('/', getJobs);

// GET single job
router.get('/:id', getJobById);

// POST create job (protected)
router.post('/', protect, createJob);

// PUT update job (protected)
router.put('/:id', protect, updateJob);

// DELETE job (protected)
router.delete('/:id', protect, deleteJob);

// Comment routes
// GET comments for a job
router.get('/:id/comments', getCommentsByJob);

// POST add comment to job (protected)
router.post('/:id/comments', protect, addComment);

// PUT update comment (protected)
router.put('/:jobId/comments/:commentId', protect, updateComment);

// DELETE comment (protected)
router.delete('/:jobId/comments/:commentId', protect, deleteComment);

// PUT like/unlike comment (protected)
router.put('/:jobId/comments/:commentId/like', protect, toggleCommentLike);

module.exports = router;