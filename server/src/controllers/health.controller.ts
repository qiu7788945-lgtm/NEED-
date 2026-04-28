import type { Request, Response } from 'express';
import { success } from '../utils/api-response.js';

export function getHealth(_req: Request, res: Response) {
  res.json(
    success({
      service: 'need-api',
      time: new Date().toISOString(),
    }),
  );
}
