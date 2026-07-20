const User = require('../models/User');
const Job = require('../models/job');
const Notification = require('../models/Notification');
const PlanDetails = require('../models/PlanDetails');
const Subscription = require('../models/Subscription')

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

        // Subscription statistics from the subscription collection
        const activeSubscriptionDocs = await Subscription.find({ status: 'active' }).populate('user', 'userType');
        const activeSubscriptions = activeSubscriptionDocs.length;
        const vendorSubscriptions = activeSubscriptionDocs.filter(sub => sub.user?.userType === 'vendor').length;
        const workerSubscriptions = activeSubscriptionDocs.filter(sub => sub.user?.userType === 'worker').length;

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

        // Revenue calculation from active subscriptions
        const subscriptionRevenue = activeSubscriptionDocs.reduce((sum, sub) => sum + (sub.amount || 0), 0);
        const jobRevenue = totalJobs * 150; // Estimated job posting revenue
        const totalRevenue = subscriptionRevenue + jobRevenue;
        const monthlyRevenue = Math.round(subscriptionRevenue / 12);
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
                totalPending: pendingWorkers + pendingVendors,

                // Subscription metrics
                activeSubscriptions,
                vendorSubscriptions,
                workerSubscriptions,

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
                subscriptionRevenue,
                jobRevenue,

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
        const now = new Date();
        const pad = (value) => String(value).padStart(2, '0');

        let startDate, endDate, seriesKeys, groupFormat;

        if (period === '1D') {
            // Yesterday only
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            startDate = new Date(yesterday); startDate.setHours(0, 0, 0, 0);
            endDate = new Date(yesterday); endDate.setHours(23, 59, 59, 999);
            groupFormat = '%Y-%m-%d';
            seriesKeys = [`${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`];
        } else if (period === '5D') {
            // 5 days ago up to yesterday
            endDate = new Date(now); endDate.setDate(endDate.getDate() - 1); endDate.setHours(23, 59, 59, 999);
            startDate = new Date(now); startDate.setDate(startDate.getDate() - 5); startDate.setHours(0, 0, 0, 0);
            groupFormat = '%Y-%m-%d';
            seriesKeys = [];
            const cur = new Date(startDate);
            while (cur <= endDate) {
                seriesKeys.push(`${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`);
                cur.setDate(cur.getDate() + 1);
            }
        } else if (period === '1M') {
            // Current month + previous month (2 rows by month)
            const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
            const currMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            startDate = prevMonthStart;
            endDate = currMonthEnd;
            groupFormat = '%Y-%m';
            seriesKeys = [
                `${prevMonthStart.getFullYear()}-${pad(prevMonthStart.getMonth() + 1)}-01`,
                `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
            ];
        } else {
            // 1Y: all months of current year Jan to current month
            startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
            groupFormat = '%Y-%m';
            seriesKeys = [];
            for (let m = 0; m <= now.getMonth(); m++) {
                seriesKeys.push(`${now.getFullYear()}-${pad(m + 1)}-01`);
            }
        }

        const isMonthly = period === '1M' || period === '1Y';
        const dateFilter = { $gte: startDate, $lte: endDate };

        const buildSeries = (data) => {
            const totals = data.reduce((acc, item) => {
                const key = isMonthly ? `${item._id}-01` : item._id;
                acc[key] = item.count;
                return acc;
            }, {});
            return seriesKeys.map((key) => ({ label: key, value: totals[key] || 0 }));
        };

        const workerGrowthData = await User.aggregate([
            { $match: { userType: 'worker', createdAt: dateFilter } },
            { $group: { _id: { $dateToString: { format: groupFormat, date: '$createdAt' } }, count: { $sum: 1 } } },
            { $sort: { '_id': 1 } }
        ]);

        const vendorRegistrationsData = await User.aggregate([
            { $match: { userType: 'vendor', createdAt: dateFilter } },
            { $group: { _id: { $dateToString: { format: groupFormat, date: '$createdAt' } }, count: { $sum: 1 } } },
            { $sort: { '_id': 1 } }
        ]);

        const workerGrowth = buildSeries(workerGrowthData);
        const vendorRegistrations = buildSeries(vendorRegistrationsData);

        const subscriptions = await Subscription.find({ status: 'active', startDate: dateFilter });
        const revenueTotals = {};
        subscriptions.forEach(sub => {
            if (sub.startDate) {
                const date = new Date(sub.startDate);
                const key = isMonthly
                    ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-01`
                    : `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
                revenueTotals[key] = (revenueTotals[key] || 0) + (sub.amount || 0);
            }
        });
        const monthlyRevenue = seriesKeys.map((key) => ({ label: key, value: revenueTotals[key] || 0 }));

        const totalWorkers = await User.countDocuments({ userType: 'worker' });
        const totalVendors = await User.countDocuments({ userType: 'vendor' });
        const totalCustomers = await User.countDocuments({ userType: 'customer' });
        const totalUsers = totalWorkers + totalVendors + totalCustomers;

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
            data: { workerGrowth, vendorRegistrations, monthlyRevenue, userDistribution, period, generatedAt: new Date().toISOString() }
        });
    } catch (error) {
        console.error('Chart data error:', error);
        res.status(500).json({ success: false, message: 'Server error while fetching chart data', error: error.message });
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



// Revenue and subscription statistics
exports.revenueStats = async (req, res) => {
    try {
        const subscriptions = await Subscription.find({ status: 'active' })
            .populate('user', 'name userType phone email profileImage companyLogo');

        // Calculate total revenue from actual subscription amounts
        const totalRevenue = subscriptions.reduce((sum, sub) => sum + (sub.amount || 0), 0);

        // Count subscriptions by user type
        const workerSubscriptions = subscriptions.filter(sub => sub.user?.userType === 'worker').length;
        const vendorSubscriptions = subscriptions.filter(sub => sub.user?.userType === 'vendor').length;
        const customerSubscriptions = subscriptions.filter(sub => sub.user?.userType === 'customer').length;

        // Calculate revenue by plan
        const revenueByPlan = subscriptions.reduce((acc, sub) => {
            const plan = sub.plan || 'unknown';
            acc[plan] = (acc[plan] || 0) + (sub.amount || 0);
            return acc;
        }, {});

        // Get monthly revenue breakdown
        const monthlyRevenue = {};
        subscriptions.forEach(sub => {
            if (sub.startDate) {
                const date = new Date(sub.startDate);
                const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                monthlyRevenue[monthYear] = (monthlyRevenue[monthYear] || 0) + (sub.amount || 0);
            }
        });

        // Convert monthly revenue to array format for charts
        const monthlyRevenueArray = Object.entries(monthlyRevenue)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, amount]) => ({
                label: month + '-01',
                value: amount
            }));

        res.json({
            success: true,
            data: {
                totalRevenue,
                totalSubscriptions: subscriptions.length,
                activeSubscriptions: subscriptions.length,
                workerSubscriptions,
                vendorSubscriptions,
                customerSubscriptions,
                revenueByPlan,
                monthlyRevenue: monthlyRevenueArray,
                subscriptions: subscriptions.map(sub => ({
                    _id: sub._id,
                    userId: sub.user?._id,
                    userName: sub.user?.name,
                    userType: sub.user?.userType,
                    profileImage: sub.user?.profileImage,
                    companyLogo: sub.user?.companyLogo,
                    phone: sub.user?.phone,
                    email: sub.user?.email,
                    plan: sub.plan,
                    planName: sub.plan,
                    status: sub.status,
                    amount: sub.amount,
                    startDate: sub.startDate,
                    endDate: sub.endDate
                }))
            }
        });
    } catch (error) {
        console.error('Revenue stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch revenue statistics'
        });
    }
};

// Get full year data by months for a specific year
exports.getYearData = async (req, res) => {
    try {
        const year = parseInt(req.query.year) || new Date().getFullYear();
        const pad = (v) => String(v).padStart(2, '0');

        const startDate = new Date(year, 0, 1, 0, 0, 0, 0);
        const endDate = new Date(year, 11, 31, 23, 59, 59, 999);
        const dateFilter = { $gte: startDate, $lte: endDate };
        const groupFormat = '%Y-%m';

        const seriesKeys = Array.from({ length: 12 }, (_, m) => `${year}-${pad(m + 1)}-01`);

        const buildSeries = (data) => {
            const totals = data.reduce((acc, item) => {
                acc[`${item._id}-01`] = item.count;
                return acc;
            }, {});
            return seriesKeys.map((key) => ({ label: key, value: totals[key] || 0 }));
        };

        const [workerData, vendorData, subscriptions] = await Promise.all([
            User.aggregate([
                { $match: { userType: 'worker', createdAt: dateFilter } },
                { $group: { _id: { $dateToString: { format: groupFormat, date: '$createdAt' } }, count: { $sum: 1 } } },
                { $sort: { _id: 1 } }
            ]),
            User.aggregate([
                { $match: { userType: 'vendor', createdAt: dateFilter } },
                { $group: { _id: { $dateToString: { format: groupFormat, date: '$createdAt' } }, count: { $sum: 1 } } },
                { $sort: { _id: 1 } }
            ]),
            Subscription.find({ status: 'active', startDate: dateFilter })
        ]);

        const revenueTotals = {};
        subscriptions.forEach(sub => {
            if (sub.startDate) {
                const d = new Date(sub.startDate);
                const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
                revenueTotals[key] = (revenueTotals[key] || 0) + (sub.amount || 0);
            }
        });

        res.json({
            success: true,
            data: {
                workerGrowth: buildSeries(workerData),
                vendorRegistrations: buildSeries(vendorData),
                monthlyRevenue: seriesKeys.map((key) => ({ label: key, value: revenueTotals[key] || 0 })),
                year,
                generatedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Year data error:', error);
        res.status(500).json({ success: false, message: 'Server error while fetching year data', error: error.message });
    }
};

exports.getSubscriptionStats = async (req, res) => {
    try {
        const subscriptions = await Subscription.find().populate('user', 'name userType companyName companyLogo profileImage').select('user plan status amount startDate endDate ');

        const totalSubscriptions = subscriptions.length;
        const totalPremiumVendorSubscriptions = subscriptions.filter(sub => sub.plan === 'vendor_premium').length;
        const totalBasicVendorSubscriptions = subscriptions.filter(sub => sub.plan === 'vendor_basic').length;
        const totalWorkerSubscriptions = subscriptions.filter(sub => sub.user?.userType === 'worker').length;
        const totalVendorSubscriptions = subscriptions.filter(sub => sub.user?.userType === 'vendor').length;
        const totalRevenue = subscriptions.reduce((sum, sub) => sum + (sub.amount || 0), 0);

        return res.status(200).json({
            success: true,
            data: {
                totalSubscriptions,
                totalPremiumVendorSubscriptions,
                totalBasicVendorSubscriptions,
                totalWorkerSubscriptions,
                totalVendorSubscriptions,
                totalRevenue,
                subscriptions
            }
        })

    } catch (error) {
        console.error('Subscription stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch subscription statistics'
        });
    }
}