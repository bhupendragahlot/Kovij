/**
 * Print a new VAPID key pair for web push notifications.
 *
 *   node server/scripts/generate-vapid-keys.js
 *
 * Put the three lines in the server environment (Render → Environment, or .env) and restart.
 * Generate keys once and keep them: changing them invalidates every member's push subscription,
 * so members would have to turn notifications on again in the app.
 */
import webpush from 'web-push';

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log(`# Web push keys for Kovij (keep VAPID_PRIVATE_KEY secret)
VAPID_PUBLIC_KEY=${publicKey}
VAPID_PRIVATE_KEY=${privateKey}
# A contact the push services can reach: your gym's email (mailto:) or website (https://)
VAPID_SUBJECT=mailto:owner@your-gym.example`);
