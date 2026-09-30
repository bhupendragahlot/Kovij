/**
 * Content Security Policy for the SPA served from /kovij-fitness-zone/dist.
 * Allows only what the app actually loads: Firebase Google sign-in, Google Analytics,
 * Google Fonts, the Google Maps embed, and remote images (trainer/hero photos are URLs).
 */
export const contentSecurityPolicy = {
  useDefaults: true,
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", 'https://www.googletagmanager.com', 'https://apis.google.com'],
    connectSrc: [
      "'self'",
      'https://*.googleapis.com',
      'https://*.firebaseio.com',
      'https://www.google-analytics.com',
      'https://*.google-analytics.com',
      'https://www.googletagmanager.com',
    ],
    frameSrc: ["'self'", 'https://*.firebaseapp.com', 'https://accounts.google.com', 'https://www.google.com', 'https://maps.google.com'],
    imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
    workerSrc: ["'self'"],
    manifestSrc: ["'self'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
  },
};
