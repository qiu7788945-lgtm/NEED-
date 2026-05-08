import type { RequestHandler } from 'express';
import {
  createScenarioDetailPage,
  deleteScenarioDetailPage,
  duplicateScenarioDetailPage,
  getScenarioDetailPageById,
  listScenarioDetailPages,
  reorderScenarioDetailPages,
  updateScenarioDetailPage,
  updateScenarioDetailPageStatus,
} from '../services/scenario-detail/scenario-detail.service.js';
import { success } from '../utils/api-response.js';

export const listScenarioDetailPagesHandler: RequestHandler = async (req, res) => {
  const pages = await listScenarioDetailPages({
    pageType: typeof req.query.pageType === 'string' ? req.query.pageType : undefined,
    status: typeof req.query.status === 'string' ? req.query.status : undefined,
    keyword: typeof req.query.keyword === 'string' ? req.query.keyword : undefined,
  });

  res.json(success(pages));
};

export const getScenarioDetailPageHandler: RequestHandler = async (req, res) => {
  const page = await getScenarioDetailPageById(req.params.id);

  res.json(success(page));
};

export const createScenarioDetailPageHandler: RequestHandler = async (req, res) => {
  const page = await createScenarioDetailPage(req.body);

  res.json(success(page, 'Scenario detail page created'));
};

export const updateScenarioDetailPageHandler: RequestHandler = async (req, res) => {
  const page = await updateScenarioDetailPage(req.params.id, req.body);

  res.json(success(page, 'Scenario detail page updated'));
};

export const updateScenarioDetailPageStatusHandler: RequestHandler = async (req, res) => {
  const page = await updateScenarioDetailPageStatus(req.params.id, req.body?.status);

  res.json(success(page, 'Scenario detail page status updated'));
};

export const deleteScenarioDetailPageHandler: RequestHandler = async (req, res) => {
  const result = await deleteScenarioDetailPage(req.params.id);

  res.json(success(result, 'Scenario detail page deleted'));
};

export const duplicateScenarioDetailPageHandler: RequestHandler = async (req, res) => {
  const page = await duplicateScenarioDetailPage(req.params.id);

  res.json(success(page, 'Scenario detail page duplicated'));
};

export const reorderScenarioDetailPagesHandler: RequestHandler = async (req, res) => {
  const pages = await reorderScenarioDetailPages(req.body?.items);

  res.json(success(pages, 'Scenario detail pages reordered'));
};
