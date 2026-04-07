const planDetails = require('../models/PlanDetails');
const PlatformSettings = require('../models/PlatformSettings');
const Notification = require('../models/Notification');
const { createWorkerProfile, createVendorProfile } = require('./profileController');

const createAdminNotification = async (title, message, createdBy) => {
    try {
        await Notification.create({
            title,
            message,
            type: 'System',
            category: 'info',
            priority: 'medium',
            recipientType: 'admin',
            createdBy,
            isSystemGenerated: false
        });
    } catch (error) {
        console.error('Failed to create admin notification:', error);
    }
};

exports.editPlanAmount = async (req, res) => {
    try {
        const { planName, amount } = req.body;
        if (!planName || !amount) {
            return res.status(400).json({
                success: false,
                message: 'Plan name and amount are required'
            });
        }

        const plan = await planDetails.findOne({ planName });
        if (!plan) {
            return res.status(404).json({
                success: false,
                message: 'Plan not found'
            });
        }

        plan.amount = amount;
        await plan.save();

        return res.status(200).json({
            success: true,
            message: 'Plan amount updated successfully',
            plan
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
}

//Useful when we attach email or phone number to notification settings
// exports.notificationSettings = async (req, res) => {
//     try {
//         const { systemAlerts, subscriptionNotifications, userNotifications } = req.body;

//         const settings = await PlatformSettings.getOrCreateSettings();

//         const notificationUpdates = {};
//         if (systemAlerts !== undefined) notificationUpdates.systemAlerts = systemAlerts;
//         if (subscriptionNotifications !== undefined) notificationUpdates.subscriptionNotifications = subscriptionNotifications;
//         if (userNotifications !== undefined) notificationUpdates.userNotifications = userNotifications;

//         // Create admin notification
//         await createAdminNotification(
//             'Notification Settings Updated',
//             `Platform notification settings have been updated by ${req.user.name}`,
//             req.user.id
//         );

//         return res.status(200).json({ 
//             success: true,
//             message: 'Notification settings updated successfully',
//             settings: settings.notifications
//         });

//     } catch (error) {
//         console.error('Notification settings error:', error);
//         return res.status(500).json({ 
//             success: false,
//             message: 'Internal server error',
//             error: error.message 
//         });
//     }
// }

exports.verificationRulesSettings = async (req, res) => {
    try {
        const { userProfile, rules } = req.body;

        if (!userProfile || !rules) {
            return res.status(400).json({
                success: false,
                message: 'User profile and rules are required'
            });
        }

        if (userProfile !== 'worker' && userProfile !== 'vendor') {
            return res.status(400).json({
                success: false,
                message: 'Invalid user profile. Must be worker or vendor'
            });
        }

        //FOR WORKERS RULES UPDATE
        const workerRulesList = ['idProof', 'age', 'medicalCertificate'];

        const requiredRulesWorker = {};
        if (userProfile === 'worker') {
            for (const rule of workerRulesList) {
                if (rules[rule]) {
                    requiredRulesWorker[rule] = rules[rule];
                }
            }
        }
        //FOR VENDORS RULES UPDATE
        const vendorRulesList = ['gstNumber', 'licenseNumber', 'ownerName'];

        const requiredRulesVendor = {};
        if (userProfile === 'vendor') {
            for (const rule of vendorRulesList) {
                if (rules[rule]) {
                    requiredRulesVendor[rule] = rules[rule];
                }
            }
        }

        const settings = await PlatformSettings.getOrCreateSettings();


        if (userProfile === 'worker') {
            await settings.updateVerificationRules(userProfile, requiredRulesWorker, req.user.id);
        }else{
            await settings.updateVerificationRules(userProfile, requiredRulesVendor, req.user.id);
        }

        await createAdminNotification(
            'Verification Rules Updated',
            `${userProfile.charAt(0).toUpperCase() + userProfile.slice(1)} verification rules updated by ${req.user.name}. Changes: ${rulesList}`,
            req.user.id
        );

        return res.status(200).json({
            success: true,
            message: 'Verification rules updated successfully',
            rules: settings.verificationRules[userProfile]
        });

    } catch (error) {
        console.error('Verification rules settings error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
}

exports.getSettings = async (req, res) => {
    try {
        const settings = await PlatformSettings.getOrCreateSettings();

        return res.status(200).json({
            success: true,
            settings: {
                notifications: settings.notifications,
                verificationRules: settings.verificationRules,
                language: settings.language,
                updatedAt: settings.updatedAt,
                updatedBy: settings.updatedBy
            }
        });
    } catch (error) {
        console.error('Get settings error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
}
