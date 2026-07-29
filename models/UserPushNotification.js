const mongoose = require('mongoose');

// Mirrors SiteLink_Backend's `models/Notification.js` schema EXACTLY and
// points at the SAME physical collection ('notifications') on purpose —
// this repo's own `models/Notification.js` is a different, admin-dashboard-
// only alert log (recipients[], category, priority...) that already shares
// that collection name too. Giving this one an explicit collection name +
// a distinct model name avoids clashing with that existing model while
// writing records the main backend/Flutter app can read as a normal
// per-user push notification (GET /api/notifications, the user's Alerts tab).
const schema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  title: { type: String, required: true },
  body: { type: String, required: true },
  type: {
    type: String,
    enum: [
      'job_approved',
      'job_rejected',
      'job_closed',
      'new_application',
      'application_status',
      'new_comment',
      'new_like',
      'vendor_verified',
      'vendor_rejected',
      'worker_verified',
      'worker_rejected',
      'subscription_activated',
      'phone_changed',
      'general',
    ],
    default: 'general',
  },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  isRead: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('UserPushNotification', schema, 'notifications');
