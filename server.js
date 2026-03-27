const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const skillsRoutes = require('./routes/skillsRoutes');
const jobRoutes = require('./routes/jobRoutes');
const commentRoutes = require('./routes/commentRoutes');
const statsRoutes = require('./routes/statsRoutes');
const searchRoutes = require('./routes/searchRoutes');
const adminRoutes = require('./routes/adminRoutes');
const communityRoutes = require('./routes/communityRoutes');
const workerHomeRoutes = require('./routes/workerHomePage');

// Load env variables
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (uploaded images)
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/skills', skillsRoutes);
app.use('/api/profile', require('./routes/profileRoutes'));
app.use('/api/help-support', require('./routes/helpSupportRoutes'));
app.use('/api/jobs', jobRoutes);
app.use('/api', commentRoutes);
app.use('/api/legal', require('./routes/legalRoutes'));
app.use('/api/stats', statsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/worker', workerHomeRoutes);

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
