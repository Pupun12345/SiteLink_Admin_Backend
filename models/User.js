const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name'],
    trim: true,
  },
  phone: {
    type: String,
    required: [true, 'Please provide a phone number'],
    unique: true,
    trim: true,
    match: [
      /^[6-9]\d{9}$/,
      'Please provide a valid 10-digit phone number',
    ],
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please provide a valid email',
    ],
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 8,
    select: false, // Don't return password by default in queries
  },
  role: {
    type: String,
    enum: ['user', 'vendor', 'worker', 'admin'],
    default: 'user',
  },
  userType: {
    type: String,
    enum: ['customer', 'vendor', 'worker','admin'],
    required: [true, 'Please specify user type'],
    default: 'customer',
  },
  profileImage: {
    type: String,
    default: null,
  },
  // Only in worker fields
  aadhaarFrontImage: {
    type: String,
    default: null,
  },
  aadhaarBackImage: {
    type: String,
    default: null,
  },
  medicalCertificate: {
    type: String,
    default: null,
  },
  //vendor-specific field
  panCardImage: {
    type: String,
    default:null,
  },
  // Worker-specific fields
  age: {
    type: Number,
    min: [18, 'Age must be at least 18'],
    max: [100, 'Age must be less than 100'],
    default: null,
  },
  city: {
    type: String,
    trim: true,
    default: null,
  },
  dailyRate: {
    type: Number,
    default: null,
    min: [0, 'Daily rate cannot be negative'],
  },
  aadhaarNumber: {
    type: String,
    trim: true,
    default: null,
    match: [
      /^\d{12}$/,
      'Please provide a valid 12-digit Aadhaar number',
    ],
  },
  experience: {
    type: String,
    enum: ['0-1 Year', '1-3 Years', '3-5 Years', '5+ Years'],
    default: null,
  },
  skills: {
   type:[
    {
      skillId:{type:Number, required: true},
      skillName:{type: String, required: true}
    }
   ],
   default:[],
  },
  // Vendor/Contractor-specific fields
  companyLogo: {
    type: String,
    default: null,
  },
  ownerName: {
    type: String,
    trim: true,
    default: null,
  },
  companyName: {
    type: String,
    trim: true,
    default: null,
  },
  panNumber:{
   type: String,
   trim: true ,
   uppercase: true,
   default : null ,
   match:[
    /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
    'Please provide a valid PAN number (i.e., ABCDE1234F)'
   ],
  },
  gstNumber: {
    type: String,
    trim: true,
    uppercase: true,
    default: null,
    match: [
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
      'Please provide a valid GST number',
    ],
  },
  licenseNumber: {
    type: String,
    trim: true,
    uppercase: true,
    default: null,
  },
  projectTypes: {
    type: [String],
    enum: ['Residential Building', 'Commercial Building', 'Industrial Project', 'Infrastructure', 'Renovation', 'Interior Design'],
    default: [],
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending',
  },
  verificationRejectedReason: {
    type: String,
    default: null,
  },
  verificationReviewedAt: {
    type: Date,
    default: null,
  },
  adminRating: {
    type: Number,
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating must be at most 5'],
    default: null,
  },
  adminRatingComment: {
    type: String,
    default: null,
  },
  ratedAt: {
    type: Date,
    default: null,
  },
  certificates: {
    type: [String],
    default: [],
  },
  otp: {
    type: String,
    select: false, // Don't return OTP by default in queries
  },
  otpExpire: {
    type: Date,
    select: false, // Don't return OTP expiration by default
  },
  otpAttempts: {
    type: Number,
    default: 0,
    select: false, // Don't return OTP attempts by default
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  resetPasswordToken: {
    type: String,
    select: false,
  },
  resetPasswordExpire: {
    type: Date,
    select: false,
  },
  website: {
    type: String,
    default: null,
  },
  emergencyContact: {
    type: String,
    default: null,
  },
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare password
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
