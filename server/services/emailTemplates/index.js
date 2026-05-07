/**
 * @param {Record<string, string|number|undefined>} vars
 */
function wrapHtml(title, body) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body style="font-family:system-ui,sans-serif;line-height:1.5">${body}</body></html>`;
}

function toIstDdMmYyyyHm(value) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  try {
    // en-GB -> dd/mm/yyyy; enforce IST, add HH:mm (24h)
    const date = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);
    const time = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
    return `${date} ${time}`;
  } catch {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = String(d.getFullYear());
    return `${dd}/${mm}/${yyyy}`;
  }
}

export function welcomeEmail({ name, planName, startDate, endDate, gymName = 'Kovij Fitness Zone' }) {
  const subject = `Welcome to ${gymName}`;
  const html = wrapHtml(
    subject,
    `<h2>Welcome, ${name}!</h2>
    <p>Your membership is active.</p>
    <ul>
      <li><strong>Plan:</strong> ${planName}</li>
      <li><strong>Start:</strong> ${toIstDdMmYyyyHm(startDate)}</li>
      <li><strong>End:</strong> ${toIstDdMmYyyyHm(endDate)}</li>
    </ul>
    <p>See you at the gym!</p>`
  );
  return { subject, html };
}

export function expiryReminderEmail({ name, endDate, gymName = 'Kovij Fitness Zone' }) {
  const subject = `Your ${gymName} membership expires soon`;
  const html = wrapHtml(
    subject,
    `<p>Hi ${name},</p>
    <p>Your membership will expire on <strong>${toIstDdMmYyyyHm(endDate)}</strong> (in about 3 days). Renew to keep training without interruption.</p>`
  );
  return { subject, html };
}

export function expiredEmail({ name, gymName = 'Kovij Fitness Zone' }) {
  const subject = `Your ${gymName} membership has expired`;
  const html = wrapHtml(
    subject,
    `<p>Hi ${name},</p>
    <p>Your membership has ended. We'd love to have you back — reply or visit the front desk to renew.</p>`
  );
  return { subject, html };
}

export function planUpdatedEmail({ name, planName, startDate, endDate, changeType, gymName = 'Kovij Fitness Zone' }) {
  const subject = `Your ${gymName} plan was updated`;
  const html = wrapHtml(
    subject,
    `<p>Hi ${name},</p>
    <p>Your plan was <strong>${changeType}</strong>.</p>
    <ul>
      <li><strong>New plan:</strong> ${planName}</li>
      <li><strong>Period start:</strong> ${toIstDdMmYyyyHm(startDate)}</li>
      <li><strong>Period end:</strong> ${toIstDdMmYyyyHm(endDate)}</li>
    </ul>`
  );
  return { subject, html };
}

export function paymentBillEmail({
  name,
  invoiceNo,
  amount,
  mode,
  status,
  itemsHtml,
  billDate,
  gymName = 'Kovij Fitness Zone',
}) {
  const subject = `Payment receipt ${invoiceNo} — ${gymName}`;
  const html = wrapHtml(
    subject,
    `<h2>Receipt</h2>
    <p>Hi ${name},</p>
    <p><strong>Invoice:</strong> ${invoiceNo}</p>
    ${billDate ? `<p><strong>Date:</strong> ${toIstDdMmYyyyHm(billDate)}</p>` : ``}
    <p><strong>Amount:</strong> ${amount}</p>
    <p><strong>Mode:</strong> ${mode}</p>
    <p><strong>Status:</strong> ${status}</p>
    ${itemsHtml || ''}`
  );
  return { subject, html };
}

export function campaignBodyEmail({ subject, bodyHtml }) {
  return { subject, html: bodyHtml };
}

const TEMPLATES = {
  welcome: welcomeEmail,
  expiryReminder: expiryReminderEmail,
  expired: expiredEmail,
  planUpdated: planUpdatedEmail,
  paymentBill: paymentBillEmail,
  offer: campaignBodyEmail,
  festival: campaignBodyEmail,
  info: campaignBodyEmail,
  bulk: campaignBodyEmail,
};

/**
 * @param {string} key
 * @param {Record<string, unknown>} vars
 */
export function renderTemplate(key, vars) {
  const fn = TEMPLATES[key];
  if (!fn) {
    return campaignBodyEmail({ subject: vars.subject || 'Message', bodyHtml: String(vars.bodyHtml || '') });
  }
  return fn(vars);
}
