/** Plain-language messages for Firebase sign-in errors. `null` means stay quiet (the person cancelled). */
const FIREBASE_MESSAGES = {
  "auth/popup-closed-by-user": null,
  "auth/cancelled-popup-request": null,
  "auth/user-cancelled": null,
  "auth/popup-blocked": "Your browser blocked the Google window. Allow pop-ups for this site and try again.",
  "auth/invalid-credential": "The email or password is wrong.",
  "auth/wrong-password": "The email or password is wrong.",
  "auth/user-not-found": "The email or password is wrong.",
  "auth/invalid-login-credentials": "The email or password is wrong.",
  "auth/missing-password": "Enter your password.",
  "auth/email-already-in-use": "An account with this email already exists. Sign in instead.",
  "auth/weak-password": "Use a password with at least 8 characters.",
  "auth/password-does-not-meet-requirements": "Use a stronger password: at least 8 characters, with letters and numbers.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/missing-email": "Enter your email address.",
  "auth/user-disabled": "This account has been turned off. Please contact the gym.",
  "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
  "auth/invalid-phone-number": "Enter a valid mobile number.",
  "auth/missing-phone-number": "Enter your mobile number.",
  "auth/invalid-verification-code": "That code is wrong. Check the SMS and try again.",
  "auth/missing-verification-code": "Enter the 6-digit code from the SMS.",
  "auth/code-expired": "That code has expired. Send a new one.",
  "auth/session-expired": "That code has expired. Send a new one.",
  "auth/quota-exceeded": "We can’t send more codes right now. Try again later, or sign in with email.",
  "auth/captcha-check-failed": "We couldn’t confirm you’re not a robot. Refresh the page and try again.",
  "auth/invalid-app-credential": "We couldn’t confirm you’re not a robot. Refresh the page and try again.",
  "auth/network-request-failed": "No internet connection. Check it and try again.",
  "auth/operation-not-allowed": "This sign-in option isn’t available yet. Please use another one.",
  "auth/admin-restricted-operation": "This sign-in option isn’t available yet. Please use another one.",
  "auth/billing-not-enabled": "Mobile sign-in isn’t available yet. Please use email or Google.",
  "auth/unauthorized-domain": "Sign-in isn’t set up for this website address yet. Please contact the gym.",
  "auth/invalid-api-key": "Sign-in isn’t set up yet. Please contact the gym.",
};

export function authErrorMessage(err) {
  const code = err?.code;
  if (typeof code === "string" && code.startsWith("auth/")) {
    if (code in FIREBASE_MESSAGES) return FIREBASE_MESSAGES[code];
    return "We couldn’t sign you in. Please try again.";
  }
  if (err?.response) return err.response.data?.message || "We couldn’t sign you in. Please try again.";
  if (err?.request) return "We couldn’t reach the gym’s server. Check your connection and try again.";
  return err?.message || "We couldn’t sign you in. Please try again.";
}
