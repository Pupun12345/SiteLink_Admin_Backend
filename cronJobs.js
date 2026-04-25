const axios = require('axios');
const LINK="http://localhost:5000/api/community/posts/auto-approve" || "/api/community/posts/auto-approve"

// Auto-approve posts
const autoApprovePosts = async () => {
  try {
    const response = await axios.post(`${LINK}`);
  } catch (error) {
    console.error('[CRON] Error auto-approving posts:', error.message);
  }
};

// Run every 5 minutes
setInterval(autoApprovePosts, 5 * 60 * 1000);

// Run immediately on start
autoApprovePosts();
