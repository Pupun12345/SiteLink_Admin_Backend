const planDetails = require('../models/PlanDetails');
const PlatformSettings = require('../models/PlatformSettings');
const Notification = require('../models/Notification');

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
        return res.status(500).json({
            success: false,
            message: 'Failed to create notification',
            error: error.message
        });
    }
};

exports.editPlanAmount = async (req, res) => {
    try {
        const { planName, amount } = req.body;
        console.log('Received plan update request:', { planName, amount });
        
        if (!planName || amount === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Plan name and amount are required'
            });
        }

        const planNameMapping = {
            'basic': 'basic',
            'pro': 'premium',
            'premium': 'premium', 
            'enterprise': 'enterprise'
        };
        
        const normalizedPlanName = planName.toLowerCase();
        const backendPlanName = planNameMapping[normalizedPlanName];
        
        if (!backendPlanName) {
            return res.status(400).json({
                success: false,
                message: 'Invalid plan name. Must be Basic, Pro, or Enterprise'
            });
        }

        let plan = await planDetails.findOne({ planName: backendPlanName });
        if (!plan) {
            plan = await planDetails.create({
                planName: backendPlanName,
                amount: parseFloat(amount)
            });
            console.log('Created new plan:', plan);
        } else {
            plan.amount = parseFloat(amount);
            await plan.save();
            console.log('Updated existing plan:', plan);
        }

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
};

exports.notificationSettings = async (req, res) => {
    try {
        const notifications = req.body;

        const settings = await PlatformSettings.getOrCreateSettings();
        
        settings.notifications = {
            ...settings.notifications,
            ...notifications
        };
        settings.updatedBy = req.user.id;
        settings.updatedAt = new Date();
        await settings.save();

        try {
            await createAdminNotification(
                'Notification Settings Updated',
                `Platform notification settings have been updated by ${req.user.name}`,
                req.user.id
            );
        } catch (notificationError) {
            console.warn('Failed to create notification:', notificationError.message);
        }

        return res.status(200).json({ 
            success: true,
            message: 'Notification settings updated successfully',
            settings: settings.notifications
        });

    } catch (error) {
        console.error('Notification settings error:', error);
        return res.status(500).json({ 
            success: false,
            message: 'Internal server error',
            error: error.message 
        });
    }
};

exports.languageSettings = async (req, res) => {
    try {
        const { language } = req.body;

        if (!language) {
            return res.status(400).json({
                success: false,
                message: 'Language is required'
            });
        }

        const settings = await PlatformSettings.getOrCreateSettings();
        
        settings.language = language;
        settings.updatedBy = req.user.id;
        settings.updatedAt = new Date();
        await settings.save();

        try {
            await createAdminNotification(
                'Language Settings Updated',
                `Platform language has been updated to ${language} by ${req.user.name}`,
                req.user.id
            );
        } catch (notificationError) {
            console.warn('Failed to create notification:', notificationError.message);
        }

        return res.status(200).json({ 
            success: true,
            message: 'Language settings updated successfully',
            language: settings.language
        });

    } catch (error) {
        console.error('Language settings error:', error);
        return res.status(500).json({ 
            success: false,
            message: 'Internal server error',
            error: error.message 
        });
    }
};

exports.verificationRulesSettings = async (req, res) => {
    try {
        const { userProfile, rules } = req.body;

        console.log('Received verification rules request:', { userProfile, rules });

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

        const settings = await PlatformSettings.getOrCreateSettings();
        console.log('Current settings before update:', settings.verificationRules);

        if (userProfile === 'worker') {
            settings.verificationRules.worker = {
                ...settings.verificationRules.worker,
                ...rules
            };
        } else if (userProfile === 'vendor') {
            settings.verificationRules.vendor = {
                ...settings.verificationRules.vendor,
                ...rules
            };
        }

        settings.updatedBy = req.user.id;
        settings.updatedAt = new Date();
        await settings.save();

        console.log('Settings after update:', settings.verificationRules);

        try {
            const rulesList = Object.keys(rules).join(', ');
            await createAdminNotification(
                'Verification Rules Updated',
                `${userProfile.charAt(0).toUpperCase() + userProfile.slice(1)} verification rules updated by ${req.user.name}. Changes: ${rulesList}`,
                req.user.id
            );
        } catch (notificationError) {
            console.warn('Failed to create notification:', notificationError.message);
        }

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
};

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
