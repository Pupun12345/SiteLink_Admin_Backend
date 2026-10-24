const Subscription = require('../models/Subscription');
const User = require('../models/User');

/**
 * Runs every hour.
 * Finds all subscriptions where endDate has passed but status is still active,
 * marks them expired, and sets user.subscription = false.
 */
const expireSubscriptions = async () => {
  try {
    const now = new Date();

    // Find all active subscriptions whose endDate is in the past
    const expired = await Subscription.find({
      status: 'active',
      endDate: { $lt: now },
    }).select('_id user');

    if (expired.length === 0) return;

    const ids = expired.map(s => s._id);
    const userIds = expired.map(s => s.user);

    // Bulk update subscription status → expired
    await Subscription.updateMany(
      { _id: { $in: ids } },
      { $set: { status: 'expired' } }
    );

    // Bulk update user.subscription → false for affected users
    await User.updateMany(
      { subscriptionId: { $in: ids } },
      { $set: { subscription: false } }
    );

    console.log(`[SubscriptionCron] Expired ${expired.length} subscription(s) for user IDs: ${userIds.join(', ')}`);
  } catch (err) {
    console.error('[SubscriptionCron] Error expiring subscriptions:', err.message);
  }
};

module.exports = expireSubscriptions;
