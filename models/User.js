const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
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
    minlength: 8,
    select: false,
  },
  role: {
    type: String,
  },
  userType: {
    type: String,
<<<<<<< HEAD
    enum: ['customer', 'vendor', 'worker','admin'],
=======
    enum: ['customer', 'vendor', 'worker', 'admin'],
>>>>>>> eb5f507 (New Routes has beeen added)
    required: [true, 'Please specify user type']
  },
  profileImage: {
    type: String,
    default: null,
  },
<<<<<<< HEAD
  isProfileCreated:{
    type: Boolean,
    default: false,
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
=======
  isProfileCreated: {
    type: Boolean,
    default: false,
  },
>>>>>>> eb5f507 (New Routes has beeen added)
  // Worker-specific fields
  dateOfBirth: {
    type: Date,
    default: null,
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other'],
    default: null,
  },
  primarySkill: {
    type: String,
    default: null,
  },
  experienceDescription: {
    type: String,
    default: null,
  },
  workState: {
    type: String,
    default: null,
  },
  willingtoRelocate: {
    type: Boolean,
    default: false,
  },
  salaryType: {
    type: String,
    enum: ['daily', 'monthly', 'hourly', 'project-based'],
    default: null,
  },
  salary: {
    type: Number,
    default: null,
  },
  workSamplesPhoto: {
    type: [String],
    default: [],
  },
  experienceCertificate: {
    type: String,
    default: null,
  },
  governmentID: {
    type: String,
    default: null,
  },
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
    default: null,
  },
  skills: {
<<<<<<< HEAD
   type:[
    {
      skillId:{type:Number, required: true},
      skillName:{type: String, required: true}
    }
   ],
   default:[],
  },
  // Vendor/Contractor-specific fields
=======
    type: [
      {
        skillId: { type: Number, required: true },
        skillName: { type: String, required: true }
      }
    ],
    default: [],
  },
  // Vendor specific fields
>>>>>>> eb5f507 (New Routes has beeen added)
  designation: {
    type: String,
    default: null,
  },
  workArea: {
    type: String,
    default: null,
  },
  companyLogo: {
    type: String,
    default: null,
  },
  companyName: {
    type: String,
    trim: true,
    default: null,
  },
<<<<<<< HEAD
  panNumber:{
   type: String,
   trim: true ,
   uppercase: true,
   default : null ,
   match:[
    /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
    'Please provide a valid PAN number (i.e., ABCDE1234F)'
   ],
=======
  panNumber: {
    type: String,
    trim: true,
    uppercase: true,
    default: null,
    match: [
      /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
      'Please provide a valid PAN number (i.e., ABCDE1234F)'
    ],
>>>>>>> eb5f507 (New Routes has beeen added)
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
<<<<<<< HEAD
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
=======
   panCardImage: {
    type: String,
    default: null,
  },
  gstCertificate: {
    type: String,
    default: null,
  },
  //common-fields
  subscription: {
    type: Boolean,
    default: false
  },
  subscriptionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription',
    default: null
>>>>>>> eb5f507 (New Routes has beeen added)
  },
  isPhoneVerified: {
    type: Boolean,
    default: false,
  },
<<<<<<< HEAD
  location:{
    type:String,
    default:null,
=======
  location: {
    type: String,
    default: null,
>>>>>>> eb5f507 (New Routes has beeen added)
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected', 'suspended', 'banned'],
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
  whatsappNumber: {
    type: String,
    trim: true,
    default: null,
    match: [
      /^[6-9]\d{9}$/,
      'Please provide a valid 10-digit WhatsApp number',
    ],
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
  if (this.password) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
