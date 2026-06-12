const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true,
  },
  applicant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'shortlisted', 'rejected', 'hired'],
    default: 'pending',
  },
  coverLetter: {
    type: String,
    maxlength: 1000,
  },
  experience: {
    type: String,
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  reviewedAt: {
    type: Date,
  },
  notes: {
    type: String,
    maxlength: 500,
  },
}, {
  timestamps: true,
});

applicationSchema.index({ job: 1, applicant: 1 }, { unique: true });
applicationSchema.index({ job: 1, status: 1 });
applicationSchema.index({ applicant: 1, status: 1 });
applicationSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Application', applicationSchema);