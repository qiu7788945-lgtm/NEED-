import type { NextFunction, Request, Response } from 'express';
import { getAuthConfig } from '../config/auth.js';
import {
  validateAdminSessionToken,
  type AdminSessionUser,
} from '../services/auth/auth.service.js';
import { fail } from '../utils/api-response.js';
import { readCookie } from '../utils/cookies.js';

export type AdminRequestUser = AdminSessionUser;

export async function requireAdminAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authConfig = getAuthConfig();
    const sessionToken = readCookie(req, authConfig.cookieName);
    const validationResult = await validateAdminSessionToken(sessionToken);

    if (validationResult.status === 'unauthorized') {
      res.status(401).json(fail('Authentication required.', 'UNAUTHORIZED'));
      return;
    }

    if (validationResult.status === 'forbidden') {
      res.status(403).json(fail('Forbidden.', 'FORBIDDEN'));
      return;
    }

    req.adminUser = validationResult.user;
    next();
  } catch (error) {
    next(error);
  }
}
