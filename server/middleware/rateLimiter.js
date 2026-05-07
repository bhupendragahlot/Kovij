import rateLimit from 'express-rate-limit';

/** Strict limit for Firebase Google token exchange */
export const authGoogleLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts', code: 'RATE_LIMIT' },
});

/** Default API limit */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests', code: 'RATE_LIMIT' },
});

/** Bulk email / campaign sends */
export const campaignLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many campaign requests', code: 'RATE_LIMIT' },
});
