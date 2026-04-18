const Notification = require('../models/Notification');
const User = require('../models/User');
const Job = require('../models/job');

// @desc    Get all notifications with filtering and pagination
// @route   GET /api/notifications
// @access  Private (Admin)
exports.getNotifications = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      type = 'all',
      status = 'all',
      priority = 'all',
      category = 'all',
      search = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    let filter = {};
    
    if (type !== 'all') {
      filter.type = type;
    }
    
    if (status !== 'all') {
      filter.status = status;
    }
    
    if (priority !== 'all') {
      filter.priority = priority;
    }
    
    if (category !== 'all') {
      filter.category = category;
    }
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ];
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const notifications = await Notification.find(filter)
      .populate('createdBy', 'name email')
      .populate('recipients.userId', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const totalNotifications = await Notification.countDocuments(filter);

    const stats = await Notification.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          unread: { $sum: { $cond: [{ $eq: ['$status', 'Unread'] }, 1, 0] } },
          read: { $sum: { $cond: [{ $eq: ['$status', 'Read'] }, 1, 0] } },
          archived: { $sum: { $cond: [{ $eq: ['$status', 'Archived'] }, 1, 0] } },
          critical: { $sum: { $cond: [{ $eq: ['$priority', 'critical'] }, 1, 0] } },
          high: { $sum: { $cond: [{ $eq: ['$priority', 'high'] }, 1, 0] } },
          system: { $sum: { $cond: [{ $eq: ['$type', 'System'] }, 1, 0] } },
          verification: { $sum: { $cond: [{ $eq: ['$type', 'Verification'] }, 1, 0] } },
          subscription: { $sum: { $cond: [{ $eq: ['$type', 'Subscription'] }, 1, 0] } }
        }
      }
    ]);

    const summary = stats[0] || {
      total: 0,
      unread: 0,
      read: 0,
      archived: 0,
      critical: 0,
      high: 0,
      system: 0,
      verification: 0,
      subscription: 0
    };

    res.status(200).json({
      success: true,
      data: notifications,
      pagination: {
        current: parseInt(page),
        limit: parseInt(limit),
        total: totalNotifications,
        pages: Math.ceil(totalNotifications / parseInt(limit))
      },
      summary,
      filters: {
        type,
        status,
        priority,
        category,
        search,
        sortBy,
        sortOrder
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message
    });
  }
};

// @desc    Get single notification by ID
// @route   GET /api/notifications/:id
// @access  Private (Admin)
exports.getNotificationById = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('recipients.userId', 'name email');

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.status(200).json({
      success: true,
      data: notification
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notification',
      error: error.message
    });
  }
};

// @desc    Create new notification
// @route   POST /api/notifications
// @access  Private (Admin)
exports.createNotification = async (req, res) => {
  try {
    const {
      title,
      message,
      type,
      category,
      priority,
      recipientType,
      recipients,
      actionUrl,
      actionText,
      metadata,
      expiresAt
    } = req.body;

    // Validate required fields
    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Title and message are required'
      });
    }

    const notificationData = {
      title,
      message,
      type: type || 'System',
      category: category || 'info',
      priority: priority || 'medium',
      recipientType: recipientType || 'admin',
      actionUrl,
      actionText,
      metadata: metadata || {},
      createdBy: req.user.id,
      isSystemGenerated: false
    };

    if (expiresAt) {
      notificationData.expiresAt = new Date(expiresAt);
    }

    // Handle recipients
    if (recipients && Array.isArray(recipients)) {
      notificationData.recipients = recipients.map(userId => ({
        userId,
        status: 'Unread'
      }));
    }

    const notification = await Notification.create(notificationData);
    
    await notification.populate('createdBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'Notification created successfully',
      data: notification
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create notification',
      error: error.message
    });
  }
};

// @desc    Update notification
// @route   PUT /api/notifications/:id
// @access  Private (Admin)
exports.updateNotification = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    const allowedUpdates = ['title', 'message', 'type', 'category', 'priority', 'status', 'actionUrl', 'actionText', 'metadata'];
    const updates = {};

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    Object.assign(notification, updates);
    await notification.save();

    await notification.populate('createdBy', 'name email');

    res.status(200).json({
      success: true,
      message: 'Notification updated successfully',
      data: notification
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update notification',
      error: error.message
    });
  }
};

// @desc    Delete notification
// @route   DELETE /api/notifications/:id
// @access  Private (Admin)
exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    await Notification.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
      error: error.message
    });
  }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    await notification.markAsRead(req.user.id);

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: notification
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message
    });
  }
};

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/mark-all-read
// @access  Private (Admin)
exports.markAllAsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { status: 'Unread' },
      { status: 'Read' }
    );

    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} notifications marked as read`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
      error: error.message
    });
  }
};

// @desc    Archive notification
// @route   PUT /api/notifications/:id/archive
// @access  Private
exports.archiveNotification = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    await notification.archive(req.user.id);

    res.status(200).json({
      success: true,
      message: 'Notification archived successfully',
      data: notification
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to archive notification',
      error: error.message
    });
  }
};

// @desc    Generate system notifications based on current system state
// @route   POST /api/notifications/generate-system
// @access  Private (Admin)
exports.generateSystemNotifications = async (req, res) => {
  try {
    const notifications = [];

    const pendingUsers = await User.countDocuments({ 
      verificationStatus: 'pending' 
    });

    if (pendingUsers > 0) {
      const notification = await Notification.createSystemNotification({
        title: 'Pending User Verifications',
        message: `${pendingUsers} user${pendingUsers > 1 ? 's' : ''} pending verification review`,
        type: 'Verification',
        category: 'warning',
        priority: pendingUsers > 10 ? 'high' : 'medium',
        actionUrl: '/admin/user-management',
        actionText: 'Review Users',
        metadata: { count: pendingUsers }
      });
      notifications.push(notification);
    }

    // Recent job postings
    const recentJobs = await Job.countDocuments({
      createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });

    if (recentJobs > 5) {
      const notification = await Notification.createSystemNotification({
        title: 'High Job Activity',
        message: `${recentJobs} new jobs posted in the last 24 hours`,
        type: 'System',
        category: 'info',
        priority: 'medium',
        actionUrl: '/admin/jobs',
        actionText: 'View Jobs',
        metadata: { count: recentJobs, timeframe: '24h' }
      });
      notifications.push(notification);
    }

    // System health (memory usage)
    const memoryUsage = process.memoryUsage();
    const heapUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

    if (heapUsagePercent > 70) {
      const notification = await Notification.createSystemNotification({
        title: 'Memory Usage Alert',
        message: `System memory usage is at ${heapUsagePercent.toFixed(1)}%`,
        type: 'System',
        category: 'warning',
        priority: heapUsagePercent > 85 ? 'critical' : 'high',
        actionUrl: '/admin/system-monitoring',
        actionText: 'View System Health',
        metadata: { 
          heapUsagePercent: heapUsagePercent.toFixed(1),
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal
        }
      });
      notifications.push(notification);
    }

    res.status(200).json({
      success: true,
      message: `Generated ${notifications.length} system notifications`,
      data: notifications
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate system notifications',
      error: error.message
    });
  }
};

// @desc    Get notification statistics
// @route   GET /api/notifications/stats
// @access  Private (Admin)
exports.getNotificationStats = async (req, res) => {
  try {
    const { timeframe = '7d' } = req.query;
    
    // Calculate time range
    const now = new Date();
    let startTime;
    
    switch (timeframe) {
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Get comprehensive statistics
    const stats = await Notification.aggregate([
      {
        $facet: {
          overall: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                unread: { $sum: { $cond: [{ $eq: ['$status', 'Unread'] }, 1, 0] } },
                read: { $sum: { $cond: [{ $eq: ['$status', 'Read'] }, 1, 0] } },
                archived: { $sum: { $cond: [{ $eq: ['$status', 'Archived'] }, 1, 0] } }
              }
            }
          ],
          byType: [
            {
              $group: {
                _id: '$type',
                count: { $sum: 1 },
                unread: { $sum: { $cond: [{ $eq: ['$status', 'Unread'] }, 1, 0] } }
              }
            }
          ],
          byPriority: [
            {
              $group: {
                _id: '$priority',
                count: { $sum: 1 },
                unread: { $sum: { $cond: [{ $eq: ['$status', 'Unread'] }, 1, 0] } }
              }
            }
          ],
          recent: [
            {
              $match: {
                createdAt: { $gte: startTime }
              }
            },
            {
              $group: {
                _id: null,
                count: { $sum: 1 }
              }
            }
          ],
          timeline: [
            {
              $match: {
                createdAt: { $gte: startTime }
              }
            },
            {
              $group: {
                _id: {
                  $dateToString: {
                    format: '%Y-%m-%d',
                    date: '$createdAt'
                  }
                },
                count: { $sum: 1 },
                unread: { $sum: { $cond: [{ $eq: ['$status', 'Unread'] }, 1, 0] } }
              }
            },
            {
              $sort: { '_id': 1 }
            }
          ]
        }
      }
    ]);

    const result = stats[0];

    res.status(200).json({
      success: true,
      data: {
        overall: result.overall[0] || { total: 0, unread: 0, read: 0, archived: 0 },
        byType: result.byType,
        byPriority: result.byPriority,
        recent: result.recent[0]?.count || 0,
        timeline: result.timeline,
        timeframe
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get notification statistics',
      error: error.message
    });
  }
};