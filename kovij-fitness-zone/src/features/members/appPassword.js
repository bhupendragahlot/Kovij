/** "1995-08-15T00:00:00Z" → "15081995": the member's first app password (same rule as the server). */
export function dobPassword(dob) {
  if (!dob) return "";
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(dob)).split("-");
  return `${d}${m}${y}`;
}
