import type { RequestHandler } from 'express';
import {
  readHomeInteractiveImages,
  writeHomeInteractiveImages,
} from '../services/home/home-interactive-images.service.js';
import { success } from '../utils/api-response.js';

export const getHomeInteractiveImages: RequestHandler = async (_req, res) => {
  const slots = await readHomeInteractiveImages();

  res.json(success(slots));
};

export const saveHomeInteractiveImages: RequestHandler = async (req, res) => {
  const slots = await writeHomeInteractiveImages(req.body);

  res.json(success(slots));
};
