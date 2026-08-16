const User = require('../models/User');
const PlatformSettings = require('../models/PlatformSettings');
const Post = require('../models/Post');
const bcrypt = require('bcryptjs');
const AdminUser = require('../models/AdminUser');
const Skill = require('../models/Skill');
const { verify } = require('crypto');


// Get Profile
exports.getProfile = async (req, res) => {
  try {
    // Check if user is an admin user
    if (req.user.userType === 'admin') {
      const adminUser = await AdminUser.findById(req.user.id);
      if (adminUser) {
        return res.json({
          success: true,
          data: {
            user: {
              id: adminUser._id,
              name: adminUser.name,
              email: adminUser.email,
              role: 'Admin User',
              profileImage: adminUser.profileImage,
              permissions: adminUser.permissions,
              createdAt: adminUser.createdAt
            }
          }
        });
      }
    }

    const regularUser = await User.findById(req.user.id);

    if (!regularUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.json({
      success: true,
      data: {
        user: {
          id: regularUser._id,
          name: regularUser.name,
          email: regularUser.email,
          role: regularUser.role === 'admin' ? 'Super Admin' : regularUser.role,
          profileImage: regularUser.profileImage,
          userType: regularUser.userType,
          createdAt: regularUser.createdAt
        }
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

// Change Password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Please provide current and new password' });
    }

    // First try to find in User collection (Super Admin)
    let user = await User.findById(req.user.id).select('+password');
    let isAdminUser = false;

    // If not found in User, check AdminUser collection
    if (!user) {
      user = await AdminUser.findById(req.user.id).select('+password');
      isAdminUser = true;
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    return res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create Profile - Customer
exports.createCustomerProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.userType !== 'customer') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { name, email, city, role } = req.body;
    if (!role) {
      return res.status(400).json({ success: false, message: 'Role is required' });
    }
    if (name) user.name = name;
    if (email) user.email = email;
    if (city) user.city = city;
    user.role = role;

    if (req.files?.profileImage) user.profileImage = req.files.profileImage[0].path;

    await user.save();

    res.json({
      success: true,
      message: 'Customer profile created successfully',
      user: { id: user._id, name: user.name, phone: user.phone, email: user.email, userType: user.userType, role: user.role, profileImage: user.profileImage, city: user.city }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Edit Profile - Customer
exports.editCustomerProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.userType !== 'customer') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { name, email, city } = req.body;
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (city) updateData.city = city;

    if (req.files?.profileImage) {
      updateData.profileImage = req.files.profileImage[0].path;
    }

    Object.assign(user, updateData);
    await user.save();

    res.json({
      success: true,
      message: 'Customer profile updated successfully',
      user: { id: user._id, name: user.name, phone: user.phone, email: user.email, userType: user.userType, profileImage: user.profileImage, city: user.city }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create Profile - Admin
exports.createAdminProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { name, email } = req.body;
    if (name) user.name = name;
    if (email) user.email = email;

    if (req.files?.profileImage) user.profileImage = req.files.profileImage[0].path;

    await user.save();

    res.json({
      success: true,
      message: 'Admin profile created successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage
      }
    });
  } catch (error) {
    console.error('Create admin profile error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Edit Profile - Admin
exports.editAdminProfile = async (req, res) => {
  try {
    // Check if it's an AdminUser
    if (req.user.userType === 'admin') {
      const adminUser = await AdminUser.findById(req.user.id);

      if (adminUser) {
        const { name, email } = req.body;
        if (name) adminUser.name = name;
        if (email) adminUser.email = email;

        if (req.files?.profileImage) {
          console.log('New profile image uploaded:', req.files.profileImage[0].path);
          adminUser.profileImage = req.files.profileImage[0].path;
        }

        await adminUser.save();
        console.log('AdminUser saved successfully with profileImage:', adminUser.profileImage);

        return res.json({
          success: true,
          message: 'Admin profile updated successfully',
          user: {
            id: adminUser._id,
            name: adminUser.name,
            email: adminUser.email,
            role: 'Admin User',
            profileImage: adminUser.profileImage
          }
        });
      } else {
        // Handle regular User (Super Admin)
        const user = await User.findById(req.user.id);
        console.log('Found user:', user ? user._id : 'not found');

        if (!user || user.role !== 'admin') {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const { name, email } = req.body;
        if (name) user.name = name;
        if (email) user.email = email;

        if (req.files?.profileImage) {
          console.log('New profile image uploaded:', req.files.profileImage[0].path);
          user.profileImage = req.files.profileImage[0].path;
        }

        await user.save();
        console.log('User saved successfully with profileImage:', user.profileImage);

        res.json({
          success: true,
          message: 'Admin profile updated successfully',
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            profileImage: user.profileImage
          }
        });
      }
    }
  } catch (error) {
    console.error('Edit admin profile error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};



const STATES = [
  { id: 1, name: 'Andhra Pradesh' },
  { id: 2, name: 'Arunachal Pradesh' },
  { id: 3, name: 'Assam' },
  { id: 4, name: 'Bihar' },
  { id: 5, name: 'Chhattisgarh' },
  { id: 6, name: 'Goa' },
  { id: 7, name: 'Gujarat' },
  { id: 8, name: 'Haryana' },
  { id: 9, name: 'Himachal Pradesh' },
  { id: 10, name: 'Jharkhand' },
  { id: 11, name: 'Karnataka' },
  { id: 12, name: 'Kerala' },
  { id: 13, name: 'Madhya Pradesh' },
  { id: 14, name: 'Maharashtra' },
  { id: 15, name: 'Manipur' },
  { id: 16, name: 'Meghalaya' },
  { id: 17, name: 'Mizoram' },
  { id: 18, name: 'Nagaland' },
  { id: 19, name: 'Odisha' },
  { id: 20, name: 'Punjab' },
  { id: 21, name: 'Rajasthan' },
  { id: 22, name: 'Sikkim' },
  { id: 23, name: 'Tamil Nadu' },
  { id: 24, name: 'Telangana' },
  { id: 25, name: 'Tripura' },
  { id: 26, name: 'Uttar Pradesh' },
  { id: 27, name: 'Uttarakhand' },
  { id: 28, name: 'West Bengal' },
  { id: 29, name: 'Delhi' },
  { id: 30, name: 'Jammu & Kashmir' },
];

const CITIES = {
  1: ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool', 'Tirupati', 'Rajahmundry'],
  2: ['Itanagar', 'Naharlagun', 'Pasighat', 'Tawang', 'Ziro'],
  3: ['Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat', 'Nagaon', 'Tinsukia'],
  4: ['Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Purnia', 'Darbhanga'],
  5: ['Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Durg', 'Rajnandgaon'],
  6: ['Panaji', 'Margao', 'Vasco da Gama', 'Mapusa', 'Ponda'],
  7: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Gandhinagar'],
  8: ['Faridabad', 'Gurugram', 'Panipat', 'Ambala', 'Yamunanagar', 'Rohtak', 'Hisar'],
  9: ['Shimla', 'Manali', 'Dharamshala', 'Solan', 'Mandi', 'Kullu'],
  10: ['Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro', 'Deoghar', 'Hazaribagh'],
  11: ['Bengaluru', 'Mysuru', 'Hubli', 'Mangaluru', 'Belagavi', 'Kalaburagi', 'Davangere'],
  12: ['Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Thrissur', 'Kollam', 'Palakkad', 'Alappuzha'],
  13: ['Bhopal', 'Indore', 'Jabalpur', 'Gwalior', 'Ujjain', 'Sagar', 'Rewa'],
  14: ['Mumbai', 'Pune', 'Nagpur', 'Nashik', 'Aurangabad', 'Solapur', 'Thane', 'Kolhapur'],
  15: ['Imphal', 'Thoubal', 'Bishnupur', 'Churachandpur', 'Senapati'],
  16: ['Shillong', 'Tura', 'Jowai', 'Nongstoin', 'Baghmara'],
  17: ['Aizawl', 'Lunglei', 'Champhai', 'Serchhip', 'Kolasib'],
  18: ['Kohima', 'Dimapur', 'Mokokchung', 'Tuensang', 'Wokha'],
  19: ['Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur', 'Sambalpur', 'Puri'],
  20: ['Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 'Mohali', 'Pathankot'],
  21: ['Jaipur', 'Jodhpur', 'Kota', 'Bikaner', 'Ajmer', 'Udaipur', 'Alwar', 'Bharatpur'],
  22: ['Gangtok', 'Namchi', 'Gyalshing', 'Mangan', 'Rangpo'],
  23: ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Vellore'],
  24: ['Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Khammam', 'Ramagundam'],
  25: ['Agartala', 'Udaipur', 'Dharmanagar', 'Kailashahar', 'Belonia'],
  26: ['Lucknow', 'Kanpur', 'Agra', 'Varanasi', 'Meerut', 'Allahabad', 'Ghaziabad', 'Noida'],
  27: ['Dehradun', 'Haridwar', 'Roorkee', 'Haldwani', 'Rudrapur', 'Rishikesh'],
  28: ['Kolkata', 'Howrah', 'Durgapur', 'Asansol', 'Siliguri', 'Bardhaman'],
  29: ['New Delhi', 'Dwarka', 'Rohini', 'Janakpuri', 'Laxmi Nagar', 'Saket', 'Pitampura'],
  30: ['Srinagar', 'Jammu', 'Anantnag', 'Baramulla', 'Sopore', 'Kathua'],
};

// @desc  Get all states
// @route GET /api/profile/states
exports.getStates = (req, res) => {
  res.status(200).json({ success: true, data: STATES });
};

// @desc  Get cities by state id
// @route GET /api/profile/cities/:stateId
exports.getCitiesByState = (req, res) => {
  const stateId = parseInt(req.params.stateId);
  if (isNaN(stateId)) return res.status(400).json({ success: false, message: 'Invalid state ID' });
  const state = STATES.find(s => s.id === stateId);

  if (!state) {
    return res.status(404).json({ success: false, message: 'State not found' });
  }

  const cities = (CITIES[stateId] || []).map((name, index) => ({ id: index + 1, name }));
  res.status(200).json({ success: true, state: state.name, data: cities });
};

function getLocationByIds(workStateID, workCityID) {
  const stateId = parseInt(workStateID);
  const cityId = parseInt(workCityID);

  const state = STATES.find(s => s.id === stateId);
  if (!state) return { workState: null, workCity: null };

  const cityName = (CITIES[stateId] || [])[cityId - 1];
  if (!cityName) return { workState: state.name, workCity: null };

  return { workState: state.name, workCity: cityName };
};

//Get Skills with number
exports.getSkills = async (req, res) => {
  try {
    const skills = await Skill.find();
    res.status(200).json({ success: true, data: skills });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

// Create Profile - Worker
exports.createWorkerProfile = async (req, res) => {
  try {
    // Check if admin is creating worker or user is creating their own profile
    const isAdmin = req.user.userType === 'admin';

    let user;
    if (isAdmin) {
      // Admin creating a new worker - validate phone is provided
      const { phone } = req.body;
      if (!phone) {
        return res.status(400).json({ success: false, message: 'Phone number is required' });
      }

      // Check if user with phone already exists
      user = await User.findOne({ phone });
      if (user) {
        return res.status(400).json({ success: false, message: 'User with this phone number already exists' });
      }

      // Create new user for worker
      user = new User({
        phone,
        userType: 'worker',
        isPhoneVerified: true, // Admin-created workers are auto phone-verified
        verificationStatus: 'pending'
      });
    } else {
      // User creating their own worker profile
      user = await User.findById(req.user.id);

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      if (user.userType && user.userType !== 'worker') {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    const { primarySkillId, secondarySkillId, otherSkill } = req.body;

    if (!primarySkillId) return res.status(400).json({ success: false, message: 'Primary skill is required' });

    const parsedPrimarySkillId = parseInt(primarySkillId);
    if (isNaN(parsedPrimarySkillId)) return res.status(400).json({ success: false, message: 'Invalid primary skill ID' });

    const primarySkillDoc = await Skill.findOne({ id: parsedPrimarySkillId });

    if (!primarySkillDoc) return res.status(404).json({ success: false, message: 'Primary skill not found' });

    const newSkills = [];

    let parsedSecondarySkillId = secondarySkillId;
    if (typeof secondarySkillId === 'string' && secondarySkillId.startsWith('[')) {
      try { parsedSecondarySkillId = JSON.parse(secondarySkillId); } catch { parsedSecondarySkillId = [secondarySkillId]; }
    }
    const secondaryIds = Array.isArray(parsedSecondarySkillId) ? parsedSecondarySkillId : (parsedSecondarySkillId != null ? [parsedSecondarySkillId] : []);
    const filteredSecondaryIds = secondaryIds.filter(id => id != null && id !== '' && id !== '0' && id !== 'none' && id !== 0);

    const uniqueSecondaryIds = [...new Set(
      filteredSecondaryIds.filter(
        id => parseInt(id) !== parsedPrimarySkillId
      )
    )];
    for (const secondary of uniqueSecondaryIds) {
      const parsedSecondaryId = parseInt(secondary);
      if (isNaN(parsedSecondaryId)) return res.status(400).json({ success: false, message: 'Invalid secondary skill ID' });
      const secondarySkillDoc = await Skill.findOne({ id: parsedSecondaryId });
      if (!secondarySkillDoc) return res.status(404).json({ success: false, message: 'Secondary skill not found' });
      newSkills.push({ skillId: secondarySkillDoc.id, skillName: secondarySkillDoc.name });
    }

    if (otherSkill && otherSkill.trim()) {
      newSkills.push({ skillId: 0, skillName: otherSkill.trim() });
    }

    user.skills = newSkills;


    const { workStateID, workCityID } = req.body;

    const { workState, workCity } = getLocationByIds(workStateID, workCityID);

    if ((workStateID && !workState) || (workCityID && !workCity)) {
      return res.status(404).json({ success: false, message: 'Invalid work state or city' });
    }

    if ((workStateID && !workCityID) || (!workStateID && workCityID)) {
      return res.status(400).json({
        success: false,
        message: "Both state and city are required"
      });
    }

    if (workState && workCity) {
      user.workState = workState;
      user.city = workCity;
    }

    const { name, dateOfBirth, gender, totalExperience, experienceDescription, willingtoRelocate, salaryType, salary, location } = req.body;

    if (dateOfBirth) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dateOfBirth)) {
        return res.status(400).json({ success: false, message: 'Date of birth should be in format YYYY-MM-DD (Example: 2002-09-23)' });
      }
      if (isNaN(new Date(dateOfBirth).getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid date of birth' });
      }

      // Additional check to ensure DOB is not in the future
      const dob = new Date(dateOfBirth);
      if (
        isNaN(dob.getTime()) ||
        dob > new Date()
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid DOB"
        });
      }

      const age = new Date().getFullYear() - dob.getFullYear();

      if (age < 18) {
        return res.status(400).json({
          success: false,
          message: "Minimum age is 18"
        });
      }

      user.dateOfBirth = dob;
    }


    if (name) user.name = name.trim();

    if (gender) {
      const allowedGenders = ['Male', 'Female', 'Other'];
      const capitalizedGender = gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase();
      if (!allowedGenders.includes(capitalizedGender)) {
        return res.status(400).json({
          success: false,
          message: "Invalid gender. Must be Male, Female, or Other"
        });
      }
      user.gender = capitalizedGender;
    }

    if (totalExperience !== undefined) {
      const exp = Number(totalExperience);
      if (isNaN(exp) || exp < 0 || exp > 60) {
        return res.status(400).json({
          success: false,
          message: "Invalid experience"
        });
      }
      user.experience = exp;
    }

    if (experienceDescription) {
      if (experienceDescription.length > 1000) {
        return res.status(400).json({ success: false, message: "Experience description must be less than 1000 characters" });
      }
      user.experienceDescription = experienceDescription.trim();
    }
    if (willingtoRelocate !== undefined) {
      user.willingtoRelocate = willingtoRelocate === true || willingtoRelocate === 'true';
    }
    if (salaryType) user.salaryType = salaryType.toLowerCase();

    if (salary !== undefined) {
      const parsedSalary = Number(salary);
      if (isNaN(parsedSalary) || parsedSalary < 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid salary"
        });
      }
      user.salary = parsedSalary;
    }

    if (location) user.location = location.trim();

    user.primarySkill = primarySkillDoc.name;
    user.role = primarySkillDoc.name;
    user.userType = 'worker';
    user.isProfileCreated = true;

    if (req.files) {
      if (req.files.profileImage) user.profileImage = req.files.profileImage[0].path;
      if (req.files.workSamplesPhoto) user.workSamplesPhoto = req.files.workSamplesPhoto.map(f => f.path);
      if (req.files.experienceCertificate) user.experienceCertificate = req.files.experienceCertificate[0].path;
      if (req.files.governmentID) user.governmentID = req.files.governmentID[0].path;
    }
    await user.save();

    res.json({
      success: true,
      message: 'Worker profile created successfully',
      user: { id: user._id, name: user.name, phone: user.phone, userType: user.userType, role: user.role, profileImage: user.profileImage, workCity: user.city, primarySkill: user.primarySkill, additionalSkills: user.skills, totalExperience: user.experience, workState: user.workState, willingtoRelocate: user.willingtoRelocate, salaryType: user.salaryType, salary: user.salary, isVerified: user.isVerified, verificationStatus: user.verificationStatus, isProfileCreated: user.isProfileCreated }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Edit Profile - Worker
exports.editWorkerProfile = async (req, res) => {
  try {
    // Check if admin is editing worker or user is editing their own profile
    const isAdmin = req.user.userType === 'admin';

    let user;
    if (isAdmin) {
      // Admin editing a worker - get worker ID from request
      const { workerId } = req.body;
      if (!workerId) {
        return res.status(400).json({ success: false, message: 'Worker ID is required' });
      }

      user = await User.findById(workerId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Worker not found' });
      }

      if (user.userType !== 'worker') {
        return res.status(403).json({ success: false, message: 'User is not a worker' });
      }
    } else {
      // User editing their own worker profile
      user = await User.findById(req.user.id);

      if (!user || user.userType !== 'worker') {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    const { primarySkillId, secondarySkillId, otherSkill, name, dateOfBirth, gender, totalExperience, experienceDescription, willingtoRelocate, salaryType, salary, location, workStateID, workCityID } = req.body;

    if (primarySkillId) {
      const parsedPrimaryId = parseInt(primarySkillId);
      if (isNaN(parsedPrimaryId)) return res.status(400).json({ success: false, message: 'Invalid primary skill ID' });
      const primarySkillDoc = await Skill.findOne({ id: parsedPrimaryId });
      if (!primarySkillDoc) return res.status(404).json({ success: false, message: 'Primary skill not found' });

      let parsedSecondarySkillId = secondarySkillId;
      if (typeof secondarySkillId === 'string' && secondarySkillId.startsWith('[')) {
        try { parsedSecondarySkillId = JSON.parse(secondarySkillId); } catch { parsedSecondarySkillId = [secondarySkillId]; }
      }
      const secondaryIds = Array.isArray(parsedSecondarySkillId) ? parsedSecondarySkillId : (parsedSecondarySkillId != null ? [parsedSecondarySkillId] : []);
      const filteredSecondaryIds = secondaryIds.filter(id => id != null && id !== '' && id !== '0' && id !== 'none' && id !== 0);

      const uniqueSecondaryIds = [...new Set(
        filteredSecondaryIds.filter(
          id => parseInt(id) !== parsedPrimarySkillId
        )
      )];

      const newSkills = [];

      for (const secondary of uniqueSecondaryIds) {
        const parsedSecondaryId = parseInt(secondary);
        if (isNaN(parsedSecondaryId)) return res.status(400).json({ success: false, message: 'Invalid secondary skill ID' });
        const secondarySkillDoc = await Skill.findOne({ id: parsedSecondaryId });
        if (!secondarySkillDoc) return res.status(404).json({ success: false, message: 'Secondary skill not found' });
        newSkills.push({ skillId: secondarySkillDoc.id, skillName: secondarySkillDoc.name });
      }
      if (otherSkill && otherSkill.trim()) newSkills.push({ skillId: 0, skillName: otherSkill.trim() });

      user.skills = newSkills;
      user.markModified('skills');
      user.primarySkill = primarySkillDoc.name;
      user.role = primarySkillDoc.name;
    }

    if ((workStateID && !workCityID) || (!workStateID && workCityID)) {
      return res.status(400).json({
        success: false,
        message: "Both state and city are required"
      });
    }

    if (workStateID && workCityID) {
      const { workState, workCity } = getLocationByIds(workStateID, workCityID);
      if (workState) user.workState = workState;
      if (workCity) user.city = workCity;
    }

    if (name) user.name = name.trim();
    if (dateOfBirth) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(dateOfBirth)) return res.status(400).json({ success: false, message: 'Date of birth should be in format YYYY-MM-DD (Example: 2002-09-23)' });
      if (isNaN(new Date(dateOfBirth).getTime())) return res.status(400).json({ success: false, message: 'Invalid date of birth' });

      // Additional check to ensure DOB is not in the future
      const dob = new Date(dateOfBirth);
      if (
        isNaN(dob.getTime()) ||
        dob > new Date()
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid DOB"
        });
      }

      const age = new Date().getFullYear() - dob.getFullYear();

      if (age < 18) {
        return res.status(400).json({
          success: false,
          message: "Minimum age is 18"
        });
      }

      user.dateOfBirth = dob;
    }

    if (gender) {
      const allowedGenders = ['Male', 'Female', 'Other'];
      const capitalizedGender = gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase();
      if (!allowedGenders.includes(capitalizedGender)) {
        return res.status(400).json({
          success: false,
          message: "Invalid gender. Must be Male, Female, or Other"
        });
      }
      user.gender = capitalizedGender;
    }

    if (totalExperience !== undefined) {
      const exp = Number(totalExperience);
      if (isNaN(exp) || exp < 0 || exp > 60) {
        return res.status(400).json({
          success: false,
          message: "Invalid experience"
        });
      }
      user.experience = exp;
    }

    if (experienceDescription) {
      if (experienceDescription.length > 1000) {
        return res.status(400).json({ success: false, message: "Experience description must be less than 1000 characters" });
      }
      user.experienceDescription = experienceDescription.trim();
    }

    if (willingtoRelocate !== undefined) {
      user.willingtoRelocate = willingtoRelocate === true || willingtoRelocate === 'true';
    }
    if (salaryType) user.salaryType = salaryType;

    if (salary !== undefined) {
      const parsedSalary = Number(salary);
      if (isNaN(parsedSalary) || parsedSalary < 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid salary"
        });
      }
      user.salary = parsedSalary;
    }

    if (location) user.location = location.trim();

    if (req.files) {
      if (req.files.profileImage) {
        if (user.profileImage)
          user.profileImage = req.files.profileImage[0].path;
      }
      if (req.files.workSamplesPhoto) user.workSamplesPhoto = req.files.workSamplesPhoto.map(f => f.path);
      if (req.files.experienceCertificate) user.experienceCertificate = req.files.experienceCertificate[0].path;
      if (req.files.governmentID) user.governmentID = req.files.governmentID[0].path;
    }

    await user.save();
    const savedUser = await User.findById(user._id);

    res.json({
      success: true,
      message: 'Worker profile updated successfully',
      user: { id: savedUser._id, name: savedUser.name, phone: savedUser.phone, userType: savedUser.userType, role: savedUser.role, profileImage: savedUser.profileImage, workCity: savedUser.city, primarySkill: savedUser.primarySkill, additionalSkills: savedUser.skills, totalExperience: savedUser.experience, workState: savedUser.workState, willingtoRelocate: savedUser.willingtoRelocate, salaryType: savedUser.salaryType, salary: savedUser.salary, isVerified: savedUser.isVerified, verificationStatus: savedUser.verificationStatus, isProfileCreated: savedUser.isProfileCreated }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// Create Profile - Vendor
exports.createVendorProfile = async (req, res) => {
  try {
    // Check if admin is creating vendor or user is creating their own profile
    const isAdmin = req.user.userType === 'admin';

    let user;
    if (isAdmin) {
      // Admin creating a new vendor
      const { phone } = req.body;
      if (!phone) {
        return res.status(400).json({ success: false, message: 'Phone number is required' });
      }

      // Check if user with phone already exists
      user = await User.findOne({ phone });
      if (user) {
        return res.status(400).json({ success: false, message: 'User with this phone number already exists' });
      }

      // Create new user for vendor with auto phone verified
      user = new User({
        phone,
        userType: 'vendor',
        isPhoneVerified: true,
        verificationStatus: 'pending'
      });
    } else {
      // User create their own vendor profile
      user = await User.findById(req.user.id);

      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      if (user.userType && user.userType !== 'vendor') {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    const { companyName, name, email, designation, workArea, gstNumber, whatsappNumber, website, workStateID, workCityID, panNumber } = req.body;

    if (!companyName) return res.status(400).json({ success: false, message: 'Company name is required' });
    if (!name) return res.status(400).json({ success: false, message: 'Name is required' });
    if (!designation) return res.status(400).json({ success: false, message: 'Designation is required' });
    if (!panNumber) return res.status(400).json({ success: false, message: 'Pan Number is required' });

    if ((workStateID && !workCityID) || (!workStateID && workCityID)) {
      return res.status(400).json({
        success: false,
        message: "Both state and city are required"
      });
    }

    if (workStateID && workCityID) {
      const { workState, workCity } = getLocationByIds(workStateID, workCityID);
      if (workState) user.workState = workState;
      if (workCity) user.city = workCity;
    }

    if (companyName) user.companyName = companyName.trim();
    if (name) user.name = name.trim();
    if (email) user.email = email;
    if (designation) user.role = designation.trim();
    if (workArea) user.workArea = workArea.trim();
    if (gstNumber) user.gstNumber = gstNumber;
    if (whatsappNumber) user.whatsappNumber = whatsappNumber;
    if (website) user.website = website.trim();
    if (panNumber) user.panNumber = panNumber;
    user.userType = 'vendor';
    user.isProfileCreated = true;

    if (req.files) {
      if (req.files.profileImage) user.profileImage = req.files.profileImage[0].path;
      if (req.files.companyLogo) user.companyLogo = req.files.companyLogo[0].path;
      if (req.files.panCardImage) user.panCardImage = req.files.panCardImage[0].path;
      if (req.files.gstCertificate) user.gstCertificate = req.files.gstCertificate[0].path;
    }

    if (!user.panCardImage) return res.status(400).json({ success: false, message: 'PanCard image is required' });
    if (!user.gstCertificate) return res.status(400).json({ success: false, message: 'GST Certificate image is required' });

    await user.save();
    const savedUser = await User.findById(user._id);

    res.json({
      success: true,
      message: 'Vendor profile created successfully',
      user: {
        id: savedUser._id, name: savedUser.name, phone: savedUser.phone, email: savedUser.email, userType: savedUser.userType, role: savedUser.role, profileImage: savedUser.profileImage, companyName: savedUser.companyName, companyLogo: savedUser.companyLogo, gstCertificate: savedUser.gstCertificate, panCardImage: savedUser.panCardImage, designation: savedUser.role, workCity: savedUser.city, workState: savedUser.workState, workArea: savedUser.workArea, gstNumber: savedUser.gstNumber, whatsappNumber: savedUser.whatsappNumber, website: savedUser.website, panNumber: savedUser.panNumber, isVerified: savedUser.isVerified, verificationStatus: savedUser.verificationStatus, isProfileCreated: savedUser.isProfileCreated
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Edit Profile - Vendor
exports.editVendorProfile = async (req, res) => {
  try {
    // Check if admin is editing vendor or user is editing their own profile
    const isAdmin = req.user.userType === 'admin';

    let user;
    if (isAdmin) {
      // Admin editing a vendor - get vendor ID from request
      const { vendorId } = req.body;
      if (!vendorId) {
        return res.status(400).json({ success: false, message: 'Vendor ID is required' });
      }

      user = await User.findById(vendorId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'Vendor not found' });
      }

      if (user.userType !== 'vendor') {
        return res.status(403).json({ success: false, message: 'User is not a vendor' });
      }
    } else {
      // User editing their own vendor profile
      user = await User.findById(req.user.id);

      if (!user || user.userType !== 'vendor') {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    const { companyName, name, email, designation, workArea, gstNumber, whatsappNumber, website, workStateID, workCityID, panNumber } = req.body;

    if ((workStateID && !workCityID) || (!workStateID && workCityID)) {
      return res.status(400).json({
        success: false,
        message: "Both state and city are required"
      });
    }

    if (workStateID && workCityID) {
      const { workState, workCity } = getLocationByIds(workStateID, workCityID);
      if (workState) user.workState = workState;
      if (workCity) user.city = workCity;
    }

    if (companyName) user.companyName = companyName.trim();
    if (name) user.name = name.trim();
    if (email) user.email = email;
    if (designation) { user.role = designation.trim(); }
    if (workArea) user.workArea = workArea.trim();
    if (gstNumber) user.gstNumber = gstNumber;
    if (whatsappNumber) user.whatsappNumber = whatsappNumber;
    if (website) user.website = website.trim();
    if (panNumber) user.panNumber = panNumber;

    if (req.files) {
      if (req.files.profileImage) user.profileImage = req.files.profileImage[0].path;
      if (req.files.companyLogo) user.companyLogo = req.files.companyLogo[0].path;
      if (req.files.panCardImage) user.panCardImage = req.files.panCardImage[0].path;
      if (req.files.gstCertificate) user.gstCertificate = req.files.gstCertificate[0].path;
    }

    if (!user.panCardImage) return res.status(400).json({ success: false, message: 'PanCard image is required' });
    if (!user.gstCertificate) return res.status(400).json({ success: false, message: 'GST Certificate image is required' });

    await user.save();
    const savedUser = await User.findById(user._id);

    res.json({
      success: true,
      message: 'Vendor profile updated successfully',
      user: { id: savedUser._id, name: savedUser.name, phone: savedUser.phone, email: savedUser.email, userType: savedUser.userType, role: savedUser.role, profileImage: savedUser.profileImage, companyName: savedUser.companyName, companyLogo: savedUser.companyLogo, gstCertificate: savedUser.gstCertificate, panCardImage: savedUser.panCardImage, designation: savedUser.role, workCity: savedUser.city, workState: savedUser.workState, workArea: savedUser.workArea, gstNumber: savedUser.gstNumber, whatsappNumber: savedUser.whatsappNumber, website: savedUser.website, panNumber: savedUser.panNumber, isVerified: savedUser.isVerified, verificationStatus: savedUser.verificationStatus, isProfileCreated: savedUser.isProfileCreated }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
