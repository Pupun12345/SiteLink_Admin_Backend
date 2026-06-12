const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
    },
    likes: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      likedAt: {
        type: Date,
        default: Date.now,
      }
    }],
    likesCount: {
      type: Number,
      default: 0,
    },
    repliesCount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['active', 'deleted', 'hidden'],
      default: 'active',
    },
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

commentSchema.index({ postId: 1, createdAt: -1 });
commentSchema.index({ userId: 1 });
commentSchema.index({ parentComment: 1 });

commentSchema.virtual('replies', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'parentComment',
  options: { sort: { createdAt: 1 } }
});

commentSchema.pre('save', async function(next) {
  if (this.isNew && this.parentComment) {
    await mongoose.model('Comment').findByIdAndUpdate(
      this.parentComment,
      { $inc: { repliesCount: 1 } }
    );
  }
  next();
});

commentSchema.pre('remove', async function(next) {
  if (this.parentComment) {
    await mongoose.model('Comment').findByIdAndUpdate(
      this.parentComment,
      { $inc: { repliesCount: -1 } }
    );
  }
  next();
});

module.exports = mongoose.model('Comment', commentSchema);