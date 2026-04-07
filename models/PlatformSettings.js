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

platformSettingsSchema.updateVerificationRules = async function (userProfile, rules, updatedBy) {
  const settings = await this.getOrCreateSettings();

  if (userProfile === 'worker') {
    settings.verificationRules.worker = {
      ...settings.verificationRules.worker,
      ...rules
    };
  } else if (userProfile === 'vendor') {
    settings.verificationRules.vendor = {
      ...settings.verificationRules.vendor,
      ...rules
    };
  }

  settings.updatedBy = updatedBy;
  settings.updatedAt = new Date();
  await settings.save();
  return settings;
}

module.exports = mongoose.model('PlatformSettings', platformSettingsSchema);