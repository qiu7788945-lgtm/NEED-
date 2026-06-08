import { Router } from 'express';
import {
  archiveMedia,
  batchArchiveMedia,
  batchDeleteMedia,
  batchRestoreMedia,
  deleteMedia,
  listMedia,
  restoreMedia,
  updateMedia,
  uploadMedia,
} from '../controllers/media.controller.js';
import { requireAdminAuth } from '../middlewares/auth.middleware.js';
import { mediaUpload } from '../middlewares/upload.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const mediaRouter = Router();

mediaRouter.post('/upload', requireAdminAuth, mediaUpload.single('file'), asyncHandler(uploadMedia));
mediaRouter.get('/list', asyncHandler(listMedia));
mediaRouter.patch('/batch/archive', requireAdminAuth, asyncHandler(batchArchiveMedia));
mediaRouter.patch('/batch/restore', requireAdminAuth, asyncHandler(batchRestoreMedia));
mediaRouter.delete('/batch', requireAdminAuth, asyncHandler(batchDeleteMedia));
mediaRouter.patch('/:fileName', requireAdminAuth, asyncHandler(updateMedia));
mediaRouter.patch('/:fileName/archive', requireAdminAuth, asyncHandler(archiveMedia));
mediaRouter.patch('/:fileName/restore', requireAdminAuth, asyncHandler(restoreMedia));
mediaRouter.delete('/:fileName', requireAdminAuth, asyncHandler(deleteMedia));

export { mediaRouter };
