import { Router } from 'express';
import {
  getHomeInteractiveImages,
  saveHomeInteractiveImages,
} from '../controllers/home.controller.js';
import { asyncHandler } from '../utils/async-handler.js';

const homeRouter = Router();

homeRouter.get('/interactive-images', asyncHandler(getHomeInteractiveImages));
homeRouter.put('/interactive-images', asyncHandler(saveHomeInteractiveImages));

export { homeRouter };
