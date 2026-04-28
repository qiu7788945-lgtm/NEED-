import { Router } from 'express';
import { healthRouter } from './health.routes.js';
import { mediaRouter } from './media.routes.js';

const apiRouter = Router();

apiRouter.use('/api/health', healthRouter);
apiRouter.use('/api/media', mediaRouter);

export { apiRouter };
