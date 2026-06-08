import type { Request, Response } from 'express';
import type { AuthConfig, AuthCookieSameSite } from '../config/auth.js';

type CookieOptions = {
  httpOnly?: boolean;
  maxAgeSeconds: number;
  path?: string;
  sameSite: AuthCookieSameSite;
  secure: boolean;
};

const sameSiteHeaderValue: Record<AuthCookieSameSite, string> = {
  lax: 'Lax',
  strict: 'Strict',
  none: 'None',
};

function decodeCookieValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function serializeCookie(name: string, value: string, options: CookieOptions): string {
  const cookieParts = [
    `${name}=${encodeURIComponent(value)}`,
    `Max-Age=${Math.max(0, Math.floor(options.maxAgeSeconds))}`,
    `Path=${options.path ?? '/'}`,
    `SameSite=${sameSiteHeaderValue[options.sameSite]}`,
  ];

  if (options.httpOnly) {
    cookieParts.push('HttpOnly');
  }

  if (options.secure) {
    cookieParts.push('Secure');
  }

  if (options.maxAgeSeconds === 0) {
    cookieParts.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  }

  return cookieParts.join('; ');
}

export function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  return cookieHeader.split(';').reduce<Record<string, string>>((cookies, cookiePart) => {
    const separatorIndex = cookiePart.indexOf('=');

    if (separatorIndex < 0) {
      return cookies;
    }

    const name = cookiePart.slice(0, separatorIndex).trim();
    const value = cookiePart.slice(separatorIndex + 1).trim();

    if (!name) {
      return cookies;
    }

    cookies[name] = decodeCookieValue(value);

    return cookies;
  }, {});
}

export function readCookie(req: Request, name: string): string | undefined {
  return parseCookieHeader(req.headers.cookie)[name];
}

export function setSessionCookie(res: Response, authConfig: AuthConfig, sessionToken: string): void {
  res.setHeader(
    'Set-Cookie',
    serializeCookie(authConfig.cookieName, sessionToken, {
      httpOnly: true,
      maxAgeSeconds: authConfig.sessionTtlSeconds,
      path: '/',
      sameSite: authConfig.cookieSameSite,
      secure: authConfig.cookieSecure,
    }),
  );
}

export function clearSessionCookie(res: Response, authConfig: AuthConfig): void {
  res.setHeader(
    'Set-Cookie',
    serializeCookie(authConfig.cookieName, '', {
      httpOnly: true,
      maxAgeSeconds: 0,
      path: '/',
      sameSite: authConfig.cookieSameSite,
      secure: authConfig.cookieSecure,
    }),
  );
}
