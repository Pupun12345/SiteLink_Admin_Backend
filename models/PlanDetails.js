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
    isActive: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: true
});

module.exports = mongoose.model('PlanDetails', planDetailsSchema);