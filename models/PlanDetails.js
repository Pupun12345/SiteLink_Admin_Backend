const mongoose = require('mongoose');

const planDetailsSchema = new mongoose.Schema({
    planName: {
        type: String,
        enum: ['basic', 'premium', 'enterprise'],
        required: true,
    },
    amount: {
        type: Number,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('PlanDetails', planDetailsSchema);