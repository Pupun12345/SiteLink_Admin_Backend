const axios = require('axios');
const LINK = "http://localhost:5000/api/community/jobs/auto-approve";

// Auto-approve posts/jobs after 12 hours
const autoApproveJobs = async () => {
  try {
    const response = await axios.post(LINK);
    console.log('[CRON] Auto-approval check completed:', response.data.message);
  } catch (error) {
    console.error('[CRON] Error auto-approving jobs:', error.message);
  }
};

// Run every hour to check for jobs older than 12 hours
setInterval(autoApproveJobs, 60 * 60 * 1000);

// Run immediately on start
autoApproveJobs();

console.log('[CRON] Auto-approval job started - checking every hour for jobs older than 12 hours');
