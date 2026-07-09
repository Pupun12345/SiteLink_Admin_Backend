const planDetails = require('../models/PlanDetails');
const PlatformSettings = require('../models/PlatformSettings');
const Notification = require('../models/Notification');
const Skill = require('../models/Skill');

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
        console.warn('Failed to create admin notification:', error.message);
    }
};

exports.getPlans = async (req, res) => {
    try {
        let plans = await planDetails.find().sort({ createdAt: 1 });
        if(!plans){
            return res.status(404).json({
                success:false,
                message:"Plans not Found"
            })
        }
        return res.status(200).json({ success: true, data: plans });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

exports.createPlan = async (req, res) => {
    try {
        const { planName, userType, planType, frequency, amount, features } = req.body;
        if (!planName || !userType || !planType || !frequency || amount === undefined) {
            return res.status(400).json({ success: false, message: 'planName, userType, planType, frequency and amount are required' });
        }
        const plan = await planDetails.create({
            planName: planName.trim(),
            userType,
            planType,
            frequency,
            amount: parseFloat(amount),
            features: Array.isArray(features) ? features.filter(f => f.trim()) : [],
            isActive: true,
        });
        return res.status(201).json({ success: true, message: 'Plan created successfully', data: plan });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

exports.editPlanAmount = async (req, res) => {
    try {
        const { id } = req.params;
        const { planName, userType, planType, frequency, amount, features } = req.body;

        const plan = await planDetails.findById(id);
        if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });

        if (planName !== undefined) plan.planName = planName.trim();
        if (userType !== undefined) plan.userType = userType;
        if (planType !== undefined) plan.planType = planType;
        if (frequency !== undefined) plan.frequency = frequency;
        if (amount !== undefined) plan.amount = parseFloat(amount);
        if (features !== undefined) plan.features = Array.isArray(features) ? features.filter(f => f.trim()) : [];

        await plan.save();
        return res.status(200).json({ success: true, message: 'Plan updated successfully', data: plan });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

exports.deletePlan = async (req, res) => {
    try {
        const { id } = req.params;
        const plan = await planDetails.findByIdAndDelete(id);
        if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
        return res.status(200).json({ success: true, message: 'Plan deleted successfully' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal server error' });
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
        const skills = await Skill.find().sort({ id: 1 });

        return res.status(200).json({
            success: true,
            settings: {
                notifications: settings.notifications,
                verificationRules: settings.verificationRules,
                language: settings.language,
                skills: skills,
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

exports.addSkill = async (req, res) => {
    try {
        const { skill } = req.body;

        if (!skill || !skill.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Skill name is required'
            });
        }

        const existingSkill = await Skill.findOne({ name: skill.trim() });
        if (existingSkill) {
            return res.status(400).json({
                success: false,
                message: 'Skill already exists'
            });
        }

        const lastSkill = await Skill.findOne().sort({ id: -1 });
        const newId = lastSkill ? lastSkill.id + 1 : 1;

        const newSkill = await Skill.create({
            id: newId,
            name: skill.trim(),
            createdBy: req.user.id
        });

        const allSkills = await Skill.find().sort({ id: 1 });

        return res.status(200).json({
            success: true,
            message: 'Skill added successfully',
            skills: allSkills
        });
    } catch (error) {
        console.error('Add skill error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};
