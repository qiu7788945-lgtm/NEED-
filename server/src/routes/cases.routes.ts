import { Router } from 'express';
import {
  createCaseHandler,
  deleteCaseHandler,
  getCaseHandler,
  importCaseWordHandler,
  listCasesHandler,
  reorderCasesHandler,
  updateCaseHandler,
  updateCaseStatusHandler,
} from '../controllers/cases.controller.js';
import { requireAdminAuth } from '../middlewares/auth.middleware.js';
import { wordUpload } from '../middlewares/word-upload.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const casesRouter = Router();

casesRouter.get('/', asyncHandler(listCasesHandler));
casesRouter.post('/', requireAdminAuth, asyncHandler(createCaseHandler));
casesRouter.patch('/reorder', requireAdminAuth, asyncHandler(reorderCasesHandler));
casesRouter.post('/import-word', requireAdminAuth, wordUpload.single('file'), asyncHandler(importCaseWordHandler));
casesRouter.get('/:id', asyncHandler(getCaseHandler));
casesRouter.patch('/:id', requireAdminAuth, asyncHandler(updateCaseHandler));
casesRouter.delete('/:id', requireAdminAuth, asyncHandler(deleteCaseHandler));
casesRouter.patch('/:id/status', requireAdminAuth, asyncHandler(updateCaseStatusHandler));

export { casesRouter };
