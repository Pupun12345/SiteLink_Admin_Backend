const https = require('https');
const http = require('http');
const { URL } = require('url');

// Allowed Cloudinary host to prevent SSRF
const ALLOWED_HOST = 'res.cloudinary.com';

// Map common extensions to MIME types
const MIME_MAP = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  tif: 'image/tiff',
};

// Sanitize a filename: keep only safe characters
function sanitizeFilename(name) {
  return name
    .replace(/[^\w.\-]/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200) || 'document';
}

// Derive a clean filename from a Cloudinary URL + optional label
function buildFilename(cloudinaryUrl, label) {
  try {
    const parsed = new URL(cloudinaryUrl);
    const segments = parsed.pathname.split('/');
    const rawFilename = segments[segments.length - 1] || 'document';
    const ext = rawFilename.includes('.') ? rawFilename.split('.').pop().toLowerCase() : '';

    if (label) {
      const base = label.toLowerCase().replace(/\s+/g, '-');
      return sanitizeFilename(ext ? `${base}.${ext}` : base);
    }

    // Strip Cloudinary version prefix (v1234567890) if present
    const withoutVersion = rawFilename.replace(/^v\d+-/, '');
    return sanitizeFilename(withoutVersion || 'document');
  } catch {
    return 'document';
  }
}

// Determine MIME type from URL extension or fallback to octet-stream
function getMimeType(url, contentTypeHeader) {
  if (contentTypeHeader && !contentTypeHeader.includes('application/octet-stream')) {
    return contentTypeHeader.split(';')[0].trim();
  }
  try {
    const parsed = new URL(url);
    const ext = parsed.pathname.split('.').pop().toLowerCase();
    return MIME_MAP[ext] || 'application/octet-stream';
  } catch {
    return 'application/octet-stream';
  }
}

// @desc    Stream a Cloudinary file to the client as a download
// @route   GET /api/files/download?url=<encoded>&label=<optional>
// @access  Private (admin)
exports.downloadFile = (req, res) => {
  const { url: encodedUrl, label } = req.query;

  if (!encodedUrl) {
    return res.status(400).json({ success: false, message: 'url query parameter is required' });
  }

  let fileUrl;
  try {
    fileUrl = decodeURIComponent(encodedUrl);
    const parsed = new URL(fileUrl);

    // Security: only allow our Cloudinary host
    if (parsed.hostname !== ALLOWED_HOST) {
      return res.status(403).json({ success: false, message: 'Forbidden file source' });
    }

    // Force HTTPS
    if (parsed.protocol !== 'https:') {
      parsed.protocol = 'https:';
      fileUrl = parsed.toString();
    }
  } catch {
    return res.status(400).json({ success: false, message: 'Invalid URL' });
  }

  const filename = buildFilename(fileUrl, label);

  const protocol = fileUrl.startsWith('https') ? https : http;

  const request = protocol.get(fileUrl, (cloudinaryRes) => {
    if (cloudinaryRes.statusCode === 301 || cloudinaryRes.statusCode === 302) {
      // Follow one redirect
      const redirectUrl = cloudinaryRes.headers.location;
      if (!redirectUrl) {
        return res.status(502).json({ success: false, message: 'Bad redirect from storage' });
      }
      const redirectReq = https.get(redirectUrl, (redirectRes) => {
        if (redirectRes.statusCode !== 200) {
          return res.status(502).json({ success: false, message: 'File not found in storage' });
        }
        streamResponse(redirectRes, res, filename, fileUrl);
      });
      redirectReq.on('error', () => res.status(502).json({ success: false, message: 'Storage fetch failed' }));
      return;
    }

    if (cloudinaryRes.statusCode !== 200) {
      return res.status(502).json({ success: false, message: 'File not found in storage' });
    }

    streamResponse(cloudinaryRes, res, filename, fileUrl);
  });

  request.on('error', () => {
    if (!res.headersSent) {
      res.status(502).json({ success: false, message: 'Failed to fetch file from storage' });
    }
  });

  request.setTimeout(30000, () => {
    request.destroy();
    if (!res.headersSent) {
      res.status(504).json({ success: false, message: 'Storage request timed out' });
    }
  });
};

function streamResponse(cloudinaryRes, res, filename, originalUrl) {
  const mimeType = getMimeType(originalUrl, cloudinaryRes.headers['content-type']);
  const contentLength = cloudinaryRes.headers['content-length'];

  res.setHeader('Content-Type', mimeType);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`
  );
  res.setHeader('Cache-Control', 'no-store');
  if (contentLength) {
    res.setHeader('Content-Length', contentLength);
  }

  cloudinaryRes.pipe(res);

  cloudinaryRes.on('error', () => {
    if (!res.headersSent) {
      res.status(502).json({ success: false, message: 'Stream error' });
    }
  });
}
