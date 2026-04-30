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
import { asyncHandler } from '../utils/async-handler.js';

const solutionsRouter = Router();

solutionsRouter.get('/', asyncHandler(listSolutionsHandler));
solutionsRouter.get('/:sceneSlug', asyncHandler(getSolutionSceneHandler));
solutionsRouter.post('/:sceneSlug/groups', asyncHandler(createSolutionGroupHandler));
solutionsRouter.patch('/:sceneSlug/groups/reorder', asyncHandler(reorderSolutionGroupsHandler));
solutionsRouter.patch('/:sceneSlug/groups/:groupId', asyncHandler(updateSolutionGroupHandler));
solutionsRouter.delete('/:sceneSlug/groups/:groupId', asyncHandler(deleteSolutionGroupHandler));
solutionsRouter.post('/:sceneSlug/groups/:groupId/items', asyncHandler(addSolutionItemHandler));
solutionsRouter.patch('/:sceneSlug/groups/:groupId/items/reorder', asyncHandler(reorderSolutionItemsHandler));
solutionsRouter.patch('/:sceneSlug/groups/:groupId/items/:itemId', asyncHandler(updateSolutionItemHandler));
solutionsRouter.delete('/:sceneSlug/groups/:groupId/items/:itemId', asyncHandler(deleteSolutionItemHandler));

export { solutionsRouter };
