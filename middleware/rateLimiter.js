// Lightweight, dependency-free in-memory rate limiter.
// Good for a single-instance deployment (e.g. one Render service).
// If you later scale to multiple instances, swap this for a Redis-backed
// limiter (e.g. express-rate-limit + rate-limit-redis) so limits are shared.

const createRateLimiter = ({ windowMs, max, message }) => {
  const hits = new Map(); // key -> { count, resetAt }

  // Periodically drop expired entries so the map doesn't grow unbounded.
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (now > entry.resetAt) hits.delete(key);
    }
  }, windowMs);
  if (typeof timer.unref === 'function') timer.unref();

  return (req, res, next) => {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const key = `${ip}:${req.baseUrl || ''}${req.path}`;
    const now = Date.now();

    let entry = hits.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }

    entry.count += 1;

    if (entry.count > max) {
      const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        success: false,
        message: message || 'Too many requests. Please try again later.',
        retryAfterSeconds,
      });
    }

    next();
  };
};

// Strict — for endpoints that trigger an OTP / SMS or are easy to abuse.
const otpRequestLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: 'Too many OTP requests. Please wait a few minutes and try again.',
});

// General auth — login / register / verify / reset.
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: 'Too many attempts. Please wait a few minutes and try again.',
});

module.exports = { createRateLimiter, otpRequestLimiter, authLimiter };
