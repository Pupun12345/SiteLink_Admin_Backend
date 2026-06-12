const axios = require('axios');
const LINK="http://localhost:5000/api/community/posts/auto-approve" || "/api/community/posts/auto-approve"

// Auto-approve posts after 24 hours
const autoApprovePosts = async () => {
  try {
    const response = await axios.post(`${LINK}`);
    console.log('[CRON] Auto-approval check completed:', response.data.message);
  } catch (error) {
    console.error('[CRON] Error auto-approving posts:', error.message);
  }
};

// Run every hour to check for posts/jobs older than 24 hours
setInterval(autoApprovePosts, 60 * 60 * 1000); // 1 hour

// Run immediately on start
autoApprovePosts();

console.log('[CRON] Auto-approval job started - checking every hour for posts/jobs older than 24 hours');
