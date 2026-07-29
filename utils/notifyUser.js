const User = require('../models/User');
const UserPushNotification = require('../models/UserPushNotification');
const sendNotification = require('./sendNotification');

// Admin-panel equivalent of SiteLink_Backend's utils/notifyUser.js — same
// "create in-app record, best-effort push" pattern, so admin-triggered
// events (verify/reject, broadcasts) show up in the user's Alerts tab and
// as a real device push, exactly like vendor/worker-triggered events do.
const notifyUser = async (userId, { title, body, type = 'general', data = {} }) => {
  if (!userId) return null;

  const record = await UserPushNotification.create({
    recipient: userId,
    title,
    body,
    type,
    data,
  });

  try {
    const user = await User.findById(userId).select('fcmToken');
    if (user?.fcmToken) {
      await sendNotification(user.fcmToken, title, body, { type, ...data });
    }
  } catch (error) {
    console.error(`[notifyUser] push failed for user ${userId}:`, error.message);
  }

  return record;
};

module.exports = notifyUser;
