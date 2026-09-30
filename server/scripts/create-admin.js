/**
 * Create (or reset) an admin staff account.
 *
 *   npm run create-admin -- --email owner@example.com --name "Gym Owner" [--username owner] [--password ...]
 *
 * Without --password a strong random one is generated and printed once.
 */
import crypto from 'crypto';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';

dotenv.config();

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

const email = arg('email')?.toLowerCase();
const name = arg('name') || 'Owner';
const username = arg('username') || email?.split('@')[0];
const password = arg('password') || crypto.randomBytes(9).toString('base64url');

if (!email) {
  console.error('Usage: npm run create-admin -- --email you@example.com [--name "Your Name"] [--username you] [--password ...]');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

await mongoose.connect(process.env.MONGO_URI);
let user = await User.findOne({ email });
if (user) {
  user.set({ role: 'admin', isActive: true, password, name });
} else {
  user = new User({ email, name, username, password, role: 'admin' });
}
await user.save();
await mongoose.disconnect();

console.log(`Admin ready: ${email}`);
if (!arg('password')) console.log(`Temporary password: ${password}  (change it after signing in)`);
