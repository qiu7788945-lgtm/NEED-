import type { ErrorRequestHandler } from 'express';
import { env } from '../config/env.js';
import { fail } from '../utils/api-response.js';
import { logger } from '../utils/logger.js';

export const errorMiddleware: ErrorRequestHandler = (error, _req, res, _next) => {
  logger.error('Unhandled API error', error);

  const isMulterSizeError = error.name === 'MulterError' && error.code === 'LIMIT_FILE_SIZE';
  const statusCode = isMulterSizeError
    ? 400
    : typeof error.statusCode === 'number'
      ? error.statusCode
      : 500;
  const message = isMulterSizeError
    ? 'Image size must be 10MB or less'
    : statusCode >= 500
      ? 'Internal Server Error'
      : error.message;

  res.status(statusCode).json(
    fail(
      message,
      typeof error.code === 'string' ? error.code : String(statusCode),
      env.isProduction ? undefined : {
        name: error.name,
        message: error.message,
      },
    ),
  );
};
