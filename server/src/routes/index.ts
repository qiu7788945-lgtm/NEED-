import { Router } from 'express';
import { healthRouter } from './health.routes.js';

const apiRouter = Router();

apiRouter.use('/api/health', healthRouter);

export { apiRouter };
