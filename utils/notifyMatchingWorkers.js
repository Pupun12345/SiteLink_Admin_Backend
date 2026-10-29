const admin = require('../config/firebase');
const User = require('../models/User');
const Skill = require('../models/Skill');
// Admin backend me users ke push records ka model ye hai (same 'notifications' collection)
const Notification = require('../models/UserPushNotification');

// ═══════════════════════════════════════════════════════════════════
//  NAYI JOB → SAHI WORKERS KO NOTIFICATION
// ═══════════════════════════════════════════════════════════════════
// Vendor / admin job post kare (aur wo live ho) to un workers ko batao
// jinke kaam ki hai — sabko nahi, warna spam lagta hai aur log
// notifications band kar dete hain.
//
// Kisko jaata hai:
//   1. Skill mile — job ke roles (ya title me likhi skill) worker ki
//      primarySkill / additional skills me ho.
//   2. Jagah mile — worker ka city ya state job ki location me ho, YA
//      worker "relocate ke liye taiyaar" ho.
//   3. Worker blocked na ho.
// Skill pata hi na chale (title me koi jaani-pehchani skill nahi) to
// sirf jagah se match karte hain. Na skill na jagah → kisi ko nahi.
//
// Har worker ko uski app-bhasha (hindi / english) me. Fire-and-forget:
// job banane ka response iska intezaar nahi karta.
//
// App backend (SiteLink_Backend/utils/notifyMatchingWorkers.js) me bhi
// same logic hai — vendor ki jobs wahan se, admin ki jobs yahan se.

const MAX_WORKERS = 5000;   // ek job par itne se zyada ko nahi
const FCM_BATCH = 500;      // FCM multicast ki limit

const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();

/// Job ki skills: roles me ho to wahi, warna title me jo skill naam aaye.
async function jobSkills(job) {
  const fromRoles = (job.roles || []).map((r) => norm(r.skill)).filter(Boolean);
  if (fromRoles.length) return [...new Set(fromRoles)];
  const title = norm(job.title);
  if (!title) return [];
  const all = await Skill.find({}).select('name').lean();
  return [...new Set(all.map((s) => norm(s.name)).filter((n) => n && title.includes(n)))];
}

function workerHasSkill(worker, skills) {
  if (!skills.length) return true;
  const mine = [norm(worker.primarySkill), ...(worker.skills || []).map((s) => norm(s.skillName))]
    .filter(Boolean);
  return mine.some((m) => skills.some((s) => m === s || m.includes(s) || s.includes(m)));
}

function workerNearJob(worker, location) {
  if (!location) return true;
  const city = norm(worker.city);
  const state = norm(worker.workState);
  return (city && location.includes(city))
    || (state && location.includes(state))
    || worker.willingtoRelocate === true;
}

function messageFor(job, skills, lang) {
  const role = (job.roles || []).length
    ? job.roles.map((r) => r.skill).join(', ')
    : (job.title || '').trim();
  const pay = job.salary
    ? `₹${job.salary}/${lang === 'hindi'
      ? ({ daily: 'दिन', weekly: 'हफ़्ता', monthly: 'महीना' }[job.salaryType] || job.salaryType || 'दिन')
      : ({ daily: 'day', weekly: 'week', monthly: 'month' }[job.salaryType] || job.salaryType || 'day')}`
    : null;
  const place = (job.location || '').split(',').slice(0, 2).join(',').trim();
  const bits = [pay, place].filter(Boolean).join(' · ');
  if (lang === 'hindi') {
    return {
      title: `नई जॉब: ${role}`.slice(0, 100),
      body: `${bits ? `${bits} — ` : ''}अप्लाई करने के लिए टैप करें`,
    };
  }
  return {
    title: `New job: ${role}`.slice(0, 100),
    body: `${bits ? `${bits} — ` : ''}Tap to view and apply`,
  };
}

async function notifyMatchingWorkers(job) {
  try {
    if (!job || job.approvalStatus !== 'approved' || job.isActive === false) return 0;

    const skills = await jobSkills(job);
    const location = norm(job.location);
    if (!skills.length && !location) return 0;

    const candidates = await User.find({
      userType: 'worker',
      isBlocked: { $ne: true },
      _id: { $ne: job.postedBy },
    })
      .select('primarySkill skills city workState willingtoRelocate language fcmToken')
      .lean();

    const matched = candidates
      .filter((w) => workerHasSkill(w, skills) && workerNearJob(w, location))
      .slice(0, MAX_WORKERS);
    if (!matched.length) return 0;

    const data = { type: 'new_job', jobId: String(job._id) };

    // 1) In-app Alerts tab ke records (har worker ki bhasha me)
    await Notification.insertMany(
      matched.map((w) => {
        const m = messageFor(job, skills, w.language);
        return { recipient: w._id, title: m.title, body: m.body, type: 'new_job', data };
      }),
      { ordered: false },
    );

    // 2) Phone par push — bhasha ke hisaab se group, 500-500 ke batch
    const staleTokens = [];
    for (const lang of ['english', 'hindi']) {
      const group = matched.filter((w) => w.fcmToken && (w.language === 'hindi') === (lang === 'hindi'));
      const m = messageFor(job, skills, lang);
      for (let i = 0; i < group.length; i += FCM_BATCH) {
        const batch = group.slice(i, i + FCM_BATCH);
        const res = await admin.messaging().sendEachForMulticast({
          tokens: batch.map((w) => w.fcmToken),
          notification: { title: m.title, body: m.body },
          data,
        });
        res.responses.forEach((r, idx) => {
          const code = r.error?.code || '';
          if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token')) {
            staleTokens.push(batch[idx]._id);
          }
        });
      }
    }
    // App uninstall ho chuka — purana token hatao (aage ke push fail na hon)
    if (staleTokens.length) {
      await User.updateMany({ _id: { $in: staleTokens } }, { $set: { fcmToken: null } });
    }

    console.log(`[notifyMatchingWorkers] job ${job._id}: ${matched.length} worker(s) notified`
      + ` (skills: ${skills.join(', ') || '-'})`);
    return matched.length;
  } catch (err) {
    console.error('[notifyMatchingWorkers] failed:', err.message);
    return 0;
  }
}

module.exports = notifyMatchingWorkers;
