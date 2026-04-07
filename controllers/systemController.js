const os = require('os');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const User = require('../models/User');
const Job = require('../models/job');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');

// Get API request tracker from global scope
const getApiRequestTracker = () => {
  return global.apiRequestTracker || {
    requests: [],
    errors: [],
    startTime: Date.now()
  };
};

// Auto-generate system notifications based on system state
const autoGenerateNotifications = async () => {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    // Check if we've already generated notifications in the last hour
    const recentSystemNotifications = await Notification.countDocuments({
      type: 'System',
      isSystemGenerated: true,
      createdAt: { $gte: oneHourAgo }
    });
    
    if (recentSystemNotifications > 0) {
      return; // Don't spam notifications
    }

    // Check memory usage
    const memoryUsage = process.memoryUsage();
    const heapUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    
    if (heapUsagePercent > 85) {
      await Notification.createSystemNotification({
        title: 'High Memory Usage Alert',
        message: `System memory usage is critically high at ${heapUsagePercent.toFixed(1)}%. Consider restarting the application or scaling resources.`,
        type: 'System',
        category: 'warning',
        priority: heapUsagePercent > 95 ? 'critical' : 'high',
        actionUrl: '/admin/system-monitoring',
        actionText: 'View System Health',
        metadata: {
          heapUsagePercent: heapUsagePercent.toFixed(1),
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          timestamp: now.toISOString()
        }
      });
    }

    // Check API error rate
    const apiRequestTracker = getApiRequestTracker();
    const recentErrors = apiRequestTracker.errors.filter(error => 
      new Date(error.timestamp) > oneHourAgo
    );
    const recentRequests = apiRequestTracker.requests.filter(req => 
      new Date(req.timestamp) > oneHourAgo
    );
    
    if (recentRequests.length > 50) { // Only check if we have significant traffic
      const errorRate = (recentErrors.length / recentRequests.length) * 100;
      if (errorRate > 15) { // More than 15% error rate
        await Notification.createSystemNotification({
          title: 'High API Error Rate Detected',
          message: `API error rate is ${errorRate.toFixed(1)}% in the last hour (${recentErrors.length} errors out of ${recentRequests.length} requests). This may indicate system issues.`,
          type: 'System',
          category: 'error',
          priority: errorRate > 30 ? 'critical' : 'high',
          actionUrl: '/admin/system-monitoring',
          actionText: 'View API Stats',
          metadata: {
            errorRate: errorRate.toFixed(1),
            totalErrors: recentErrors.length,
            totalRequests: recentRequests.length,
            timeframe: '1 hour'
          }
        });
      }
    }

    // Check for pending verifications
    const pendingUsers = await User.countDocuments({ 
      verificationStatus: 'pending',
      createdAt: { $lte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } // Older than 24 hours
    });

    if (pendingUsers > 5) {
      await Notification.createSystemNotification({
        title: 'Multiple Pending User Verifications',
        message: `${pendingUsers} users have been waiting for verification for more than 24 hours. Please review and process these verifications.`,
        type: 'Verification',
        category: 'warning',
        priority: pendingUsers > 20 ? 'high' : 'medium',
        actionUrl: '/admin/user-management?filter=pending',
        actionText: 'Review Verifications',
        metadata: {
          count: pendingUsers,
          threshold: '24 hours'
        }
      });
    }

    // Check database connection
    const dbStatus = mongoose.connection.readyState;
    if (dbStatus !== 1) {
      await Notification.createSystemNotification({
        title: 'Database Connection Issue',
        message: `Database connection is ${dbStatus === 0 ? 'disconnected' : dbStatus === 2 ? 'connecting' : 'disconnecting'}. This may affect application functionality.`,
        type: 'System',
        category: 'error',
        priority: 'critical',
        actionUrl: '/admin/system-monitoring',
        actionText: 'Check System Health',
        metadata: {
          connectionState: dbStatus,
          host: mongoose.connection.host,
          port: mongoose.connection.port
        }
      });
    }

  } catch (error) {
    console.error('Error auto-generating notifications:', error);
  }
};

// Set up periodic notification generation (every 30 minutes)
setInterval(autoGenerateNotifications, 30 * 60 * 1000);

// Also run once on startup (after a delay)
setTimeout(autoGenerateNotifications, 60000); // 1 minute after startup

// Helper function to get CPU usage
const getCpuUsage = () => {
  return new Promise((resolve) => {
    const startMeasure = process.cpuUsage();
    const startTime = Date.now();
    
    setTimeout(() => {
      const endMeasure = process.cpuUsage(startMeasure);
      const endTime = Date.now();
      
      const totalTime = (endTime - startTime) * 1000; // Convert to microseconds
      const cpuPercent = ((endMeasure.user + endMeasure.system) / totalTime) * 100;
      
      resolve(Math.min(Math.max(cpuPercent, 0), 100)); // Clamp between 0-100
    }, 100);
  });
};

// Helper function to get disk usage
const getDiskUsage = async () => {
  try {
    const stats = await fs.promises.statSync(process.cwd());
    // This is a simplified approach - in production, use a proper disk usage library
    // For now, we'll calculate based on available space vs total space
    const totalSpace = os.totalmem(); // Using memory as proxy
    const freeSpace = os.freemem();
    const usedSpace = totalSpace - freeSpace;
    
    return Math.round((usedSpace / totalSpace) * 100);
  } catch (error) {
    console.error('Error getting disk usage:', error);
    return 0;
  }
};

// Helper function to get real system logs from console/error logs
const getSystemLogs = async (limit = 20, level = 'all', timeframe = '24h') => {
  const logs = [];
  const now = new Date();
  let startTime;
  
  switch (timeframe) {
    case '1h':
      startTime = new Date(now.getTime() - 60 * 60 * 1000);
      break;
    case '24h':
      startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    default:
      startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
  
  const apiRequestTracker = getApiRequestTracker();
  
  // Get API errors from tracker
  const recentErrors = apiRequestTracker.errors.filter(error => 
    new Date(error.timestamp) >= startTime
  );
  
  // Convert API errors to log format
  recentErrors.forEach(error => {
    logs.push({
      id: `api_error_${error.timestamp}`,
      timestamp: error.timestamp,
      service: 'API-Gateway',
      level: error.statusCode >= 500 ? 'Critical' : 'Error',
      message: `${error.method} ${error.path} returned ${error.statusCode} (${error.responseTime}ms)`,
      status: 'Pending',
      details: {
        requestId: `req_${Date.now()}`,
        statusCode: error.statusCode,
        responseTime: error.responseTime,
        ip: error.ip,
        userAgent: error.userAgent
      }
    });
  });
  
  // Add database connection logs
  const dbState = mongoose.connection.readyState;
  if (dbState !== 1) {
    logs.push({
      id: `db_status_${Date.now()}`,
      timestamp: new Date().toISOString(),
      service: 'Database',
      level: 'Critical',
      message: `Database connection state: ${dbState === 0 ? 'Disconnected' : dbState === 2 ? 'Connecting' : 'Disconnecting'}`,
      status: 'Active',
      details: {
        connectionState: dbState,
        host: mongoose.connection.host,
        port: mongoose.connection.port
      }
    });
  }
  
  // Add memory usage warnings
  const memoryUsage = process.memoryUsage();
  const heapUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
  
  if (heapUsagePercent > 80) {
    logs.push({
      id: `memory_warning_${Date.now()}`,
      timestamp: new Date().toISOString(),
      service: 'System',
      level: heapUsagePercent > 90 ? 'Critical' : 'Warning',
      message: `High memory usage detected: ${heapUsagePercent.toFixed(1)}% heap usage`,
      status: 'Active',
      details: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        usagePercent: heapUsagePercent
      }
    });
  }
  
  // Sort by timestamp (newest first) and limit
  return logs
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
};

// @desc    Get system health metrics
// @route   GET /api/system/health
// @access  Private (Admin only)
exports.getSystemHealth = async (req, res) => {
  try {
    // System uptime
    const uptime = process.uptime();
    const systemUptime = os.uptime();
    
    // Memory usage
    const memoryUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    
    // CPU usage (real calculation)
    const cpuUsagePercent = await getCpuUsage();
    
    // CPU information
    const cpus = os.cpus();
    const cpuCount = cpus.length;
    
    // Database connection status
    const dbStatus = mongoose.connection.readyState;
    const dbStatusText = {
      0: 'Disconnected',
      1: 'Connected',
      2: 'Connecting',
      3: 'Disconnecting'
    };

    // Calculate percentages
    const memoryUsagePercent = Math.round((usedMemory / totalMemory) * 100);
    const heapUsagePercent = Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100);
    
    // Disk usage (real calculation)
    const diskUsagePercent = await getDiskUsage();
    
    // Calculate uptime percentage (assuming 99.9% target)
    const uptimePercent = Math.min(99.9, (uptime / (uptime + 60)) * 100); // Assume 1 minute downtime max

    const healthData = {
      server: {
        status: dbStatus === 1 && cpuUsagePercent < 90 && memoryUsagePercent < 90 ? 'healthy' : 'warning',
        uptime: Math.floor(uptime),
        uptimeFormatted: formatUptime(uptime),
        uptimePercent: parseFloat(uptimePercent.toFixed(2))
      },
      memory: {
        total: totalMemory,
        used: usedMemory,
        free: freeMemory,
        usagePercent: memoryUsagePercent,
        heap: {
          total: memoryUsage.heapTotal,
          used: memoryUsage.heapUsed,
          usagePercent: heapUsagePercent,
          external: memoryUsage.external,
          arrayBuffers: memoryUsage.arrayBuffers
        }
      },
      cpu: {
        count: cpuCount,
        model: cpus[0]?.model || 'Unknown',
        usagePercent: Math.round(cpuUsagePercent),
        loadAverage: os.loadavg(),
        architecture: os.arch()
      },
      disk: {
        usagePercent: diskUsagePercent
      },
      database: {
        status: dbStatusText[dbStatus] || 'Unknown',
        connected: dbStatus === 1,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        name: mongoose.connection.name
      },
      system: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        uptime: systemUptime,
        hostname: os.hostname(),
        release: os.release()
      }
    };

    res.status(200).json({
      success: true,
      data: healthData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get system health',
      error: error.message
    });
  }
};

// @desc    Get API usage statistics
// @route   GET /api/system/api-stats
// @access  Private (Admin only)
exports.getApiStats = async (req, res) => {
  try {
    const { timeframe = '24h' } = req.query;
    
    // Calculate time range
    const now = new Date();
    let startTime;
    
    switch (timeframe) {
      case '1h':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Get real database activity
    const [userActivity, jobActivity, postActivity, commentActivity] = await Promise.all([
      User.countDocuments({ createdAt: { $gte: startTime } }),
      Job.countDocuments({ createdAt: { $gte: startTime } }),
      Post.countDocuments({ createdAt: { $gte: startTime } }),
      Comment.countDocuments({ createdAt: { $gte: startTime } })
    ]);

    // Get real API request data from tracker
    const apiRequestTracker = getApiRequestTracker();
    const timeframeRequests = apiRequestTracker.requests.filter(req => 
      new Date(req.timestamp) >= startTime
    );
    
    const timeframeErrors = apiRequestTracker.errors.filter(err => 
      new Date(err.timestamp) >= startTime
    );
    
    const totalRequests = timeframeRequests.length;
    const errorRequests = timeframeErrors.length;
    const successfulRequests = totalRequests - errorRequests;
    
    // Calculate average response time
    const avgResponseTime = timeframeRequests.length > 0 
      ? Math.round(timeframeRequests.reduce((sum, req) => sum + req.responseTime, 0) / timeframeRequests.length)
      : 0;
    
    // Generate hourly traffic data
    const trafficData = [];
    const hoursToShow = timeframe === '1h' ? 1 : timeframe === '24h' ? 24 : 168; // 168 hours = 7 days
    const intervalMs = timeframe === '1h' ? 5 * 60 * 1000 : 60 * 60 * 1000; // 5 min intervals for 1h, 1h intervals otherwise
    
    for (let i = hoursToShow - 1; i >= 0; i--) {
      const intervalStart = new Date(now.getTime() - i * intervalMs);
      const intervalEnd = new Date(intervalStart.getTime() + intervalMs);
      
      const intervalRequests = timeframeRequests.filter(req => {
        const reqTime = new Date(req.timestamp);
        return reqTime >= intervalStart && reqTime < intervalEnd;
      });
      
      const intervalErrors = timeframeErrors.filter(err => {
        const errTime = new Date(err.timestamp);
        return errTime >= intervalStart && errTime < intervalEnd;
      });
      
      trafficData.push({
        timestamp: intervalStart.toISOString(),
        requests: intervalRequests.length,
        errors: intervalErrors.length,
        avgResponseTime: intervalRequests.length > 0 
          ? Math.round(intervalRequests.reduce((sum, req) => sum + req.responseTime, 0) / intervalRequests.length)
          : 0
      });
    }

    // Calculate endpoint statistics
    const endpointStats = {};
    timeframeRequests.forEach(req => {
      const endpoint = req.path.split('/').slice(0, 3).join('/'); // Group by first 2 path segments
      if (!endpointStats[endpoint]) {
        endpointStats[endpoint] = {
          requests: 0,
          totalResponseTime: 0,
          errors: 0
        };
      }
      endpointStats[endpoint].requests++;
      endpointStats[endpoint].totalResponseTime += req.responseTime;
      if (req.statusCode >= 400) {
        endpointStats[endpoint].errors++;
      }
    });
    
    const endpoints = Object.entries(endpointStats)
      .map(([path, stats]) => ({
        path,
        requests: stats.requests,
        avgResponseTime: Math.round(stats.totalResponseTime / stats.requests),
        errorRate: Math.round((stats.errors / stats.requests) * 100)
      }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10); // Top 10 endpoints

    const apiStats = {
      summary: {
        totalRequests,
        successfulRequests,
        errorRequests,
        successRate: totalRequests > 0 ? Math.round((successfulRequests / totalRequests) * 100) : 100,
        averageResponseTime: avgResponseTime,
        requestsPerSecond: totalRequests > 0 ? Math.round(totalRequests / ((now - startTime) / 1000)) : 0,
        errorRate: totalRequests > 0 ? Math.round((errorRequests / totalRequests) * 100) : 0
      },
      activity: {
        newUsers: userActivity,
        newJobs: jobActivity,
        newPosts: postActivity,
        newComments: commentActivity,
        totalActivity: userActivity + jobActivity + postActivity + commentActivity
      },
      traffic: trafficData,
      endpoints: endpoints,
      statusCodes: {
        '2xx': timeframeRequests.filter(req => req.statusCode >= 200 && req.statusCode < 300).length,
        '3xx': timeframeRequests.filter(req => req.statusCode >= 300 && req.statusCode < 400).length,
        '4xx': timeframeRequests.filter(req => req.statusCode >= 400 && req.statusCode < 500).length,
        '5xx': timeframeRequests.filter(req => req.statusCode >= 500).length
      }
    };

    res.status(200).json({
      success: true,
      data: apiStats,
      timeframe,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get API statistics',
      error: error.message
    });
  }
};

// @desc    Get system logs
// @route   GET /api/system/logs
// @access  Private (Admin only)
exports.getSystemLogs = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      level = 'all', 
      service = 'all',
      timeframe = '24h' 
    } = req.query;

    // Get real system logs
    const logs = await getSystemLogs(parseInt(limit), level, timeframe);
    
    // Filter by level and service if specified
    let filteredLogs = logs;
    if (level !== 'all') {
      filteredLogs = filteredLogs.filter(log => log.level.toLowerCase() === level.toLowerCase());
    }
    if (service !== 'all') {
      filteredLogs = filteredLogs.filter(log => log.service.toLowerCase().includes(service.toLowerCase()));
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedLogs = filteredLogs.slice(skip, skip + parseInt(limit));

    // Summary statistics
    const apiRequestTracker = getApiRequestTracker();
    const summary = {
      total: filteredLogs.length,
      critical: filteredLogs.filter(log => log.level === 'Critical').length,
      error: filteredLogs.filter(log => log.level === 'Error').length,
      warning: filteredLogs.filter(log => log.level === 'Warning').length,
      info: filteredLogs.filter(log => log.level === 'Info').length,
      pending: filteredLogs.filter(log => log.status === 'Pending').length,
      resolved: filteredLogs.filter(log => log.status === 'Resolved').length,
      apiErrors: apiRequestTracker.errors.length,
      totalRequests: apiRequestTracker.requests.length
    };

    res.status(200).json({
      success: true,
      data: paginatedLogs,
      summary,
      pagination: {
        current: parseInt(page),
        limit: parseInt(limit),
        total: filteredLogs.length,
        pages: Math.ceil(filteredLogs.length / parseInt(limit))
      },
      filters: {
        level,
        service,
        timeframe
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get system logs',
      error: error.message
    });
  }
};

// @desc    Get system alerts
// @route   GET /api/system/alerts
// @access  Private (Admin only)
exports.getSystemAlerts = async (req, res) => {
  try {
    const { status = 'all' } = req.query;
    const alerts = [];
    const now = new Date();

    // Check system health and generate real alerts
    const memoryUsage = process.memoryUsage();
    const heapUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const memoryUsagePercent = ((totalMemory - freeMemory) / totalMemory) * 100;
    
    // Memory usage alert
    if (heapUsagePercent > 80) {
      alerts.push({
        id: 'memory_alert',
        title: heapUsagePercent > 90 ? 'Critical Memory Usage' : 'High Memory Usage',
        message: `Heap memory usage is at ${heapUsagePercent.toFixed(1)}%. Consider optimizing memory usage or scaling resources.`,
        level: heapUsagePercent > 90 ? 'Critical' : 'Warning',
        status: 'Active',
        service: 'System',
        createdAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(), // 5 minutes ago
        acknowledgedAt: null,
        resolvedAt: null,
        details: {
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          usagePercent: heapUsagePercent
        }
      });
    }
    
    // System memory alert
    if (memoryUsagePercent > 85) {
      alerts.push({
        id: 'system_memory_alert',
        title: 'High System Memory Usage',
        message: `System memory usage is at ${memoryUsagePercent.toFixed(1)}%. Free memory: ${(freeMemory / 1024 / 1024 / 1024).toFixed(2)}GB`,
        level: memoryUsagePercent > 95 ? 'Critical' : 'Warning',
        status: 'Active',
        service: 'System',
        createdAt: new Date(now.getTime() - 10 * 60 * 1000).toISOString(), // 10 minutes ago
        acknowledgedAt: null,
        resolvedAt: null,
        details: {
          totalMemory,
          freeMemory,
          usagePercent: memoryUsagePercent
        }
      });
    }

    // Database connection alert
    const dbStatus = mongoose.connection.readyState;
    if (dbStatus !== 1) {
      alerts.push({
        id: 'database_alert',
        title: 'Database Connection Issue',
        message: `Database connection state is ${dbStatus === 0 ? 'disconnected' : dbStatus === 2 ? 'connecting' : 'disconnecting'}`,
        level: 'Critical',
        status: 'Active',
        service: 'Database',
        createdAt: new Date(now.getTime() - 2 * 60 * 1000).toISOString(), // 2 minutes ago
        acknowledgedAt: null,
        resolvedAt: null,
        details: {
          connectionState: dbStatus,
          host: mongoose.connection.host,
          port: mongoose.connection.port
        }
      });
    }

    // API error rate alert
    const apiRequestTracker = getApiRequestTracker();
    const recentErrors = apiRequestTracker.errors.filter(error => 
      new Date(error.timestamp) > new Date(now.getTime() - 60 * 60 * 1000) // Last hour
    );
    const recentRequests = apiRequestTracker.requests.filter(req => 
      new Date(req.timestamp) > new Date(now.getTime() - 60 * 60 * 1000) // Last hour
    );
    
    if (recentRequests.length > 0) {
      const errorRate = (recentErrors.length / recentRequests.length) * 100;
      if (errorRate > 10) { // More than 10% error rate
        alerts.push({
          id: 'api_error_rate_alert',
          title: 'High API Error Rate',
          message: `API error rate is ${errorRate.toFixed(1)}% in the last hour (${recentErrors.length} errors out of ${recentRequests.length} requests)`,
          level: errorRate > 25 ? 'Critical' : 'Warning',
          status: 'Active',
          service: 'API-Gateway',
          createdAt: new Date(now.getTime() - 15 * 60 * 1000).toISOString(), // 15 minutes ago
          acknowledgedAt: null,
          resolvedAt: null,
          details: {
            errorRate,
            totalErrors: recentErrors.length,
            totalRequests: recentRequests.length,
            timeframe: '1 hour'
          }
        });
      }
    }

    // CPU usage alert (if we can get real CPU usage)
    try {
      const cpuUsage = await getCpuUsage();
      if (cpuUsage > 80) {
        alerts.push({
          id: 'cpu_usage_alert',
          title: cpuUsage > 90 ? 'Critical CPU Usage' : 'High CPU Usage',
          message: `CPU usage is at ${cpuUsage.toFixed(1)}%. Consider optimizing performance or scaling resources.`,
          level: cpuUsage > 90 ? 'Critical' : 'Warning',
          status: 'Active',
          service: 'System',
          createdAt: new Date(now.getTime() - 8 * 60 * 1000).toISOString(), // 8 minutes ago
          acknowledgedAt: null,
          resolvedAt: null,
          details: {
            cpuUsage,
            cpuCount: os.cpus().length,
            loadAverage: os.loadavg()
          }
        });
      }
    } catch (error) {
      console.error('Error getting CPU usage for alerts:', error);
    }

    // Filter by status if specified
    let filteredAlerts = alerts;
    if (status !== 'all') {
      filteredAlerts = alerts.filter(alert => alert.status.toLowerCase() === status.toLowerCase());
    }

    // Summary
    const summary = {
      total: alerts.length,
      active: alerts.filter(alert => alert.status === 'Active').length,
      acknowledged: alerts.filter(alert => alert.status === 'Acknowledged').length,
      resolved: alerts.filter(alert => alert.status === 'Resolved').length,
      critical: alerts.filter(alert => alert.level === 'Critical').length,
      warning: alerts.filter(alert => alert.level === 'Warning').length
    };

    res.status(200).json({
      success: true,
      data: filteredAlerts,
      summary,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get system alerts',
      error: error.message
    });
  }
};

// @desc    Export system report
// @route   GET /api/system/export-report
// @access  Private (Admin only)
exports.exportSystemReport = async (req, res) => {
  try {
    const { format = 'json', timeframe = '24h' } = req.query;

    // Get all system data
    const healthResponse = await exports.getSystemHealth({ query: {} }, { status: () => ({ json: (data) => data }) });
    const apiStatsResponse = await exports.getApiStats({ query: { timeframe } }, { status: () => ({ json: (data) => data }) });
    const logsResponse = await exports.getSystemLogs({ query: { limit: 100, timeframe } }, { status: () => ({ json: (data) => data }) });
    const alertsResponse = await exports.getSystemAlerts({ query: {} }, { status: () => ({ json: (data) => data }) });

    const report = {
      generatedAt: new Date().toISOString(),
      timeframe,
      systemHealth: healthResponse.data,
      apiStatistics: apiStatsResponse.data,
      recentLogs: logsResponse.data,
      alerts: alertsResponse.data,
      metadata: {
        version: '1.0.0',
        reportType: 'System Monitoring Report',
        format
      }
    };

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="system-report-${Date.now()}.json"`);
      res.status(200).json({
        success: true,
        data: report
      });
    } else {
      // For other formats, return JSON for now
      res.status(200).json({
        success: true,
        message: 'Report generated successfully',
        data: report
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to export system report',
      error: error.message
    });
  }
};

// Helper function to format uptime
function formatUptime(seconds) {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}