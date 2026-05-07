import { Router } from 'express';
import { healthRouter } from './health.routes.js';
import { homeRouter } from './home.routes.js';
import { mediaRouter } from './media.routes.js';
import { articlesRouter } from './articles.routes.js';
import { casesRouter } from './cases.routes.js';
import { qualityCheckRouter } from './quality-check.routes.js';
import { solutionsRouter } from './solutions.routes.js';
import { publishRouter } from './publish.routes.js';

const apiRouter = Router();

apiRouter.use('/api/health', healthRouter);
apiRouter.use('/api/home', homeRouter);
apiRouter.use('/api/media', mediaRouter);
apiRouter.use('/api/articles', articlesRouter);
apiRouter.use('/api/cases', casesRouter);
apiRouter.use('/api/solutions', solutionsRouter);
apiRouter.use('/api/quality-check', qualityCheckRouter);
apiRouter.use('/api/publish', publishRouter);

export { apiRouter };
