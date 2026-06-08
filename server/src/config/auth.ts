import type { CorsOptions } from 'cors';

export type AuthCookieSameSite = 'lax' | 'strict' | 'none';

export type AuthConfig = {
  sessionSecret: string;
  cookieName: string;
  cookieSecure: boolean;
  cookieSameSite: AuthCookieSameSite;
  sessionTtlSeconds: number;
  allowedOrigins: string[];
  isProduction: boolean;
};

export class AuthConfigError extends Error {
  statusCode = 500;
  code = 'AUTH_CONFIG_INVALID';
}

const DEFAULT_COOKIE_NAME = 'need_admin_session';
const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const DEVELOPMENT_SESSION_SECRET = 'need-local-development-session-secret';
const DEFAULT_DEVELOPMENT_ORIGINS = ['http://localhost:3001', 'http://localhost:3000'];

let cachedAuthConfig: AuthConfig | undefined;
let warnedAboutDevelopmentSecret = false;

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function readBoolean(name: string, defaultValue: boolean): boolean {
  const value = readEnv(name);

  if (!value) {
    return defaultValue;
  }

  const normalizedValue = value.toLowerCase();

  if (['true', '1', 'yes'].includes(normalizedValue)) {
    return true;
  }

  if (['false', '0', 'no'].includes(normalizedValue)) {
    return false;
  }

  throw new AuthConfigError(`${name} must be true or false.`);
}

function readPositiveInteger(name: string, defaultValue: number): number {
  const value = readEnv(name);

  if (!value) {
    return defaultValue;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new AuthConfigError(`${name} must be a positive integer.`);
  }

  return parsedValue;
}

function readCookieSameSite(): AuthCookieSameSite {
  const value = readEnv('ADMIN_COOKIE_SAME_SITE')?.toLowerCase();

  if (!value) {
    return 'lax';
  }

  if (value === 'lax' || value === 'strict' || value === 'none') {
    return value;
  }

  throw new AuthConfigError('ADMIN_COOKIE_SAME_SITE must be lax, strict, or none.');
}

function readAllowedOrigins(isProduction: boolean): string[] {
  const value = readEnv('ADMIN_ALLOWED_ORIGINS');

  if (!value) {
    return isProduction ? [] : DEFAULT_DEVELOPMENT_ORIGINS;
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

function readSessionSecret(isProduction: boolean): string {
  const secret = readEnv('ADMIN_SESSION_SECRET');

  if (secret) {
    return secret;
  }

  if (isProduction) {
    throw new AuthConfigError('ADMIN_SESSION_SECRET is required in production.');
  }

  if (!warnedAboutDevelopmentSecret) {
    console.warn('ADMIN_SESSION_SECRET is not configured. Using a development-only local auth secret.');
    warnedAboutDevelopmentSecret = true;
  }

  return DEVELOPMENT_SESSION_SECRET;
}

export function getAuthConfig(): AuthConfig {
  if (cachedAuthConfig) {
    return cachedAuthConfig;
  }

  const isProduction = (process.env.NODE_ENV ?? 'development') === 'production';
  const cookieSecure = readBoolean('ADMIN_COOKIE_SECURE', isProduction);
  const cookieSameSite = readCookieSameSite();

  if (isProduction && !cookieSecure) {
    throw new AuthConfigError('ADMIN_COOKIE_SECURE must be true in production.');
  }

  if (cookieSameSite === 'none' && !cookieSecure) {
    throw new AuthConfigError('ADMIN_COOKIE_SECURE must be true when ADMIN_COOKIE_SAME_SITE is none.');
  }

  cachedAuthConfig = {
    sessionSecret: readSessionSecret(isProduction),
    cookieName: readEnv('ADMIN_COOKIE_NAME') ?? DEFAULT_COOKIE_NAME,
    cookieSecure,
    cookieSameSite,
    sessionTtlSeconds: readPositiveInteger('ADMIN_SESSION_TTL_SECONDS', DEFAULT_SESSION_TTL_SECONDS),
    allowedOrigins: readAllowedOrigins(isProduction),
    isProduction,
  };

  return cachedAuthConfig;
}

export function createCorsOptions(): CorsOptions {
  const authConfig = getAuthConfig();

  return {
    credentials: true,
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      callback(null, authConfig.allowedOrigins.includes(origin));
    },
  };
}
