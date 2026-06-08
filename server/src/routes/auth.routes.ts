import { Router, type Response } from 'express';
import { getAuthConfig } from '../config/auth.js';
import {
  getCurrentAdmin,
  isAuthServiceError,
  loginAdmin,
  logoutAdmin,
} from '../services/auth/auth.service.js';
import { asyncHandler } from '../utils/async-handler.js';
import { fail, success } from '../utils/api-response.js';
import { clearSessionCookie, readCookie, setSessionCookie } from '../utils/cookies.js';

const authRouter = Router();

function sendAuthError(error: unknown, res: Response): boolean {
  if (!isAuthServiceError(error)) {
    return false;
  }

  res.status(error.statusCode).json(fail(error.message, error.code));

  return true;
}

authRouter.post('/login', asyncHandler(async (req, res) => {
  try {
    const loginResult = await loginAdmin(req.body);

    setSessionCookie(res, getAuthConfig(), loginResult.sessionToken);
    res.json(success({ user: loginResult.user }));
  } catch (error) {
    if (!sendAuthError(error, res)) {
      throw error;
    }
  }
}));

authRouter.post('/logout', asyncHandler(async (req, res) => {
  try {
    const authConfig = getAuthConfig();
    const sessionToken = readCookie(req, authConfig.cookieName);

    await logoutAdmin(sessionToken);
    clearSessionCookie(res, authConfig);
    res.json(success(null));
  } catch (error) {
    if (!sendAuthError(error, res)) {
      throw error;
    }
  }
}));

authRouter.get('/me', asyncHandler(async (req, res) => {
  try {
    const authConfig = getAuthConfig();
    const sessionToken = readCookie(req, authConfig.cookieName);
    const user = await getCurrentAdmin(sessionToken);

    res.json(success({ user }));
  } catch (error) {
    if (!sendAuthError(error, res)) {
      throw error;
    }
  }
}));

export { authRouter };
