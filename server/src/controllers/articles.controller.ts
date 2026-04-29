import type { RequestHandler } from 'express';
import {
  createArticle,
  deleteArticle,
  getArticle,
  listArticles,
  reorderArticles,
  updateArticle,
  updateArticleStatus,
} from '../services/articles/articles.service.js';
import { success } from '../utils/api-response.js';

export const listArticlesHandler: RequestHandler = async (req, res) => {
  const articles = await listArticles({
    category: typeof req.query.category === 'string' ? req.query.category : undefined,
    status: typeof req.query.status === 'string' ? req.query.status : undefined,
    keyword: typeof req.query.keyword === 'string' ? req.query.keyword : undefined,
  });

  res.json(success(articles));
};

export const getArticleHandler: RequestHandler = async (req, res) => {
  const article = await getArticle(req.params.id);

  res.json(success(article));
};

export const createArticleHandler: RequestHandler = async (req, res) => {
  const article = await createArticle(req.body);

  res.json(success(article, 'Article created'));
};

export const updateArticleHandler: RequestHandler = async (req, res) => {
  const article = await updateArticle(req.params.id, req.body);

  res.json(success(article, 'Article updated'));
};

export const deleteArticleHandler: RequestHandler = async (req, res) => {
  const result = await deleteArticle(req.params.id);

  res.json(success(result, 'Article deleted'));
};

export const updateArticleStatusHandler: RequestHandler = async (req, res) => {
  const article = await updateArticleStatus(req.params.id, req.body?.status);

  res.json(success(article, 'Article status updated'));
};

export const reorderArticlesHandler: RequestHandler = async (req, res) => {
  const articles = await reorderArticles(req.body?.items);

  res.json(success(articles, 'Articles reordered'));
};
