import type { RequestHandler } from 'express';
import {
  getLatestPublishLog,
  getPublishLogById,
  listPublishLogs,
  triggerPrerenderPublish,
} from '../services/publish/publish.service.js';
import { success } from '../utils/api-response.js';

export const listPublishLogsHandler: RequestHandler = async (_req, res) => {
  const logs = await listPublishLogs();

  res.json(success({ logs }));
};

export const getLatestPublishLogHandler: RequestHandler = async (_req, res) => {
  const log = await getLatestPublishLog();

  res.json(success({ log }));
};

export const getPublishLogHandler: RequestHandler = async (req, res) => {
  const log = await getPublishLogById(req.params.id);

  res.json(success({ log }));
};

export const triggerPrerenderPublishHandler: RequestHandler = async (_req, res) => {
  const result = await triggerPrerenderPublish();

  res.json(success(result, 'Publish prerender finished'));
};
