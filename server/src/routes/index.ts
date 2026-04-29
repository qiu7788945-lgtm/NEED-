import { Router } from 'express';
import { healthRouter } from './health.routes.js';
import { homeRouter } from './home.routes.js';
import { mediaRouter } from './media.routes.js';
import { articlesRouter } from './articles.routes.js';

const apiRouter = Router();

apiRouter.use('/api/health', healthRouter);
apiRouter.use('/api/home', homeRouter);
apiRouter.use('/api/media', mediaRouter);
apiRouter.use('/api/articles', articlesRouter);

export { apiRouter };
