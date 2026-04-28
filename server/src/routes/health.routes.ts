import { Router } from 'express';

const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'need-api',
    time: new Date().toISOString(),
  });
});

export { healthRouter };
