import type { RequestHandler } from 'express';
import {
  createPage,
  deletePage,
  duplicatePage,
  getPage,
  listPages,
  reorderPages,
  updatePage,
  updatePageStatus,
} from '../services/pages/pages.service.js';
import { success } from '../utils/api-response.js';

export const listPagesHandler: RequestHandler = async (req, res) => {
  const pages = await listPages({
    pageType: typeof req.query.pageType === 'string' ? req.query.pageType : undefined,
    status: typeof req.query.status === 'string' ? req.query.status : undefined,
    keyword: typeof req.query.keyword === 'string' ? req.query.keyword : undefined,
  });

  res.json(success(pages));
};

export const getPageHandler: RequestHandler = async (req, res) => {
  const page = await getPage(req.params.id);

  res.json(success(page));
};

export const createPageHandler: RequestHandler = async (req, res) => {
  const page = await createPage(req.body);

  res.json(success(page, 'Page created'));
};

export const updatePageHandler: RequestHandler = async (req, res) => {
  const page = await updatePage(req.params.id, req.body);

  res.json(success(page, 'Page updated'));
};

export const deletePageHandler: RequestHandler = async (req, res) => {
  const result = await deletePage(req.params.id);

  res.json(success(result, 'Page deleted'));
};

export const updatePageStatusHandler: RequestHandler = async (req, res) => {
  const page = await updatePageStatus(req.params.id, req.body?.status);

  res.json(success(page, 'Page status updated'));
};

export const duplicatePageHandler: RequestHandler = async (req, res) => {
  const page = await duplicatePage(req.params.id);

  res.json(success(page, 'Page duplicated'));
};

export const reorderPagesHandler: RequestHandler = async (req, res) => {
  const pages = await reorderPages(req.body?.items);

  res.json(success(pages, 'Pages reordered'));
};
