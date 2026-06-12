const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directories exist
const profileDir = 'uploads/profiles';
const documentsDir = 'uploads/documents';
const postsDir = 'uploads/posts';

if (!fs.existsSync(profileDir)) {
  fs.mkdirSync(profileDir, { recursive: true });
}
if (!fs.existsSync(documentsDir)) {
  fs.mkdirSync(documentsDir, { recursive: true });
}
if (!fs.existsSync(postsDir)) {
  fs.mkdirSync(postsDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Use different folders based on field name
    if (file.fieldname === 'profileImage' || file.fieldname === 'companyLogo') {
      cb(null, profileDir);
    } else if (file.fieldname === 'aadhaarFrontImage' || file.fieldname === 'aadhaarBackImage'|| file.fieldname === 'panCardImage') {
      cb(null, documentsDir);
    } else if (file.fieldname === 'images' || file.fieldname === 'video') {
      cb(null, postsDir);
    } else {
      cb(null, profileDir);
    }
  },
  filename: function (req, file, cb) {
    // Create unique filename based on field type
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    let prefix = 'file';
    
    if (file.fieldname === 'profileImage') {
      prefix = 'profile';
    } else if (file.fieldname === 'companyLogo') {
      prefix = 'company-logo';
    } else if (file.fieldname === 'aadhaarFrontImage') {
      prefix = 'aadhaar-front';
    } else if (file.fieldname === 'aadhaarBackImage') {
      prefix = 'aadhaar-back';
    }
    else if (file.fieldname === 'panCardImage'){
      prefix = 'pan-card';
    }
    else if (file.fieldname === 'images' || file.fieldname === 'video'){
      prefix = 'post';
    }
    
    cb(null, prefix + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter - accept images and videos
const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'video') {
    const allowedVideo = /mp4|mov|avi|mkv|webm/;
    const extname = allowedVideo.test(path.extname(file.originalname).toLowerCase());
    const mimetype = /video/.test(file.mimetype);
    if (mimetype && extname) return cb(null, true);
    return cb(new Error('Only video files are allowed (mp4, mov, avi, mkv, webm)'));
  }
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  if (mimetype && extname) return cb(null, true);
  cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
};

// Create multer upload instance
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB to support videos
  },
  fileFilter: fileFilter,
});

module.exports = upload;
