const cloudinary = require('../config/cloudinary');

// Allowed upload contexts and their locked-down parameters.
// Nothing outside this map can be signed.
const UPLOAD_CONTEXTS = {
  profileImage:           { folder: 'profiles',  resource_type: 'image', maxBytes: 5  * 1024 * 1024 },
  companyLogo:            { folder: 'profiles',  resource_type: 'image', maxBytes: 5  * 1024 * 1024 },
  governmentID:           { folder: 'documents', resource_type: 'image', maxBytes: 10 * 1024 * 1024 },
  gstCertificate:         { folder: 'documents', resource_type: 'image', maxBytes: 10 * 1024 * 1024 },
  panCardImage:           { folder: 'documents', resource_type: 'image', maxBytes: 10 * 1024 * 1024 },
  experienceCertificate:  { folder: 'documents', resource_type: 'image', maxBytes: 10 * 1024 * 1024 },
  workSamplesPhoto:       { folder: 'posts',     resource_type: 'image', maxBytes: 10 * 1024 * 1024 },
  postImage:              { folder: 'posts',     resource_type: 'image', maxBytes: 10 * 1024 * 1024 },
  postVideo:              { folder: 'posts',     resource_type: 'video', maxBytes: 100 * 1024 * 1024 },
};

// Validate that required Cloudinary env vars are present at startup.
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.error('[uploadController] Missing Cloudinary environment variables. Signature endpoint will fail.');
}

// @desc    Generate a signed upload signature for direct browser → Cloudinary upload
// @route   POST /api/uploads/signature
// @access  Private
exports.getUploadSignature = (req, res) => {
  const { context } = req.body;

  if (!context || !UPLOAD_CONTEXTS[context]) {
    return res.status(400).json({
      success: false,
      message: `Invalid upload context. Allowed: ${Object.keys(UPLOAD_CONTEXTS).join(', ')}`,
    });
  }

  const { folder, resource_type, maxBytes } = UPLOAD_CONTEXTS[context];

  const timestamp = Math.round(Date.now() / 1000);
  const public_id = `${context}-${req.user._id}-${timestamp}-${Math.round(Math.random() * 1e6)}`;

  // Only sign the params that will be sent to Cloudinary.
  // Any unsigned param Cloudinary receives will cause signature mismatch.
  const paramsToSign = {
    folder,
    public_id,
    timestamp,
  };

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET
  );

  return res.status(200).json({
    success: true,
    data: {
      signature,
      timestamp,
      public_id,
      folder,
      resource_type,
      api_key: process.env.CLOUDINARY_API_KEY,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      maxBytes,
    },
  });
};

// @desc    Verify a Cloudinary asset after direct upload (ownership + folder check)
// @route   POST /api/uploads/confirm
// @access  Private
exports.confirmUpload = async (req, res) => {
  const { public_id, resource_type, secure_url } = req.body;

  if (!public_id || typeof public_id !== 'string') {
    return res.status(400).json({ success: false, message: 'public_id is required' });
  }

  if (!secure_url || typeof secure_url !== 'string') {
    return res.status(400).json({ success: false, message: 'secure_url is required' });
  }

  // Derive the expected context from the public_id prefix (e.g. "postImage-<userId>-...")
  const contextKey = Object.keys(UPLOAD_CONTEXTS).find((k) => public_id.startsWith(k + '-'));
  if (!contextKey) {
    return res.status(400).json({ success: false, message: 'Unrecognised asset public_id' });
  }

  // Ensure the public_id belongs to this user (it was generated with their _id)
  if (!public_id.includes(`-${req.user._id}-`)) {
    return res.status(403).json({ success: false, message: 'Asset does not belong to this user' });
  }

  // Ensure the secure_url is a legitimate Cloudinary URL for our cloud
  const expectedPrefix = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/`;
  if (!secure_url.startsWith(expectedPrefix)) {
    return res.status(400).json({ success: false, message: 'Invalid secure_url' });
  }

  return res.status(200).json({
    success: true,
    data: {
      public_id,
      secure_url,
      resource_type: resource_type || UPLOAD_CONTEXTS[contextKey].resource_type,
    },
  });
};
