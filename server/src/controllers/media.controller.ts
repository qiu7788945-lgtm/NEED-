import type { RequestHandler } from 'express';
import { listLocalImages, toUploadedImage } from '../services/media/media.service.js';
import { fail, success } from '../utils/api-response.js';

export const uploadMedia: RequestHandler = (req, res) => {
  if (!req.file) {
    res.status(400).json(fail('File is required', 'FILE_REQUIRED'));
    return;
  }

  res.json(success(toUploadedImage(req.file)));
};

export const listMedia: RequestHandler = async (_req, res) => {
  const images = await listLocalImages();

  res.json(success(images));
};
