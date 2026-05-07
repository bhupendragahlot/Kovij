import { z } from 'zod';

export const googleAuthSchema = z.object({
  idToken: z.string().min(10, 'idToken is required'),
});
