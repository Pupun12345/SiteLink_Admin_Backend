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
    type: {
      type: String,
      enum: ['Full-time Contract', 'On-site', 'Offshore', 'Heavy Machinery', 'Contractual'],
      required: true,
    },
    quantity: {
      type: String,
      default: '1',
    },
    salary: {
      type: String,
    },
    description: {
      type: String,
      required: true,
    },
    skills: [{
      type: String,
    }],
    experience: {
      type: String,
      required: true,
    },
    equipment: [{
      type: String,
    }],
    projectSite: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    mapImage: {
      type: String,
      default: 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&q=80&w=800',
    },
    status: {
      type: String,
      enum: ['Open', 'Filled', 'Closed', 'Cancelled'],
      default: 'Open',
    },
    applicationsCount: {
      type: Number,
      default: 0,
    },
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

// Generate job ID
jobSchema.virtual('jobId').get(function() {
  return `REQ-${this._id.toString().slice(-4).toUpperCase()}`;
});

jobSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Job', jobSchema);