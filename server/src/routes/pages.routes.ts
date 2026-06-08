import { Router } from 'express';
import {
  createPageHandler,
  deletePageHandler,
  duplicatePageHandler,
  getPageHandler,
  listPagesHandler,
  reorderPagesHandler,
  updatePageHandler,
  updatePageStatusHandler,
} from '../controllers/pages.controller.js';
import { requireAdminAuth } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const pagesRouter = Router();

pagesRouter.get('/', asyncHandler(listPagesHandler));
pagesRouter.post('/', requireAdminAuth, asyncHandler(createPageHandler));
pagesRouter.post('/reorder', requireAdminAuth, asyncHandler(reorderPagesHandler));
pagesRouter.get('/:id', asyncHandler(getPageHandler));
pagesRouter.put('/:id', requireAdminAuth, asyncHandler(updatePageHandler));
pagesRouter.delete('/:id', requireAdminAuth, asyncHandler(deletePageHandler));
pagesRouter.patch('/:id/status', requireAdminAuth, asyncHandler(updatePageStatusHandler));
pagesRouter.post('/:id/duplicate', requireAdminAuth, asyncHandler(duplicatePageHandler));

export { pagesRouter };
