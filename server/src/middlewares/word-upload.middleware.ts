import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { normalizeOriginalFileName } from './upload.middleware.js';

const maxWordFileSize = 30 * 1024 * 1024;
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const wordUploadDir = path.join(serverRoot, 'uploads', 'documents');

fs.mkdirSync(wordUploadDir, { recursive: true });

function createUploadError(message: string, code: string) {
  return Object.assign(new Error(message), {
    statusCode: 400,
    code,
  });
}

function createUniqueFileName(originalName: string) {
  const baseName = path.basename(originalName, path.extname(originalName))
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || `case-word-${Date.now()}`;
  const ext = '.docx';
  let candidate = `${baseName}${ext}`;
  let index = 2;

  while (fs.existsSync(path.join(wordUploadDir, candidate))) {
    candidate = `${baseName}-${index}${ext}`;
    index += 1;
  }

  return candidate;
}

export const wordUpload = multer({
  storage: multer.diskStorage({
    destination: wordUploadDir,
    filename: (_req, file, callback) => {
      callback(null, createUniqueFileName(normalizeOriginalFileName(file.originalname)));
    },
  }),
  limits: {
    fileSize: maxWordFileSize,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    const originalName = normalizeOriginalFileName(file.originalname);
    const ext = path.extname(originalName).toLowerCase();
    const isDocx = ext === '.docx' && (
      file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      || file.mimetype === 'application/octet-stream'
      || file.mimetype === ''
    );

    if (!isDocx) {
      callback(createUploadError('只支持上传 .docx Word 文件，不支持 .doc 或 PDF。', 'INVALID_WORD_TYPE'));
      return;
    }

    callback(null, true);
  },
});

export { wordUploadDir };
