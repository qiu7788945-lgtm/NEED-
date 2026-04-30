import type { RequestHandler } from 'express';
import {
  addSolutionItem,
  createSolutionGroup,
  deleteSolutionGroup,
  deleteSolutionItem,
  getSolutionScene,
  listSolutions,
  reorderSolutionGroups,
  reorderSolutionItems,
  updateSolutionGroup,
  updateSolutionItem,
} from '../services/solutions/solutions.service.js';
import { success } from '../utils/api-response.js';

export const listSolutionsHandler: RequestHandler = async (_req, res) => {
  res.json(success(await listSolutions()));
};

export const getSolutionSceneHandler: RequestHandler = async (req, res) => {
  res.json(success(await getSolutionScene(req.params.sceneSlug)));
};

export const createSolutionGroupHandler: RequestHandler = async (req, res) => {
  res.json(success(await createSolutionGroup(req.params.sceneSlug, req.body), 'Solution group created'));
};

export const updateSolutionGroupHandler: RequestHandler = async (req, res) => {
  res.json(success(await updateSolutionGroup(req.params.sceneSlug, req.params.groupId, req.body), 'Solution group updated'));
};

export const deleteSolutionGroupHandler: RequestHandler = async (req, res) => {
  res.json(success(await deleteSolutionGroup(req.params.sceneSlug, req.params.groupId), 'Solution group deleted'));
};

export const reorderSolutionGroupsHandler: RequestHandler = async (req, res) => {
  res.json(success(await reorderSolutionGroups(req.params.sceneSlug, req.body?.items), 'Solution groups reordered'));
};

export const addSolutionItemHandler: RequestHandler = async (req, res) => {
  res.json(success(await addSolutionItem(req.params.sceneSlug, req.params.groupId, req.body), 'Solution item added'));
};

export const updateSolutionItemHandler: RequestHandler = async (req, res) => {
  res.json(success(await updateSolutionItem(req.params.sceneSlug, req.params.groupId, req.params.itemId, req.body), 'Solution item updated'));
};

export const deleteSolutionItemHandler: RequestHandler = async (req, res) => {
  res.json(success(await deleteSolutionItem(req.params.sceneSlug, req.params.groupId, req.params.itemId), 'Solution item deleted'));
};

export const reorderSolutionItemsHandler: RequestHandler = async (req, res) => {
  res.json(success(await reorderSolutionItems(req.params.sceneSlug, req.params.groupId, req.body?.items), 'Solution items reordered'));
};
