import { Router } from 'express';
import { archiveMedia, deleteMedia, listMedia, restoreMedia, uploadMedia } from '../controllers/media.controller.js';
import { imageUpload } from '../middlewares/upload.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const mediaRouter = Router();

mediaRouter.post('/upload', imageUpload.single('file'), asyncHandler(uploadMedia));
mediaRouter.get('/list', asyncHandler(listMedia));
mediaRouter.patch('/:fileName/archive', asyncHandler(archiveMedia));
mediaRouter.patch('/:fileName/restore', asyncHandler(restoreMedia));
mediaRouter.delete('/:fileName', asyncHandler(deleteMedia));

export { mediaRouter };
