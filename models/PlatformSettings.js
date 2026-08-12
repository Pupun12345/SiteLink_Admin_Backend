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
  supportContact: {
    phone: { type: String, default: '' },
    whatsapp: { type: String, default: '' },
    email: { type: String, default: '' },
    hoursWeekday: { type: String, default: '' },
    hoursSunday: { type: String, default: '' },
    emergencyNote: { type: String, default: '' },
    avgResponseTime: { type: String, default: '' },
  },
  // App maintenance notice — admin panel se on/off hota hai. Enabled hone par
  // app dashboard par ek info dialog dikhata hai (user dismiss kar sakta hai,
  // app band nahi hoti).
  maintenance: {
    enabled: { type: Boolean, default: false },
    title: { type: String, default: 'Under Maintenance' },
    message: { type: String, default: '' },
    // Kab tak chalega (optional) — app "till <time>" line dikhata hai.
    until: { type: Date, default: null },
    // Message badalne par app dobara dialog dikha sake, isliye alag stamp.
    updatedAt: { type: Date, default: Date.now },
  },
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

// Instance method to update support contact info (app's Contact Support screen)
platformSettingsSchema.methods.updateSupportContact = async function (supportContact, updatedBy) {
  this.supportContact = {
    ...this.supportContact,
    ...supportContact
  };
  this.updatedBy = updatedBy;
  this.updatedAt = new Date();
  await this.save();
  return this;
};

// Instance method to update maintenance notice (app dashboard dialog)
platformSettingsSchema.methods.updateMaintenance = async function (maintenance, updatedBy) {
  const current = this.maintenance ? this.maintenance.toObject?.() ?? this.maintenance : {};
  this.maintenance = {
    ...current,
    ...maintenance,
    // App isi stamp se decide karta hai ki naya notice dobara dikhana hai
    updatedAt: new Date(),
  };
  this.updatedBy = updatedBy;
  this.updatedAt = new Date();
  await this.save();
  return this;
};

module.exports = mongoose.model('PlatformSettings', platformSettingsSchema);