import { Router } from 'express';
import {
  getLatestPublishLogHandler,
  getPublishLogHandler,
  listPublishLogsHandler,
  triggerPrerenderPublishHandler,
} from '../controllers/publish.controller.js';
import { asyncHandler } from '../utils/async-handler.js';

const publishRouter = Router();

publishRouter.post('/prerender', asyncHandler(triggerPrerenderPublishHandler));
publishRouter.get('/logs', asyncHandler(listPublishLogsHandler));
publishRouter.get('/latest', asyncHandler(getLatestPublishLogHandler));
publishRouter.get('/logs/:id', asyncHandler(getPublishLogHandler));

export { publishRouter };
