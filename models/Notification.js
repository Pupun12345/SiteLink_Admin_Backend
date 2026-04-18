const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000
    },
    type: {
      type: String,
      enum: ['System', 'Verification', 'Subscription', 'Security', 'User', 'Job', 'Payment'],
      required: true,
      default: 'System'
    },
    category: {
      type: String,
      enum: ['info', 'warning', 'error', 'success'],
      default: 'info'
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    },
    status: {
      type: String,
      enum: ['Unread', 'Read', 'Archived'],
      default: 'Unread'
    },
    recipientType: {
      type: String,
      enum: ['admin', 'user', 'vendor', 'worker', 'all'],
      default: 'admin'
    },
    recipients: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      readAt: {
        type: Date
      },
      status: {
        type: String,
        enum: ['Unread', 'Read', 'Archived'],
        default: 'Unread'
      }
    }],
    relatedEntity: {
      entityType: {
        type: String,
        enum: ['User', 'Job', 'Post', 'Comment', 'Subscription', 'Payment']
      },
      entityId: {
        type: mongoose.Schema.Types.ObjectId
      }
    },
    actionUrl: {
      type: String,
      trim: true
    },
    actionText: {
      type: String,
      trim: true,
      maxlength: 50
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    isSystemGenerated: {
      type: Boolean,
      default: true
    },
    expiresAt: {
      type: Date
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for better query performance
notificationSchema.index({ type: 1, status: 1, createdAt: -1 });
notificationSchema.index({ recipientType: 1, status: 1 });
notificationSchema.index({ 'recipients.userId': 1, 'recipients.status': 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for formatted date
notificationSchema.virtual('formattedDate').get(function() {
  return this.createdAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
});


notificationSchema.statics.createSystemNotification = async function(data) {
  const notification = new this({
    ...data,
    isSystemGenerated: true,
    recipientType: 'admin'
  });
  return await notification.save();
};


notificationSchema.statics.createUserNotification = async function(userId, data) {
  const notification = new this({
    ...data,
    recipientType: 'user',
    recipients: [{ userId, status: 'Unread' }]
  });
  return await notification.save();
};

// Mark as read
notificationSchema.methods.markAsRead = async function(userId = null) {
  if (userId && this.recipients.length > 0) {
    const recipient = this.recipients.find(r => r.userId.toString() === userId.toString());
    if (recipient) {
      recipient.status = 'Read';
      recipient.readAt = new Date();
    }
  } else {
    this.status = 'Read';
  }
  return await this.save();
};

// Archive notification
notificationSchema.methods.archive = async function(userId = null) {
  if (userId && this.recipients.length > 0) {
    const recipient = this.recipients.find(r => r.userId.toString() === userId.toString());
    if (recipient) {
      recipient.status = 'Archived';
    }
  } else {
    this.status = 'Archived';
  }
  return await this.save();
};

module.exports = mongoose.model('Notification', notificationSchema);