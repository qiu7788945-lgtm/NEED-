import { Router } from 'express';
import {
  getHomeVideo,
  getHomeInteractiveImages,
  saveHomeVideo,
  saveHomeInteractiveImages,
} from '../controllers/home.controller.js';
import { asyncHandler } from '../utils/async-handler.js';

const homeRouter = Router();

homeRouter.get('/interactive-images', asyncHandler(getHomeInteractiveImages));
homeRouter.put('/interactive-images', asyncHandler(saveHomeInteractiveImages));
homeRouter.get('/video', asyncHandler(getHomeVideo));
homeRouter.put('/video', asyncHandler(saveHomeVideo));

export { homeRouter };
