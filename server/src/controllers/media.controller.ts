import type { RequestHandler } from 'express';
import { listLocalImages, toUploadedImage } from '../services/media/media.service.js';
import { fail, success } from '../utils/api-response.js';

export const uploadMedia: RequestHandler = async (req, res) => {
  if (!req.file) {
    res.status(400).json(fail('File is required', 'FILE_REQUIRED'));
    return;
  }

  const image = await toUploadedImage(req.file, String(req.body.category ?? 'temporary'));
  res.json(success(image));
};

export const listMedia: RequestHandler = async (_req, res) => {
  const images = await listLocalImages({
    category: typeof _req.query.category === 'string' ? _req.query.category : undefined,
    keyword: typeof _req.query.keyword === 'string' ? _req.query.keyword : undefined,
  });

  res.json(success(images));
};
