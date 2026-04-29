import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { env } from '../config/env.js';

const imageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const videoMimeTypes = new Set(['video/mp4', 'video/webm']);
const videoExtensions = new Set(['.mp4', '.webm']);
const maxVideoFileSize = env.media.maxVideoSizeMb * 1024 * 1024;
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const imageUploadDir = path.join(serverRoot, 'uploads', 'images');
const videoUploadDir = path.join(serverRoot, 'uploads', 'videos');

fs.mkdirSync(imageUploadDir, { recursive: true });
fs.mkdirSync(videoUploadDir, { recursive: true });

function createUploadError(message: string, code: string) {
  return Object.assign(new Error(message), {
    statusCode: 400,
    code,
  });
}

function getMediaKind(file: Express.Multer.File) {
  const ext = path.extname(normalizeOriginalFileName(file.originalname)).toLowerCase();
  if (imageMimeTypes.has(file.mimetype) && imageExtensions.has(ext)) {
    return 'image';
  }
  if (videoMimeTypes.has(file.mimetype) && videoExtensions.has(ext)) {
    return 'video';
  }
  return '';
}

function getUploadDir(file: Express.Multer.File) {
  return getMediaKind(file) === 'video' ? videoUploadDir : imageUploadDir;
}

function createUniqueFileName(dir: string, baseName: string, ext: string) {
  let candidate = `${baseName}${ext}`;
  let index = 2;

  while (fs.existsSync(path.join(dir, candidate))) {
    candidate = `${baseName}-${index}${ext}`;
    index += 1;
  }

  return candidate;
}

const storage = multer.diskStorage({
  destination: (_req, file, callback) => {
    const kind = getMediaKind(file);
    if (!kind) {
      callback(createUploadError('不支持的文件类型。请上传 jpg、jpeg、png、webp、mp4 或 webm 文件。', 'INVALID_MEDIA_TYPE'), '');
      return;
    }

    callback(null, getUploadDir(file));
  },
  filename: (req, file, callback) => {
    const originalName = normalizeOriginalFileName(file.originalname);
    const ext = path.extname(originalName).toLowerCase();
    const rawStorageName = typeof req.body.storageName === 'string' ? req.body.storageName.trim() : '';
    const prefix = getMediaKind(file) === 'video' ? 'video' : 'image';
    const baseName = rawStorageName || `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    if (!/^[A-Za-z0-9_-]+$/.test(baseName)) {
      callback(createUploadError('存储文件名只能包含英文、数字、短横线和下划线。', 'INVALID_STORAGE_NAME'), '');
      return;
    }

    callback(null, createUniqueFileName(getUploadDir(file), baseName, ext));
  },
});

export const mediaUpload = multer({
  storage,
  limits: {
    fileSize: maxVideoFileSize,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (!getMediaKind(file)) {
      callback(createUploadError('不支持的文件类型。请上传 jpg、jpeg、png、webp、mp4 或 webm 文件。', 'INVALID_MEDIA_TYPE'));
      return;
    }

    callback(null, true);
  },
});

export const imageUpload = mediaUpload;

export function normalizeOriginalFileName(originalName: string) {
  const decoded = Buffer.from(originalName, 'latin1').toString('utf8');
  return decoded.includes('锟?') ? originalName : decoded;
}

export { imageUploadDir, videoUploadDir };
