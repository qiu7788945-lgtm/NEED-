import type { RequestHandler } from 'express';
import {
  createCase,
  deleteCase,
  getCase,
  importCaseWord,
  listCases,
  reorderCases,
  updateCase,
  updateCaseStatus,
} from '../services/cases/cases.service.js';
import { fail, success } from '../utils/api-response.js';

export const listCasesHandler: RequestHandler = async (req, res) => {
  const cases = await listCases({
    status: typeof req.query.status === 'string' ? req.query.status : undefined,
    keyword: typeof req.query.keyword === 'string' ? req.query.keyword : undefined,
  });

  res.json(success(cases));
};

export const getCaseHandler: RequestHandler = async (req, res) => {
  const item = await getCase(req.params.id);

  res.json(success(item));
};

export const createCaseHandler: RequestHandler = async (req, res) => {
  const item = await createCase(req.body);

  res.json(success(item, 'Case created'));
};

export const updateCaseHandler: RequestHandler = async (req, res) => {
  const item = await updateCase(req.params.id, req.body);

  res.json(success(item, 'Case updated'));
};

export const deleteCaseHandler: RequestHandler = async (req, res) => {
  const result = await deleteCase(req.params.id);

  res.json(success(result, 'Case deleted'));
};

export const updateCaseStatusHandler: RequestHandler = async (req, res) => {
  const item = await updateCaseStatus(req.params.id, req.body?.status);

  res.json(success(item, 'Case status updated'));
};

export const reorderCasesHandler: RequestHandler = async (req, res) => {
  const cases = await reorderCases(req.body?.items);

  res.json(success(cases, 'Cases reordered'));
};

export const importCaseWordHandler: RequestHandler = async (req, res) => {
  if (!req.file) {
    res.status(400).json(fail('请上传 .docx Word 文件。', 'WORD_FILE_REQUIRED'));
    return;
  }

  const item = await importCaseWord(req.file);
  res.json(success(item, 'Case imported from Word'));
};
