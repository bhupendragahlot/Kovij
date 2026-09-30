/**
 * Member sign-in with Firebase: Google, email + password, and mobile number + SMS code.
 * Firebase (~300 KB) loads only when someone starts signing in.
 */
const load = () => Promise.all([import("firebase/auth"), import("../../firebase/firebase")]);

/** Where Firebase's email links (verify, reset) send people back to. */
const returnUrl = () => ({ url: `${window.location.origin}/member/login` });

export async function signInWithGoogle() {
  const [{ signInWithPopup }, { auth, googleProvider }] = await load();
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

export async function signInWithEmail(email, password) {
  const [{ signInWithEmailAndPassword }, { auth }] = await load();
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

export async function signUpWithEmail({ name, email, password }) {
  const [{ createUserWithEmailAndPassword, updateProfile, sendEmailVerification }, { auth }] = await load();
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await updateProfile(cred.user, { displayName: name.trim() });
  await sendEmailVerification(cred.user, returnUrl());
  return cred.user;
}

export async function resendVerificationEmail() {
  const [{ sendEmailVerification }, { auth }] = await load();
  if (auth.currentUser) await sendEmailVerification(auth.currentUser, returnUrl());
}

/** Re-read the signed-in user, e.g. after they clicked the verification link in another tab. */
export async function reloadCurrentUser() {
  const [{ reload }, { auth }] = await load();
  if (!auth.currentUser) return null;
  await reload(auth.currentUser);
  return auth.currentUser;
}

export async function sendPasswordReset(email) {
  const [{ sendPasswordResetEmail }, { auth }] = await load();
  await sendPasswordResetEmail(auth, email.trim(), returnUrl());
}

/** Indian 10-digit numbers get +91; numbers typed with + and a country code are kept. */
export function toE164(input) {
  const raw = String(input || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `+91${digits.slice(1)}`;
  return null;
}

/**
 * Sends the SMS code. Returns a confirmation whose `confirm(code)` resolves to the Firebase user.
 * `host` is an element the invisible reCAPTCHA can live in; it gets a fresh child each send,
 * because a widget can't be rendered twice in the same element.
 */
export async function sendPhoneCode(phoneE164, host) {
  const [{ RecaptchaVerifier, signInWithPhoneNumber }, { auth }] = await load();
  auth.useDeviceLanguage();
  host.replaceChildren();
  const slot = document.createElement("div");
  host.appendChild(slot);
  const verifier = new RecaptchaVerifier(auth, slot, { size: "invisible" });
  try {
    const confirmation = await signInWithPhoneNumber(auth, phoneE164, verifier);
    return {
      async confirm(code) {
        const cred = await confirmation.confirm(code);
        return cred.user;
      },
    };
  } finally {
    verifier.clear();
  }
}

export async function signOutFirebase() {
  try {
    const [{ signOut }, { auth }] = await load();
    await signOut(auth);
  } catch {
    /* already signed out */
  }
}
