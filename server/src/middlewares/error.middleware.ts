import type { ErrorRequestHandler } from 'express';
import { env } from '../config/env.js';
import { fail } from '../utils/api-response.js';
import { logger } from '../utils/logger.js';

export const errorMiddleware: ErrorRequestHandler = (error, _req, res, _next) => {
  logger.error('Unhandled API error', error);

  const statusCode = typeof error.statusCode === 'number' ? error.statusCode : 500;
  const message = statusCode >= 500 ? 'Internal Server Error' : error.message;

  res.status(statusCode).json(
    fail(message, String(statusCode), env.isProduction ? undefined : {
      name: error.name,
      message: error.message,
    }),
  );
};
