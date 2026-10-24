const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: [true, 'Please provide post content'],
      trim: true,
      maxlength: [1000, 'Post content cannot exceed 1000 characters'],
    },
    images: {
      type: [String],
      default: [],
      validate: {
        validator: function(v) {
          return v.length <= 5;
        },
        message: 'Maximum 5 images allowed per post',
      },
    },
    video: {
      type: String,
      default: null,
    },
    feeling: {
      type: String,
      default: null,
    },
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    posterName: {
      type: String,
      required: true,
    },
    posterImage: {
      type: String,
      default: null,
    },
    posterType: {
      type: String,
      enum: ['worker', 'vendor', 'admin'],
      required: true,
    },
    companyName: {
      type: String,
      default: null,
    },
    verification: {
      type: String,
      enum: ['verified', 'pending', 'unverified'],
      default: 'unverified',
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
    autoApproved: {
      type: Boolean,
      default: false,
    },
    isAdminPost: {
      type: Boolean,
      default: false,
    },
    isPermanent: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
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

postSchema.index({ postedBy: 1, createdAt: -1 });
postSchema.index({ posterType: 1, createdAt: -1 });
postSchema.index({ isActive: 1, createdAt: -1 });

// Add contentType virtual for unified feed
postSchema.virtual('contentType').get(function() {
  return 'post';
});

postSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Post', postSchema);
