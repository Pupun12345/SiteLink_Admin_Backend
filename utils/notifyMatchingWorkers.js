const admin = require('../config/firebase');
const User = require('../models/User');
const Skill = require('../models/Skill');
// Admin backend me users ke push records ka model ye hai (same 'notifications' collection)
const Notification = require('../models/UserPushNotification');
//
// App backend (SiteLink_Backend/utils/notifyMatchingWorkers.js) me bhi
// same logic hai — vendor ki jobs wahan se, admin ki jobs yahan se.

// ═══════════════════════════════════════════════════════════════════
//  NAYI JOB → WORKERS KO NOTIFICATION
// ═══════════════════════════════════════════════════════════════════
// Vendor / admin job post kare (aur wo live ho) to SAARE workers ko
// batate hain (blocked ko chhod ke). Pehle sirf skill + jagah milne par
// jaata tha — chhote platform par lagbhag kisi ki skill exactly match
// nahi hoti thi, to kisi ko notification hi nahi jaata tha.
//
// Jinki skill job se milti hai unhe khaas message ("aapki skill ki job")
// aur wo list me sabse pehle (MAX_WORKERS ki limit lage to bhi unhe
// zaroor mile). Har worker ko uski app-bhasha (hindi / english) me.
// Fire-and-forget: job banane ka response iska intezaar nahi karta.

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
  if (!skills.length) return false;
  const mine = [norm(worker.primarySkill), ...(worker.skills || []).map((s) => norm(s.skillName))]
    .filter(Boolean);
  return mine.some((m) => skills.some((s) => m === s || m.includes(s) || s.includes(m)));
}

function messageFor(job, lang, skillMatch) {
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
      title: (skillMatch ? `🎯 आपकी स्किल की नई जॉब: ${role}` : `नई जॉब: ${role}`).slice(0, 100),
      body: `${bits ? `${bits} — ` : ''}अप्लाई करने के लिए टैप करें`,
    };
  }
  return {
    title: (skillMatch ? `🎯 New job for your skill: ${role}` : `New job: ${role}`).slice(0, 100),
    body: `${bits ? `${bits} — ` : ''}Tap to view and apply`,
  };
}

async function notifyMatchingWorkers(job) {
  try {
    if (!job || job.approvalStatus !== 'approved' || job.isActive === false) return 0;

    const skills = await jobSkills(job);

    const workers = await User.find({
      userType: 'worker',
      isBlocked: { $ne: true },
      _id: { $ne: job.postedBy },
    })
      .select('primarySkill skills language fcmToken')
      .lean();

    // Skill wale pehle — limit lage to bhi unhe zaroor mile.
    const tagged = workers.map((w) => ({ ...w, skillMatch: workerHasSkill(w, skills) }));
    tagged.sort((a, b) => Number(b.skillMatch) - Number(a.skillMatch));
    const targets = tagged.slice(0, MAX_WORKERS);
    if (!targets.length) return 0;

    const data = { type: 'new_job', jobId: String(job._id) };

    // 1) In-app Alerts tab ke records (har worker ki bhasha me)
    await Notification.insertMany(
      targets.map((w) => {
        const m = messageFor(job, w.language, w.skillMatch);
        return { recipient: w._id, title: m.title, body: m.body, type: 'new_job', data };
      }),
      { ordered: false },
    );

    // 2) Phone par push — bhasha + skill-match ke hisaab se group, 500 ke batch
    const staleTokens = [];
    let pushed = 0;
    for (const lang of ['english', 'hindi']) {
      for (const skillMatch of [true, false]) {
        const group = targets.filter((w) => w.fcmToken
          && (w.language === 'hindi') === (lang === 'hindi')
          && w.skillMatch === skillMatch);
        if (!group.length) continue;
        const m = messageFor(job, lang, skillMatch);
        for (let i = 0; i < group.length; i += FCM_BATCH) {
          const batch = group.slice(i, i + FCM_BATCH);
          const res = await admin.messaging().sendEachForMulticast({
            tokens: batch.map((w) => w.fcmToken),
            notification: { title: m.title, body: m.body },
            data,
            android: { priority: 'high', notification: { channelId: 'sitelink_default_channel' } },
          });
          pushed += res.successCount;
          res.responses.forEach((r, idx) => {
            const code = r.error?.code || '';
            if (code.includes('registration-token-not-registered') || code.includes('invalid-registration-token')) {
              staleTokens.push(batch[idx]._id);
            }
          });
        }
      }
    }
    // App uninstall ho chuka — purana token hatao (aage ke push fail na hon)
    if (staleTokens.length) {
      await User.updateMany({ _id: { $in: staleTokens } }, { $set: { fcmToken: null } });
    }

    console.log(`[notifyMatchingWorkers] job ${job._id}: ${targets.length} worker(s) notified, `
      + `${pushed} push delivered, ${targets.filter((w) => w.skillMatch).length} skill match`
      + ` (skills: ${skills.join(', ') || '-'})`);
    return targets.length;
  } catch (err) {
    console.error('[notifyMatchingWorkers] failed:', err.message);
    return 0;
  }
}

module.exports = notifyMatchingWorkers;
