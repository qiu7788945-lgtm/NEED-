import type { Request, Response } from 'express';
import { checkDatabaseHealth } from '../db/health.js';
import { success } from '../utils/api-response.js';

export function getHealth(_req: Request, res: Response) {
  res.json(
    success({
      service: 'need-api',
      time: new Date().toISOString(),
    }),
  );
}

export async function getDatabaseHealth(_req: Request, res: Response) {
  const result = await checkDatabaseHealth();
  res.status(result.ok ? 200 : 503).json(success(result));
}
