const mongoose = require('mongoose');

const planDetailsSchema = new mongoose.Schema({
    planName: {
        type: String,
<<<<<<< HEAD
        enum: ['basic', 'premium', 'enterprise'],
        required: true,
=======
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
>>>>>>> eb5f507 (New Routes has beeen added)
    },
    amount: {
        type: Number,
        required: true,
<<<<<<< HEAD
    },
    createdAt: {
        type: Date,
        default: Date.now,
    }
=======
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
>>>>>>> eb5f507 (New Routes has beeen added)
}, {
    timestamps: true
});

module.exports = mongoose.model('PlanDetails', planDetailsSchema);