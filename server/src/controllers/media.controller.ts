import type { RequestHandler } from 'express';
import { archiveLocalImage, deleteLocalImage, listLocalImages, restoreLocalImage, toUploadedImage } from '../services/media/media.service.js';
import { fail, success } from '../utils/api-response.js';

export const uploadMedia: RequestHandler = async (req, res) => {
  if (!req.file) {
    res.status(400).json(fail('File is required', 'FILE_REQUIRED'));
    return;
  }

  const image = await toUploadedImage(req.file, {
    category: typeof req.body.category === 'string' ? req.body.category : undefined,
    displayName: typeof req.body.displayName === 'string' ? req.body.displayName : undefined,
    storageName: typeof req.body.storageName === 'string' ? req.body.storageName : undefined,
    alt: typeof req.body.alt === 'string' ? req.body.alt : undefined,
    description: typeof req.body.description === 'string' ? req.body.description : undefined,
    ownerType: typeof req.body.ownerType === 'string' ? req.body.ownerType : undefined,
    ownerId: typeof req.body.ownerId === 'string' ? req.body.ownerId : undefined,
    ownerSlug: typeof req.body.ownerSlug === 'string' ? req.body.ownerSlug : undefined,
    groupKey: typeof req.body.groupKey === 'string' ? req.body.groupKey : undefined,
    slotNo: typeof req.body.slotNo === 'string' ? req.body.slotNo : undefined,
    caption: typeof req.body.caption === 'string' ? req.body.caption : undefined,
    enabled: typeof req.body.enabled === 'string' ? req.body.enabled : undefined,
    sortOrder: typeof req.body.sortOrder === 'string' ? req.body.sortOrder : undefined,
  });
  res.json(success(image));
};

export const listMedia: RequestHandler = async (_req, res) => {
  const images = await listLocalImages({
    category: typeof _req.query.category === 'string' ? _req.query.category : undefined,
    keyword: typeof _req.query.keyword === 'string' ? _req.query.keyword : undefined,
    ownerType: typeof _req.query.ownerType === 'string' ? _req.query.ownerType : undefined,
    ownerId: typeof _req.query.ownerId === 'string' ? _req.query.ownerId : undefined,
    ownerSlug: typeof _req.query.ownerSlug === 'string' ? _req.query.ownerSlug : undefined,
    groupKey: typeof _req.query.groupKey === 'string' ? _req.query.groupKey : undefined,
    slotNo: typeof _req.query.slotNo === 'string' ? _req.query.slotNo : undefined,
    enabled: typeof _req.query.enabled === 'string' ? _req.query.enabled : undefined,
    status: typeof _req.query.status === 'string' ? _req.query.status : undefined,
  });

  res.json(success(images));
};

export const archiveMedia: RequestHandler = async (req, res) => {
  const image = await archiveLocalImage(req.params.fileName);
  res.json(success(image, 'Media archived'));
};

export const restoreMedia: RequestHandler = async (req, res) => {
  const image = await restoreLocalImage(req.params.fileName);
  res.json(success(image, 'Media restored'));
};

export const deleteMedia: RequestHandler = async (req, res) => {
  const result = await deleteLocalImage(req.params.fileName);
  res.json(success(result, result.fileMissing ? 'Media index removed; file was already missing' : 'Media permanently deleted'));
};
