import { Router } from 'express';
import { listMedia, uploadMedia } from '../controllers/media.controller.js';
import { imageUpload } from '../middlewares/upload.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const mediaRouter = Router();

mediaRouter.post('/upload', imageUpload.single('file'), asyncHandler(uploadMedia));
mediaRouter.get('/list', asyncHandler(listMedia));

export { mediaRouter };
