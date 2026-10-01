/**
 * OWNER: member app content & support module. Email for a reply to a member's support request,
 * in the same layout as the reminder emails. Every value is escaped by those helpers.
 */
import { registerTemplates } from './index.js';
import { appLink, first, layout, oneLine, para, textToHtml } from './engagementEmails.js';

const DEFAULT_GYM = 'Kovij Fitness Zone';

function supportReply({ name, gymName = DEFAULT_GYM, subject, reply, staffName, reference, ticketId, contact }) {
  const heading = `Reply about “${oneLine(subject, 100)}”`;
  const html = layout({
    gymName,
    contact,
    preheader: oneLine(reply, 120),
    eyebrow: `Your request ${reference || ''}`.trim(),
    heading,
    bodyHtml: para(`Hi ${first(name)},`) + textToHtml(reply) + (staffName ? para(`${staffName}, ${gymName}`) : ''),
    cta: { label: 'Open the conversation', url: appLink(ticketId ? `/member/support/${ticketId}` : '/member/support') },
    footerNote: `You get this email because you asked ${gymName} for help in the app. Reply in the app so the whole conversation stays in one place.`,
  });
  return { subject: oneLine(`${gymName}: ${heading}`), html };
}

registerTemplates({ supportReply });
