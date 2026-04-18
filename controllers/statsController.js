const User = require('../models/User');
const Job = require('../models/job');
const Notification = require('../models/Notification');
const PlanDetails = require('../models/PlanDetails');

exports.totalWorkers = async (req, res) => {
    try {
        let workersCount = await User.countDocuments({ userType: 'worker' });
        res.json({
            success: true,
            data: {
                totalWorkers: workersCount
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error while fetching total workers',
            error: error.message
        });
    }
};

exports.totalVendors = async (req, res) => {
    try {
        let vendorsCount = await User.countDocuments({ userType: 'vendor' });
        res.json({
            success: true,
            data: {
                totalVendors: vendorsCount
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error while fetching total vendors',
            error: error.message
        });
    }
};

// Get comprehensive dashboard statistics
exports.overview = async (req, res) => {
    try {
        // User statistics
        const totalWorkers = await User.countDocuments({ userType: 'worker' });
        const verifiedWorkers = await User.countDocuments({ userType: 'worker', verificationStatus: 'verified' });
        const pendingWorkers = await User.countDocuments({ userType: 'worker', verificationStatus: 'pending' });
        const rejectedWorkers = await User.countDocuments({ userType: 'worker', verificationStatus: 'rejected' });

        const totalVendors = await User.countDocuments({ userType: 'vendor' });
        const verifiedVendors = await User.countDocuments({ userType: 'vendor', verificationStatus: 'verified' });
        const pendingVendors = await User.countDocuments({ userType: 'vendor', verificationStatus: 'pending' });
        const rejectedVendors = await User.countDocuments({ userType: 'vendor', verificationStatus: 'rejected' });

        const totalCustomers = await User.countDocuments({ userType: 'customer' });
        const totalUsers = await User.countDocuments();

        // Job statistics
        const totalJobs = await Job.countDocuments();
        const activeJobs = await Job.countDocuments({ status: 'Open' });
        const filledJobs = await Job.countDocuments({ status: 'Filled' });
        const closedJobs = await Job.countDocuments({ status: 'Closed' });
        const cancelledJobs = await Job.countDocuments({ status: 'Cancelled' });

        // Recent activity (last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const recentWorkers = await User.countDocuments({ 
            userType: 'worker', 
            createdAt: { $gte: thirtyDaysAgo } 
        });
        const recentVendors = await User.countDocuments({ 
            userType: 'vendor', 
            createdAt: { $gte: thirtyDaysAgo } 
        });
        const recentJobs = await Job.countDocuments({ 
            createdAt: { $gte: thirtyDaysAgo } 
        });

        // Notification statistics
        const totalNotifications = await Notification.countDocuments();
        const unreadNotifications = await Notification.countDocuments({ status: 'Unread' });
        const criticalNotifications = await Notification.countDocuments({ priority: 'critical' });

        // Calculate growth percentages
        const workerGrowth = totalWorkers > 0 ? ((recentWorkers / totalWorkers) * 100).toFixed(1) : 0;
        const vendorGrowth = totalVendors > 0 ? ((recentVendors / totalVendors) * 100).toFixed(1) : 0;
        const jobGrowth = totalJobs > 0 ? ((recentJobs / totalJobs) * 100).toFixed(1) : 0;

        // Revenue calculation (placeholder - would come from payment system)
        const totalRevenue = totalJobs * 150 + totalVendors * 50; // Estimated revenue
        const monthlyRevenue = recentJobs * 150 + recentVendors * 50;
        const revenueGrowth = totalRevenue > 0 ? ((monthlyRevenue / totalRevenue) * 100).toFixed(1) : 0;

        // System health metrics
        const systemHealth = {
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            activeConnections: totalUsers,
            responseTime: Date.now() % 100 + 50 // Simulated response time
        };

        res.json({
            success: true,
            data: {
                // User metrics
                totalWorkers,
                verifiedWorkers,
                pendingWorkers,
                rejectedWorkers,
                totalVendors,
                verifiedVendors,
                pendingVendors,
                rejectedVendors,
                totalCustomers,
                totalUsers,
                
                // Job metrics
                totalJobs,
                activeJobs,
                filledJobs,
                closedJobs,
                cancelledJobs,
                
                // Growth metrics
                recentWorkers,
                recentVendors,
                recentJobs,
                workerGrowth,
                vendorGrowth,
                jobGrowth,
                
                // Revenue metrics
                totalRevenue,
                monthlyRevenue,
                revenueGrowth,
                
                // Notification metrics
                totalNotifications,
                unreadNotifications,
                criticalNotifications,
                
                // System metrics
                systemHealth,
                
                // Legacy fields for backward compatibility
                activeSites: activeJobs,
                budgetUtilization: Math.min(95, (filledJobs / Math.max(totalJobs, 1)) * 100),
                
                // Timestamp
                lastUpdated: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Dashboard overview error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching dashboard overview',
            error: error.message
        });
    }
};

// Get time-series data for charts
exports.getChartData = async (req, res) => {
    try {
        const { period = '1M' } = req.query;
        
        let days = 30;
        if (period === '1D') days = 1;
        else if (period === '5D') days = 5;
        else if (period === '1M') days = 30;
        else if (period === '1Y') days = 365;
        
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        
        // Worker Growth Data
        const workerGrowthData = await User.aggregate([
            {
                $match: {
                    userType: 'worker',
                    createdAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { '_id': 1 }
            }
        ]);

        // Vendor Registrations Data
        const vendorRegistrationsData = await User.aggregate([
            {
                $match: {
                    userType: 'vendor',
                    createdAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { '_id': 1 }
            }
        ]);

        // Monthly Revenue Data (based on jobs and subscriptions)
        const revenueData = await Job.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { '_id': 1 }
            },
            {
                $project: {
                    _id: 1,
                    revenue: { $multiply: ['$count', 150] }
                }
            }
        ]);

        // User Distribution
        const totalWorkers = await User.countDocuments({ userType: 'worker' });
        const totalVendors = await User.countDocuments({ userType: 'vendor' });
        const totalCustomers = await User.countDocuments({ userType: 'customer' });
        const totalUsers = totalWorkers + totalVendors + totalCustomers;

        // Format data for charts
        const workerGrowth = workerGrowthData.map(item => ({
            label: item._id,
            value: item.count
        }));

        const vendorRegistrations = vendorRegistrationsData.map(item => ({
            label: item._id,
            value: item.count
        }));

        const monthlyRevenue = revenueData.map(item => ({
            label: item._id,
            value: item.revenue
        }));

        const userDistribution = {
            total: totalUsers.toLocaleString(),
            workers: totalWorkers,
            vendors: totalVendors,
            customers: totalCustomers,
            workersPercentage: totalUsers > 0 ? ((totalWorkers / totalUsers) * 100).toFixed(1) : 0,
            vendorsPercentage: totalUsers > 0 ? ((totalVendors / totalUsers) * 100).toFixed(1) : 0,
            customersPercentage: totalUsers > 0 ? ((totalCustomers / totalUsers) * 100).toFixed(1) : 0
        };
        
        res.json({
            success: true,
            data: {
                workerGrowth,
                vendorRegistrations,
                monthlyRevenue,
                userDistribution,
                period,
                generatedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Chart data error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching chart data',
            error: error.message
        });
    }
};

// Get recent activity feed
exports.getRecentActivity = async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        
        // Get recent users
        const recentUsers = await User.find()
            .select('name userType createdAt verificationStatus')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit) / 2);
            
        // Get recent jobs
        const recentJobs = await Job.find()
            .select('title company status createdAt')
            .populate('postedBy', 'name')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit) / 2);
            
        // Combine and format activities
        const activities = [];
        
        recentUsers.forEach(user => {
            activities.push({
                id: user._id,
                type: 'user_registration',
                title: `New ${user.userType} registered`,
                description: `${user.name} joined as ${user.userType}`,
                timestamp: user.createdAt,
                status: user.verificationStatus,
                icon: user.userType === 'worker' ? 'user' : user.userType === 'vendor' ? 'store' : 'user-plus'
            });
        });
        
        recentJobs.forEach(job => {
            activities.push({
                id: job._id,
                type: 'job_posting',
                title: 'New job posted',
                description: `${job.title} at ${job.company}`,
                timestamp: job.createdAt,
                status: job.status.toLowerCase(),
                icon: 'briefcase'
            });
        });
        
        // Sort by timestamp
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        res.json({
            success: true,
            data: activities.slice(0, parseInt(limit))
        });
    } catch (error) {
        console.error('Recent activity error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching recent activity',
            error: error.message
        });
    }
};