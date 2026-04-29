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
import { asyncHandler } from '../utils/async-handler.js';

const articlesRouter = Router();

articlesRouter.get('/', asyncHandler(listArticlesHandler));
articlesRouter.post('/', asyncHandler(createArticleHandler));
articlesRouter.patch('/reorder', asyncHandler(reorderArticlesHandler));
articlesRouter.get('/:id', asyncHandler(getArticleHandler));
articlesRouter.patch('/:id', asyncHandler(updateArticleHandler));
articlesRouter.delete('/:id', asyncHandler(deleteArticleHandler));
articlesRouter.patch('/:id/status', asyncHandler(updateArticleStatusHandler));

export { articlesRouter };
