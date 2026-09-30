/** `upi://pay` link with standard parameters only (mirrors server/services/paymentService.js). */
export function upiLink({ upiId, payeeName, amount, note }) {
  const parts = [`pa=${encodeURIComponent(upiId)}`];
  if (payeeName) parts.push(`pn=${encodeURIComponent(payeeName)}`);
  if (amount) parts.push(`am=${Number(amount).toFixed(2)}`);
  parts.push("cu=INR");
  if (note) parts.push(`tn=${encodeURIComponent(note)}`);
  return `upi://pay?${parts.join("&")}`;
}

/** Looks like a UPI ID: name@bank (letters, digits, dot, dash, underscore before the @). */
export const UPI_ID_PATTERN = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/;
