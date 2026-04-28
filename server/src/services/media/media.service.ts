import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Express } from 'express';
import { imageUploadDir } from '../../middlewares/upload.middleware.js';

const mimeTypeByExt: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export interface LocalImageFile {
  fileName: string;
  originalName?: string;
  url: string;
  size: number;
  mimeType: string;
  createdAt?: string;
}

function toImageUrl(fileName: string) {
  return `/uploads/images/${encodeURIComponent(fileName)}`;
}

export function toUploadedImage(file: Express.Multer.File): LocalImageFile {
  return {
    fileName: file.filename,
    originalName: file.originalname,
    url: toImageUrl(file.filename),
    size: file.size,
    mimeType: file.mimetype,
  };
}

export async function listLocalImages(): Promise<LocalImageFile[]> {
  await fs.mkdir(imageUploadDir, { recursive: true });

  const entries = await fs.readdir(imageUploadDir, { withFileTypes: true });
  const images = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .filter((entry) => mimeTypeByExt[path.extname(entry.name).toLowerCase()])
      .map(async (entry) => {
        const stats = await fs.stat(path.join(imageUploadDir, entry.name));
        const ext = path.extname(entry.name).toLowerCase();

        return {
          fileName: entry.name,
          url: toImageUrl(entry.name),
          size: stats.size,
          mimeType: mimeTypeByExt[ext],
          createdAt: stats.birthtime.toISOString(),
        };
      }),
  );

  return images.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}
