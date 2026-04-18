const mongoose = require('mongoose');

const platformSettingsSchema = new mongoose.Schema({
  notifications: {
    systemAlerts: { type: Boolean, default: true },
    subscriptionNotifications: { type: Boolean, default: true },
    userNotifications: { type: Boolean, default: false }
  },
  verificationRules: {
    worker: {
      idProof: { type: Boolean, default: true },
      age: { type: Boolean, default: false },
      medicalCertificate: { type: Boolean, default: false }
    },
    vendor: {
      gstNumber: { type: Boolean, default: true },
      licenseNumber: { type: Boolean, default: true },
      ownerName: { type: Boolean, default: false }
    }
  },
  language: { type: String, default: 'English (United States)' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Static method to get or create default settings
platformSettingsSchema.statics.getOrCreateSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

// Instance method to update verification rules
platformSettingsSchema.methods.updateVerificationRules = async function (userProfile, rules, updatedBy) {
  if (userProfile === 'worker') {
    this.verificationRules.worker = {
      ...this.verificationRules.worker,
      ...rules
    };
  } else if (userProfile === 'vendor') {
    this.verificationRules.vendor = {
      ...this.verificationRules.vendor,
      ...rules
    };
  }

  this.updatedBy = updatedBy;
  this.updatedAt = new Date();
  await this.save();
  return this;
};

// Instance method to update notifications
platformSettingsSchema.methods.updateNotifications = async function (notifications, updatedBy) {
  this.notifications = {
    ...this.notifications,
    ...notifications
  };
  this.updatedBy = updatedBy;
  this.updatedAt = new Date();
  await this.save();
  return this;
};

// Instance method to update language
platformSettingsSchema.methods.updateLanguage = async function (language, updatedBy) {
  this.language = language;
  this.updatedBy = updatedBy;
  this.updatedAt = new Date();
  await this.save();
  return this;
};

module.exports = mongoose.model('PlatformSettings', platformSettingsSchema);