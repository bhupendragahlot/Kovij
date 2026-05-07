import admin from 'firebase-admin';
import { logger } from '../utils/logger.js';

let initialized = false;

/**
 * Build service account from flat .env keys (common when not using JSON file).
 * Fixes escaped newlines in private_key.
 */
function buildServiceAccountFromEnv() {
  const privateKey = process.env.private_key
    ? process.env.private_key.replace(/\\n/g, '\n')
    : undefined;

  if (!privateKey || !process.env.client_email || !process.env.project_id) {
    return null;
  }

  return {
    type: process.env.type || 'service_account',
    project_id: process.env.project_id,
    private_key_id: process.env.private_key_id,
    private_key: privateKey,
    client_email: process.env.client_email,
    client_id: process.env.client_id,
    auth_uri: process.env.auth_uri,
    token_uri: process.env.token_uri,
    auth_provider_x509_cert_url: process.env.auth_provider_x509_cert_url,
    client_x509_cert_url: process.env.client_x509_cert_url,
    universe_domain: process.env.universe_domain || 'googleapis.com',
  };
}

function initFirebaseAdmin() {
  if (initialized) return admin;

  try {
    if (admin.apps.length > 0) {
      initialized = true;
      return admin;
    }

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
    } else {
      const credJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      if (credJson) {
        const parsed = JSON.parse(credJson);
        if (parsed.private_key && typeof parsed.private_key === 'string') {
          parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
        }
        admin.initializeApp({
          credential: admin.credential.cert(parsed),
        });
      } else {
        const sa = buildServiceAccountFromEnv();
        if (!sa?.private_key || !sa?.client_email) {
          logger.warn(
            'Firebase Admin: no GOOGLE_APPLICATION_CREDENTIALS, FIREBASE_SERVICE_ACCOUNT_JSON, or flat service account env vars — Google auth will fail until configured.'
          );
          return admin;
        }
        admin.initializeApp({
          credential: admin.credential.cert(sa),
        });
      }
    }
    initialized = true;
    logger.info('Firebase Admin initialized');
  } catch (e) {
    logger.error('Firebase Admin init error', e);
    throw e;
  }
  return admin;
}

/** @returns {import('firebase-admin')} */
export function getAdmin() {
  if (!initialized && admin.apps.length === 0) {
    initFirebaseAdmin();
  }
  return admin;
}

/**
 * @param {string} idToken
 * @param {boolean} [checkRevoked=true]
 */
export async function verifyFirebaseIdToken(idToken, checkRevoked = true) {
  getAdmin();
  if (admin.apps.length === 0) {
    throw new Error('Firebase Admin not initialized');
  }
  return admin.auth().verifyIdToken(idToken, checkRevoked);
}
