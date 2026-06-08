import { Router } from 'express';
import {
  createScenarioDetailPageHandler,
  deleteScenarioDetailPageHandler,
  duplicateScenarioDetailPageHandler,
  getScenarioDetailPageHandler,
  listScenarioDetailPagesHandler,
  reorderScenarioDetailPagesHandler,
  updateScenarioDetailPageHandler,
  updateScenarioDetailPageStatusHandler,
} from '../controllers/scenario-detail.controller.js';
import { requireAdminAuth } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const scenarioDetailRouter = Router();

scenarioDetailRouter.get('/', asyncHandler(listScenarioDetailPagesHandler));
scenarioDetailRouter.post('/', requireAdminAuth, asyncHandler(createScenarioDetailPageHandler));
scenarioDetailRouter.post('/reorder', requireAdminAuth, asyncHandler(reorderScenarioDetailPagesHandler));
scenarioDetailRouter.get('/:id', asyncHandler(getScenarioDetailPageHandler));
scenarioDetailRouter.put('/:id', requireAdminAuth, asyncHandler(updateScenarioDetailPageHandler));
scenarioDetailRouter.delete('/:id', requireAdminAuth, asyncHandler(deleteScenarioDetailPageHandler));
scenarioDetailRouter.patch('/:id/status', requireAdminAuth, asyncHandler(updateScenarioDetailPageStatusHandler));
scenarioDetailRouter.post('/:id/duplicate', requireAdminAuth, asyncHandler(duplicateScenarioDetailPageHandler));

export { scenarioDetailRouter };
