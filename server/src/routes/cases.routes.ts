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
import { wordUpload } from '../middlewares/word-upload.middleware.js';
import { asyncHandler } from '../utils/async-handler.js';

const casesRouter = Router();

casesRouter.get('/', asyncHandler(listCasesHandler));
casesRouter.post('/', asyncHandler(createCaseHandler));
casesRouter.patch('/reorder', asyncHandler(reorderCasesHandler));
casesRouter.post('/import-word', wordUpload.single('file'), asyncHandler(importCaseWordHandler));
casesRouter.get('/:id', asyncHandler(getCaseHandler));
casesRouter.patch('/:id', asyncHandler(updateCaseHandler));
casesRouter.delete('/:id', asyncHandler(deleteCaseHandler));
casesRouter.patch('/:id/status', asyncHandler(updateCaseStatusHandler));

export { casesRouter };
