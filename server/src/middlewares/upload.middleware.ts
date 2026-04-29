import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const maxFileSize = 10 * 1024 * 1024;
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const imageUploadDir = path.join(serverRoot, 'uploads', 'images');

fs.mkdirSync(imageUploadDir, { recursive: true });

function createUploadError(message: string, code: string) {
  return Object.assign(new Error(message), {
    statusCode: 400,
    code,
  });
}

const storage = multer.diskStorage({
  destination: imageUploadDir,
  filename: (req, file, callback) => {
    const originalName = normalizeOriginalFileName(file.originalname);
    const ext = path.extname(originalName).toLowerCase();
    const rawStorageName = typeof req.body.storageName === 'string' ? req.body.storageName.trim() : '';
    const baseName = rawStorageName || `image-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    if (!/^[A-Za-z0-9_-]+$/.test(baseName)) {
      callback(createUploadError('Storage file name can only contain letters, numbers, hyphens, and underscores', 'INVALID_STORAGE_NAME'), '');
      return;
    }

    const safeName = `${baseName}${ext}`;
    if (fs.existsSync(path.join(imageUploadDir, safeName))) {
      callback(createUploadError('Storage file name already exists', 'STORAGE_NAME_EXISTS'), '');
      return;
    }

    callback(null, safeName);
  },
});

export const imageUpload = multer({
  storage,
  limits: {
    fileSize: maxFileSize,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    const ext = path.extname(normalizeOriginalFileName(file.originalname)).toLowerCase();
    const isAllowedMime = allowedMimeTypes.has(file.mimetype);
    const isAllowedExt = allowedExtensions.has(ext);

    if (!isAllowedMime || !isAllowedExt) {
      callback(createUploadError('Only jpg, jpeg, png, and webp images are allowed', 'INVALID_IMAGE_TYPE'));
      return;
    }

    callback(null, true);
  },
});

export function normalizeOriginalFileName(originalName: string) {
  const decoded = Buffer.from(originalName, 'latin1').toString('utf8');
  return decoded.includes('�') ? originalName : decoded;
}

export { imageUploadDir };
