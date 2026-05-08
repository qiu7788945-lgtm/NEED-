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
import { asyncHandler } from '../utils/async-handler.js';

const scenarioDetailRouter = Router();

scenarioDetailRouter.get('/', asyncHandler(listScenarioDetailPagesHandler));
scenarioDetailRouter.post('/', asyncHandler(createScenarioDetailPageHandler));
scenarioDetailRouter.post('/reorder', asyncHandler(reorderScenarioDetailPagesHandler));
scenarioDetailRouter.get('/:id', asyncHandler(getScenarioDetailPageHandler));
scenarioDetailRouter.put('/:id', asyncHandler(updateScenarioDetailPageHandler));
scenarioDetailRouter.delete('/:id', asyncHandler(deleteScenarioDetailPageHandler));
scenarioDetailRouter.patch('/:id/status', asyncHandler(updateScenarioDetailPageStatusHandler));
scenarioDetailRouter.post('/:id/duplicate', asyncHandler(duplicateScenarioDetailPageHandler));

export { scenarioDetailRouter };
