const admin = require('firebase-admin');

// Same Firebase project as SiteLink_Backend (main app) — admin panel needs
// to be able to push to the exact same devices, so it must use the same
// credentials. Set FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL /
// FIREBASE_PRIVATE_KEY in this repo's .env (copy the same values used in
// SiteLink_Backend's .env).
if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ?.replace(/\\n/g, '\n')
    .replace(/^"|"$/g, '');

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

module.exports = admin;
