import type { RequestHandler } from 'express';
import { runQualityCheck } from '../services/quality-check/quality-check.service.js';
import { success } from '../utils/api-response.js';

export const getQualityCheckHandler: RequestHandler = async (_req, res) => {
  const result = await runQualityCheck();

  res.json(success(result));
};
