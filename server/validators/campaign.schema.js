import { z } from 'zod';

export const createCampaignSchema = z.object({
  title: z.string().min(1),
  type: z.enum(['offer', 'festival', 'info', 'bulk']),
  subject: z.string().min(1),
  bodyHtml: z.string().min(1),
  audienceFilter: z.enum(['all', 'activeMembers', 'expired', 'noMembership']),
  scheduledAt: z.coerce.date().optional(),
});

export const sendCampaignSchema = z.object({
  // no body required
});

export const testCampaignSchema = z.object({
  to: z.string().email(),
});
