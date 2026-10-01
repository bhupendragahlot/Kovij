export const MIN_PASSWORD = 8;

/** Client-side check mirroring the server's rules, so most mistakes show before sending. */
export function newPasswordProblem({ password, confirm }, { email } = {}) {
  if (password.length < MIN_PASSWORD) return { password: `Use at least ${MIN_PASSWORD} characters` };
  if (email && password.toLowerCase() === String(email).toLowerCase()) return { password: "Don’t use your email address" };
  if (password !== confirm) return { confirm: "The two passwords don’t match" };
  return null;
}
