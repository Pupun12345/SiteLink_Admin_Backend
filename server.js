const express = require('express');
const app = express();
const dotenv = require('dotenv');
const cors = require('cors');

// Load environment variables FIRST
dotenv.config();

const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const skillsRoutes = require('./routes/skillsRoutes');
const jobRoutes = require('./routes/jobRoutes');
const statsRoutes = require('./routes/statsRoutes');
const searchRoutes = require('./routes/searchRoutes');
const adminRoutes = require('./routes/adminRoutes');
const adminUserRoutes = require('./routes/adminUserRoutes');
const forgotPasswordRoutes = require('./routes/forgotPasswordRoutes');
const communityRoutes = require('./routes/communityRoutes');
const workerHomeRoutes = require('./routes/workerHomePage');
const systemRoutes = require('./routes/systemRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const platformSettingRoutes = require('./routes/platformSettingRoutes');
const amenityRoutes = require("./routes/amenityRoutes");
const { trackApiRequest } = require('./middleware/apiTracker');

// API Request Tracking Middleware
app.use(trackApiRequest)
app.use('/api', trackApiRequest);

// Serve static files (uploaded images) - IMPORTANT: This must be before routes
const path = require('path');
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/auth', forgotPasswordRoutes);
app.use('/api/skills', skillsRoutes);
app.use('/api/profile', require('./routes/profileRoutes'));
app.use('/api/help-support', require('./routes/helpSupportRoutes'));
app.use('/api/jobs', jobRoutes);
app.use('/api/legal', require('./routes/legalRoutes'));
app.use('/api/stats', statsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin-users', adminUserRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/worker', workerHomeRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/platform-settings', platformSettingRoutes);
app.use("/api/amenities", amenityRoutes);



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
  connectDB();
});