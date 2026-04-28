import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Express } from 'express';
import type { MediaCategory } from '../../../../shared/types/media.js';
import { imageUploadDir } from '../../middlewares/upload.middleware.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const dataDir = path.join(serverRoot, 'data');
const mediaIndexPath = path.join(dataDir, 'media-library.json');

const mimeTypeByExt: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

const allowedCategories = new Set<MediaCategory>([
  'home_interactive',
  'case_image',
  'article_cover',
  'solution_image',
  'page_editor',
  'word_import',
  'temporary',
  'qrcode',
]);

export interface LocalImageFile {
  fileName: string;
  originalName: string;
  url: string;
  size: number;
  mimeType: string;
  category: MediaCategory;
  alt: string;
  description: string;
  createdAt?: string;
}

export interface MediaListFilters {
  category?: string;
  keyword?: string;
}

type MediaIndex = Record<string, {
  originalName?: string;
  category?: MediaCategory;
  alt?: string;
  description?: string;
  createdAt?: string;
}>;

function toImageUrl(fileName: string) {
  return `/uploads/images/${encodeURIComponent(fileName)}`;
}

function normalizeCategory(category?: string): MediaCategory {
  if (category && allowedCategories.has(category as MediaCategory)) {
    return category as MediaCategory;
  }

  return 'temporary';
}

async function readMediaIndex(): Promise<MediaIndex> {
  await fs.mkdir(dataDir, { recursive: true });

  try {
    return JSON.parse(await fs.readFile(mediaIndexPath, 'utf8')) as MediaIndex;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }

    throw error;
  }
}

async function writeMediaIndex(index: MediaIndex) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(mediaIndexPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
}

export async function toUploadedImage(file: Express.Multer.File, category?: string): Promise<LocalImageFile> {
  const index = await readMediaIndex();
  const normalizedCategory = normalizeCategory(category);
  const createdAt = new Date().toISOString();

  index[file.filename] = {
    originalName: file.originalname,
    category: normalizedCategory,
    alt: '',
    description: '',
    createdAt,
  };

  await writeMediaIndex(index);

  return {
    fileName: file.filename,
    originalName: file.originalname,
    url: toImageUrl(file.filename),
    size: file.size,
    mimeType: file.mimetype,
    category: normalizedCategory,
    alt: '',
    description: '',
    createdAt,
  };
}

export async function listLocalImages(filters: MediaListFilters = {}): Promise<LocalImageFile[]> {
  await fs.mkdir(imageUploadDir, { recursive: true });

  const index = await readMediaIndex();
  const keyword = filters.keyword?.trim().toLowerCase();
  const category = filters.category?.trim();
  const entries = await fs.readdir(imageUploadDir, { withFileTypes: true });
  const images = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .filter((entry) => mimeTypeByExt[path.extname(entry.name).toLowerCase()])
      .map(async (entry) => {
        const stats = await fs.stat(path.join(imageUploadDir, entry.name));
        const ext = path.extname(entry.name).toLowerCase();
        const meta = index[entry.name] ?? {};

        return {
          fileName: entry.name,
          originalName: meta.originalName ?? entry.name,
          url: toImageUrl(entry.name),
          size: stats.size,
          mimeType: mimeTypeByExt[ext],
          category: normalizeCategory(meta.category),
          alt: meta.alt ?? '',
          description: meta.description ?? '',
          createdAt: meta.createdAt ?? stats.birthtime.toISOString(),
        };
      }),
  );

  return images
    .filter((image) => !category || image.category === category)
    .filter((image) => {
      if (!keyword) {
        return true;
      }

      return [
        image.fileName,
        image.originalName,
        image.alt,
        image.description,
      ].some((value) => value.toLowerCase().includes(keyword));
    })
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}
