const mongoose = require('mongoose');

const legalPolicySchema = new mongoose.Schema(
  {
    policyType: {
      type: String,
      enum: ['PRIVACY_POLICY', 'TERMS_AND_CONDITIONS','HELP_AND_SUPPORT'],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
    version: {
      type: Number,
      required: true,
      default: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    effectiveDate: {
      type: Date,
      default: Date.now,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    changelog: {
      type: String,
      trim: true,
      description: 'Description of changes made in this version',
    },
    summary: {
      type: String,
      trim: true,
      description: 'Brief summary of the policy',
    },
  },
  {
    timestamps: true,
  }
);

// Index for finding active policies
legalPolicySchema.index({ policyType: 1, isActive: 1 });

// Virtual for getting URL-friendly identifier
legalPolicySchema.virtual('urlSlug').get(function () {
  return this.policyType.toLowerCase().replace(/_/g, '-');
});

module.exports = mongoose.model('LegalPolicies', legalPolicySchema);
