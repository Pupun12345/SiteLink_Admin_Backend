const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    company: {
      type: String,
      required: true,
    },
    location: {
      type: String,
      required: true,
    },
    latitude: {
      type: String,
      default: null,
    },
    longitude: {
      type: String,
      default: null,
    },
    quantity: {
      type: String,
      default: '1',
    },
    salary: {
      type: Number,
    },
    salaryType: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'daily',
    },
    isUrgent: {
      type: Boolean,
      default: false,
    },
    duration: {
      type: String,
    },
    description: {
      type: String,
      required: true,
    },
    experience: {
      type: String,
      required: true,
    },
    applicationsCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['Open', 'Filled', 'Closed', 'Cancelled'],
      default: 'Open',
    },
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    likes: {
      type: [
        {
          userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
          },
          likedAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
      default: [],
    },
    likesCount: {
      type: Number,
      default: 0,
    },
    comments: {
      type: [
        {
          userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
          },
          userName: String,
          userImage: String,
          comment: String,
          createdAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
      default: [],
    },
    commentsCount: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    rejectionReason: {
      type: String,
      default: null,
    },
    amenities: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Amenities"
      }
    ],
  },
  { timestamps: true }
);

jobSchema.index({ postedBy: 1, createdAt: -1 });
jobSchema.index({ isActive: 1, createdAt: -1 });

// Generate job ID
jobSchema.virtual('jobId').get(function () {
  return `REQ-${this._id.toString().slice(-4).toUpperCase()}`;
});

// Add contentType virtual for unified feed
jobSchema.virtual('contentType').get(function () {
  return 'job';
});

jobSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Job', jobSchema);