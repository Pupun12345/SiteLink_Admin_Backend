const express = require('express');
const router = express.Router();
const {
  getNotifications,
  getNotificationById,
  createNotification,
  updateNotification,
  deleteNotification,
  markAsRead,
  markAllAsRead,
  archiveNotification,
  generateSystemNotifications,
  getNotificationStats
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

// Middleware to check if user is admin
const adminOnly = (req, res, next) => {
  if (req.user && (req.user.userType === 'admin' || req.user.role === 'admin')) {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }
};

// GET all notifications with filtering and pagination
router.get('/', protect, adminOnly, getNotifications);

// GET notification statistics
router.get('/stats', protect, adminOnly, getNotificationStats);

// POST generate system notifications
router.post('/generate-system', protect, adminOnly, generateSystemNotifications);

// PUT mark all notifications as read
router.put('/mark-all-read', protect, adminOnly, markAllAsRead);

// GET single notification by ID
router.get('/:id', protect, adminOnly, getNotificationById);

// POST create new notification
router.post('/', protect, adminOnly, createNotification);

// PUT update notification
router.put('/:id', protect, adminOnly, updateNotification);

// DELETE notification
router.delete('/:id', protect, adminOnly, deleteNotification);

// PUT mark notification as read
router.put('/:id/read', protect, markAsRead);

// PUT archive notification
router.put('/:id/archive', protect, archiveNotification);

module.exports = router;