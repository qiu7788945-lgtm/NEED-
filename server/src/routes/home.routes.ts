import { Router } from 'express';
import {
  getHomeVideo,
  getHomeInteractiveImages,
  saveHomeVideo,
  saveHomeInteractiveImages,
} from '../controllers/home.controller.js';
import { requireAdminAuth } from '../middlewares/auth.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const homeRouter = Router();

homeRouter.get('/interactive-images', asyncHandler(getHomeInteractiveImages));
homeRouter.put('/interactive-images', requireAdminAuth, asyncHandler(saveHomeInteractiveImages));
homeRouter.get('/video', asyncHandler(getHomeVideo));
homeRouter.put('/video', requireAdminAuth, asyncHandler(saveHomeVideo));

export { homeRouter };
