const admin = require("../config/firebase");

// `data` values must all be strings for FCM — non-string values (ids, numbers)
// get stringified here so callers can just pass plain objects.
const sendNotification = async (token, title, body, data = {}) => {
    if (!token) throw new Error("FCM token is required");

    const stringData = Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, v === null || v === undefined ? '' : String(v)])
    );

    const message = {
        notification: { title, body },
        data: stringData,
        token,
    };

    const response = await admin.messaging().send(message);
    console.log("Notification sent:", response);
    return response;
};

module.exports = sendNotification;
