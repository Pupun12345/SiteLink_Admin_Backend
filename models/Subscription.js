const mongoose = require('mongoose');

const normalizePlan = (plan) => {
  const normalized = String(plan || '').toLowerCase().trim();
  if (normalized === 'worker' || normalized === 'premium' || normalized === 'worker_premium') return 'worker_premium';
  if (normalized === 'vendorbasic' || normalized === 'basic' || normalized === 'vendor_basic') return 'vendor_basic';
  if (normalized === 'vendorpremium' || normalized === 'vendor_premium') return 'vendor_premium';
  return normalized;
};

const subscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  planType: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'expired', 'cancelled'],
    default: 'active',
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  endDate: {
    type: Date,
    required: true,
  },
  amount: {
    type: Number,
    required: true
  },
}, {
  timestamps: true,
});

// Index for faster queries
subscriptionSchema.index({ user: 1, status: 1 });
subscriptionSchema.index({ status: 1, endDate: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
