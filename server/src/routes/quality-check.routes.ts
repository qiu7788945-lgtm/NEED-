import { Router } from 'express';
import { getQualityCheckHandler } from '../controllers/quality-check.controller.js';
import { asyncHandler } from '../utils/async-handler.js';

const qualityCheckRouter = Router();

qualityCheckRouter.get('/', asyncHandler(getQualityCheckHandler));

export { qualityCheckRouter };
