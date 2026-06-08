import { Router } from 'express';
import {
  createArticleHandler,
  deleteArticleHandler,
  getArticleHandler,
  listArticlesHandler,
  reorderArticlesHandler,
  updateArticleHandler,
  updateArticleStatusHandler,
} from '../controllers/articles.controller.js';
import { requireAdminAuth } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const articlesRouter = Router();

articlesRouter.get('/', asyncHandler(listArticlesHandler));
articlesRouter.post('/', requireAdminAuth, asyncHandler(createArticleHandler));
articlesRouter.patch('/reorder', requireAdminAuth, asyncHandler(reorderArticlesHandler));
articlesRouter.get('/:id', asyncHandler(getArticleHandler));
articlesRouter.patch('/:id', requireAdminAuth, asyncHandler(updateArticleHandler));
articlesRouter.delete('/:id', requireAdminAuth, asyncHandler(deleteArticleHandler));
articlesRouter.patch('/:id/status', requireAdminAuth, asyncHandler(updateArticleStatusHandler));

export { articlesRouter };
