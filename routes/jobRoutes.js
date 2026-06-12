const express = require('express');
const router = express.Router();
const {
  getJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  updateApplicationStatus,
  getJobApplications,
  likeUnlikeJob,
  addJobComment,
  getJobComments,
  deleteJobComment,
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

// GET applications for a job (protected)
router.get('/:id/applications', protect, getJobApplications);

// PUT update application status (protected)
router.put('/:jobId/applications/:applicationId', protect, updateApplicationStatus);

// PUT like/unlike job (protected)
router.put('/:jobId/like', protect, likeUnlikeJob);

// POST add comment to job (protected)
router.post('/:id/comments', protect, addJobComment);

// GET comments for a job
router.get('/:id/comments', getJobComments);

// DELETE comment from job (protected)
router.delete('/:jobId/comments/:commentId', protect, deleteJobComment);

module.exports = router;