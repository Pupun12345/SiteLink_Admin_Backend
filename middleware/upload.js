const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { v2: cloudinary } = require('cloudinary');

// Lazy initialization function
const createStorage = () => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  return new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
      const folderMap = {
        profileImage: 'uploads/profiles',
        companyLogo: 'uploads/profiles',
        workSamplesPhoto: 'uploads/posts',
        governmentID: 'uploads/documents',
        gstCertificate: 'uploads/documents',
        panCardImage: 'uploads/documents',
        experienceCertificate: 'uploads/documents',
        images: 'uploads/posts',
        video: 'uploads/posts'
      };

      const prefixMap = {
        profileImage: 'profile',
        companyLogo: 'company-logo',
        workSamplesPhoto: 'work-sample',
        governmentID: 'document',
        experienceCertificate: 'experience',
        gstCertificate: 'gst-certificate',
        panCardImage: 'pan-card',
        images: 'post',
        video: 'post'
      };
      
      const folder = folderMap[file.fieldname] || 'misc';
      const prefix = prefixMap[file.fieldname] || 'file';
      const isVideo = file.mimetype.startsWith('video/');

      return {
        folder: folder,
        public_id: `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}`,
        resource_type: isVideo ? 'video' : 'auto',
      };
    },
  });
};

const upload = multer({
  storage: createStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

const handleUpload = (uploadMiddleware) => (req, res, next) => {
  uploadMiddleware(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, message: err.message });
    next();
  });
};

module.exports = upload;
module.exports.handleUpload = handleUpload;
