const mongoose = require('mongoose');

const planDetailsSchema = new mongoose.Schema({
    planName: {
        type: String,
        required: true,
        trim: true,
    },
    userType: {
        type: String,
        enum: ['vendor', 'worker'],
        required: true,
    },
    planType: {
        type: String,
        enum: ['basic', 'premium'],
        required: true,
        default: 'basic',
    },
    frequency: {
        type: String,
        enum: ['monthly', 'yearly'],
        default: 'monthly',
    },
    amount: {
        type: Number,
        required: true,
        min: 0,
    },
    features: {
        type: [String],
        default: [],
    },
    // Total workers a vendor on this plan can post across ALL their jobs.
    // 0 = no cap configured. Must stay in sync with the app backend's
    // PlanDetails schema (SiteLink_Backend/models/PlanDetails.js).
    maxWorkers: {
        type: Number,
        default: 0,
        min: 0,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: true
});

module.exports = mongoose.model('PlanDetails', planDetailsSchema);