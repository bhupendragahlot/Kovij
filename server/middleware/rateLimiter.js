import rateLimit from 'express-rate-limit';

const limiter = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message, code: 'RATE_LIMIT' },
  });

/** Firebase Google token exchange */
export const authGoogleLimiter = limiter(60 * 1000, 30, 'Too many sign-in attempts. Wait a minute and try again.');

/** Staff password sign-in: slows brute-force guessing. */
export const staffLoginLimiter = limiter(15 * 60 * 1000, 20, 'Too many sign-in attempts. Wait 15 minutes and try again.');

/** Public contact form: it sends email and creates leads, so keep it tight. */
export const contactLimiter = limiter(60 * 60 * 1000, 5, 'Too many messages from this device. Try again later.');

/** Default API limit */
export const apiLimiter = limiter(60 * 1000, 300, 'Too many requests. Slow down and try again.');

/** Bulk email / campaign sends */
export const campaignLimiter = limiter(60 * 1000, 10, 'Too many campaign requests. Wait a minute.');
