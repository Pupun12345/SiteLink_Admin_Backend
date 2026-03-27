const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema(
  {
    workerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      default: null,
    },
    jobTitle: {
      type: String,
      required: true,
    },
    companyName: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: null,
    },
    location: {
      type: String,
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'cancelled', 'on-hold'],
      default: 'active',
    },
    workType: {
      type: String,
      enum: [
        'Full-time Contract',
        'On-site',
        'Offshore',
        'Heavy Machinery',
        'Contractual',
        'Daily',
      ],
      required: true,
    },
    dailyRate: {
      type: Number,
      default: null,
    },
    totalAmount: {
      type: Number,
      default: null,
    },
    daysWorked: {
      type: Number,
      default: 0,
    },
    skillsRequired: {
      type: [String],
      default: [],
    },
    equipmentRequired: {
      type: [String],
      default: [],
    },
    markedArrived: {
      type: {
        arrivedAt: Date,
        status: Boolean,
      },
      default: null,
    },
    performanceRating: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    performanceFeedback: {
      type: String,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient querying
assignmentSchema.index({ workerId: 1, status: 1, createdAt: -1 });
assignmentSchema.index({ vendorId: 1, createdAt: -1 });
assignmentSchema.index({ status: 1, startDate: 1 });

module.exports = mongoose.model('Assignment', assignmentSchema);
