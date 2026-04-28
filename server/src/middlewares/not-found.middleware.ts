import type { RequestHandler } from 'express';
import { fail } from '../utils/api-response.js';

export const notFoundMiddleware: RequestHandler = (req, res) => {
  res.status(404).json(
    fail(`API route not found: ${req.method} ${req.originalUrl}`, 'NOT_FOUND'),
  );
};
