import { createHmac, randomBytes } from 'node:crypto';
import { getAuthConfig } from '../../config/auth.js';

const SESSION_TOKEN_BYTES = 32;

export function createSessionToken(): string {
  return randomBytes(SESSION_TOKEN_BYTES).toString('base64url');
}

export function createSessionHash(sessionToken: string): string {
  const authConfig = getAuthConfig();

  return createHmac('sha256', authConfig.sessionSecret).update(sessionToken).digest('hex');
}
