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
import { asyncHandler } from '../utils/async-handler.js';

const pagesRouter = Router();

pagesRouter.get('/', asyncHandler(listPagesHandler));
pagesRouter.post('/', asyncHandler(createPageHandler));
pagesRouter.post('/reorder', asyncHandler(reorderPagesHandler));
pagesRouter.get('/:id', asyncHandler(getPageHandler));
pagesRouter.put('/:id', asyncHandler(updatePageHandler));
pagesRouter.delete('/:id', asyncHandler(deletePageHandler));
pagesRouter.patch('/:id/status', asyncHandler(updatePageStatusHandler));
pagesRouter.post('/:id/duplicate', asyncHandler(duplicatePageHandler));

export { pagesRouter };
