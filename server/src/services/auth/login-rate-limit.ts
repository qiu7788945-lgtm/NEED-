import type { Request } from 'express';
import type { AuthConfig } from '../../config/auth.js';

const ANONYMOUS_USERNAME_KEY = 'anonymous';

type AttemptCounter = {
  count: number;
  resetAt: number;
};

type LoginRateLimitKeys = {
  ipKey: string;
  ipUsernameKey: string;
};

const loginAttemptCounters = new Map<string, AttemptCounter>();

function sanitizeKeyPart(value: string): string {
  return encodeURIComponent(value);
}

function normalizeUsername(value: unknown): string {
  if (typeof value !== 'string') {
    return ANONYMOUS_USERNAME_KEY;
  }

  const normalizedUsername = value.trim().toLowerCase();

  return normalizedUsername || ANONYMOUS_USERNAME_KEY;
}

function getClientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'unknown';
}

function getLoginRateLimitKeys(req: Request): LoginRateLimitKeys {
  const clientIp = getClientIp(req);
  const normalizedUsername = normalizeUsername((req.body as { username?: unknown } | undefined)?.username);

  return {
    ipKey: `ip:${sanitizeKeyPart(clientIp)}`,
    ipUsernameKey: `ip_user:${sanitizeKeyPart(clientIp)}:${sanitizeKeyPart(normalizedUsername)}`,
  };
}

function incrementCounter(key: string, now: number, windowMs: number): AttemptCounter {
  const counter = loginAttemptCounters.get(key);

  if (!counter || counter.resetAt <= now) {
    const nextCounter = {
      count: 1,
      resetAt: now + windowMs,
    };

    loginAttemptCounters.set(key, nextCounter);

    return nextCounter;
  }

  counter.count += 1;

  return counter;
}

export function isLoginRateLimited(
  req: Request,
  authConfig: AuthConfig,
): boolean {
  const now = Date.now();
  const keys = getLoginRateLimitKeys(req);
  const counters = [
    incrementCounter(keys.ipKey, now, authConfig.loginRateLimitWindowMs),
    incrementCounter(keys.ipUsernameKey, now, authConfig.loginRateLimitWindowMs),
  ];

  return counters.some((counter) => counter.count > authConfig.loginRateLimitMax);
}

export function recordLoginSuccess(req: Request): void {
  const keys = getLoginRateLimitKeys(req);

  loginAttemptCounters.delete(keys.ipUsernameKey);
}
