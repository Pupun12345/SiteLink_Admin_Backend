const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const skillsRoutes = require('./routes/skillsRoutes');
const jobRoutes = require('./routes/jobRoutes');
const statsRoutes = require('./routes/statsRoutes');
const searchRoutes = require('./routes/searchRoutes');
const adminRoutes = require('./routes/adminRoutes');
const communityRoutes = require('./routes/communityRoutes');
const workerHomeRoutes = require('./routes/workerHomePage');
const systemRoutes = require('./routes/systemRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const platformSettingRoutes = require('./routes/platformSettingRoutes');

// Load env variables
dotenv.config();

// Connect to database
connectDB();

const app = express();

// API Request Tracking Middleware
let apiRequestTracker = {
  requests: [],
  errors: [],
  startTime: Date.now()
};

const trackApiRequest = (req, res, next) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    const requestData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTime,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress
    };
    
    // Keep only last 1000 requests to prevent memory issues
    apiRequestTracker.requests.push(requestData);
    if (apiRequestTracker.requests.length > 1000) {
      apiRequestTracker.requests.shift();
    }
    
    // Track errors
    if (res.statusCode >= 400) {
      apiRequestTracker.errors.push(requestData);
      if (apiRequestTracker.errors.length > 100) {
        apiRequestTracker.errors.shift();
      }
    }
  });
  
  next();
};

// Make tracker available globally for system controller
global.apiRequestTracker = apiRequestTracker;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add API request tracking middleware
app.use('/api', trackApiRequest);

// Serve static files (uploaded images)
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/skills', skillsRoutes);
app.use('/api/profile', require('./routes/profileRoutes'));
app.use('/api/help-support', require('./routes/helpSupportRoutes'));
app.use('/api/jobs', jobRoutes);
app.use('/api/legal', require('./routes/legalRoutes'));
app.use('/api/stats', statsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/worker', workerHomeRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/platform-settings', platformSettingRoutes);
app.use('/api/settings', require('./routes/settingRoutes'));

// Root route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'SiteLink API is running',
    version: '1.0.0',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Error handler
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
