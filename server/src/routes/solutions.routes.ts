import { Router } from 'express';
import {
  addSolutionItemHandler,
  createSolutionGroupHandler,
  deleteSolutionGroupHandler,
  deleteSolutionItemHandler,
  getSolutionSceneHandler,
  listSolutionsHandler,
  reorderSolutionGroupsHandler,
  reorderSolutionItemsHandler,
  updateSolutionGroupHandler,
  updateSolutionItemHandler,
} from '../controllers/solutions.controller.js';
import { requireAdminAuth } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const solutionsRouter = Router();

solutionsRouter.get('/', asyncHandler(listSolutionsHandler));
solutionsRouter.get('/:sceneSlug', asyncHandler(getSolutionSceneHandler));
solutionsRouter.post('/:sceneSlug/groups', requireAdminAuth, asyncHandler(createSolutionGroupHandler));
solutionsRouter.patch('/:sceneSlug/groups/reorder', requireAdminAuth, asyncHandler(reorderSolutionGroupsHandler));
solutionsRouter.patch('/:sceneSlug/groups/:groupId', requireAdminAuth, asyncHandler(updateSolutionGroupHandler));
solutionsRouter.delete('/:sceneSlug/groups/:groupId', requireAdminAuth, asyncHandler(deleteSolutionGroupHandler));
solutionsRouter.post('/:sceneSlug/groups/:groupId/items', requireAdminAuth, asyncHandler(addSolutionItemHandler));
solutionsRouter.patch(
  '/:sceneSlug/groups/:groupId/items/reorder',
  requireAdminAuth,
  asyncHandler(reorderSolutionItemsHandler),
);
solutionsRouter.patch(
  '/:sceneSlug/groups/:groupId/items/:itemId',
  requireAdminAuth,
  asyncHandler(updateSolutionItemHandler),
);
solutionsRouter.delete(
  '/:sceneSlug/groups/:groupId/items/:itemId',
  requireAdminAuth,
  asyncHandler(deleteSolutionItemHandler),
);

export { solutionsRouter };
