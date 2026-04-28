import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Express } from 'express';
import type { MediaCategory, MediaOwnerType } from '../../../../shared/types/media.js';
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
  'home_video',
  'case_image',
  'article_cover',
  'solution_image',
  'solution_video',
  'page_editor',
  'word_import',
  'qrcode',
  'temporary',
]);

const allowedOwnerTypes = new Set<MediaOwnerType>([
  'home',
  'case',
  'article',
  'solution',
  'page',
  'word_import',
  'system',
  'temporary',
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
  ownerType: MediaOwnerType | '';
  ownerId: number | null;
  ownerSlug: string;
  groupKey: string;
  slotNo: number | null;
  caption: string;
  enabled: boolean;
  sortOrder: number;
  createdAt?: string;
}

export interface MediaListFilters {
  category?: string;
  keyword?: string;
  ownerType?: string;
  ownerId?: string;
  ownerSlug?: string;
  groupKey?: string;
  slotNo?: string;
  enabled?: string;
}

export interface MediaUploadMetadata {
  category?: string;
  alt?: string;
  description?: string;
  ownerType?: string;
  ownerId?: string;
  ownerSlug?: string;
  groupKey?: string;
  slotNo?: string;
  caption?: string;
  enabled?: string;
  sortOrder?: string;
}

type MediaIndexEntry = {
  originalName?: string;
  category?: MediaCategory;
  alt?: string;
  description?: string;
  ownerType?: MediaOwnerType | '';
  ownerId?: number | null;
  ownerSlug?: string;
  groupKey?: string;
  slotNo?: number | null;
  caption?: string;
  enabled?: boolean;
  sortOrder?: number;
  createdAt?: string;
};

type MediaIndex = Record<string, MediaIndexEntry>;

function toImageUrl(fileName: string) {
  return `/uploads/images/${encodeURIComponent(fileName)}`;
}

function normalizeCategory(category?: string): MediaCategory {
  if (category && allowedCategories.has(category as MediaCategory)) {
    return category as MediaCategory;
  }

  return 'temporary';
}

function normalizeOwnerType(ownerType?: string): MediaOwnerType | '' {
  if (ownerType && allowedOwnerTypes.has(ownerType as MediaOwnerType)) {
    return ownerType as MediaOwnerType;
  }

  return '';
}

function normalizeOptionalNumber(value?: string | number | null): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : null;
}

function normalizeBoolean(value?: string | boolean): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (value === undefined || value === '') {
    return true;
  }

  return value === 'true' || value === '1' || value === 'on';
}

function normalizeSortOrder(sortOrder?: string, slotNo?: string) {
  const explicitSortOrder = normalizeOptionalNumber(sortOrder);
  if (explicitSortOrder !== null) {
    return explicitSortOrder;
  }

  return normalizeOptionalNumber(slotNo) ?? 0;
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

function normalizeEntry(fileName: string, entry: MediaIndexEntry, file: {
  originalName?: string;
  size: number;
  mimeType: string;
  createdAt?: string;
}): LocalImageFile {
  return {
    fileName,
    originalName: entry.originalName ?? file.originalName ?? fileName,
    url: toImageUrl(fileName),
    size: file.size,
    mimeType: file.mimeType,
    category: normalizeCategory(entry.category),
    alt: entry.alt ?? '',
    description: entry.description ?? '',
    ownerType: normalizeOwnerType(entry.ownerType),
    ownerId: entry.ownerId ?? null,
    ownerSlug: entry.ownerSlug ?? '',
    groupKey: entry.groupKey ?? '',
    slotNo: entry.slotNo ?? null,
    caption: entry.caption ?? '',
    enabled: entry.enabled ?? true,
    sortOrder: entry.sortOrder ?? entry.slotNo ?? 0,
    createdAt: entry.createdAt ?? file.createdAt,
  };
}

export async function toUploadedImage(file: Express.Multer.File, metadata: MediaUploadMetadata): Promise<LocalImageFile> {
  const index = await readMediaIndex();
  const slotNo = normalizeOptionalNumber(metadata.slotNo);
  const ownerId = normalizeOptionalNumber(metadata.ownerId);
  const createdAt = new Date().toISOString();
  const entry: MediaIndexEntry = {
    originalName: file.originalname,
    category: normalizeCategory(metadata.category),
    alt: metadata.alt?.trim() ?? '',
    description: metadata.description?.trim() ?? '',
    ownerType: normalizeOwnerType(metadata.ownerType),
    ownerId,
    ownerSlug: metadata.ownerSlug?.trim() ?? '',
    groupKey: metadata.groupKey?.trim() ?? '',
    slotNo,
    caption: metadata.caption?.trim() ?? '',
    enabled: normalizeBoolean(metadata.enabled),
    sortOrder: normalizeSortOrder(metadata.sortOrder, metadata.slotNo),
    createdAt,
  };

  index[file.filename] = entry;
  await writeMediaIndex(index);

  return normalizeEntry(file.filename, entry, {
    originalName: file.originalname,
    size: file.size,
    mimeType: file.mimetype,
    createdAt,
  });
}

export async function listLocalImages(filters: MediaListFilters = {}): Promise<LocalImageFile[]> {
  await fs.mkdir(imageUploadDir, { recursive: true });

  const index = await readMediaIndex();
  const keyword = filters.keyword?.trim().toLowerCase();
  const entries = await fs.readdir(imageUploadDir, { withFileTypes: true });
  const images = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .filter((entry) => mimeTypeByExt[path.extname(entry.name).toLowerCase()])
      .map(async (entry) => {
        const stats = await fs.stat(path.join(imageUploadDir, entry.name));
        const ext = path.extname(entry.name).toLowerCase();

        return normalizeEntry(entry.name, index[entry.name] ?? {}, {
          size: stats.size,
          mimeType: mimeTypeByExt[ext],
          createdAt: stats.birthtime.toISOString(),
        });
      }),
  );

  return images
    .filter((image) => !filters.category || image.category === filters.category)
    .filter((image) => !filters.ownerType || image.ownerType === filters.ownerType)
    .filter((image) => !filters.ownerId || String(image.ownerId ?? '') === filters.ownerId)
    .filter((image) => !filters.ownerSlug || image.ownerSlug === filters.ownerSlug)
    .filter((image) => !filters.groupKey || image.groupKey === filters.groupKey)
    .filter((image) => !filters.slotNo || String(image.slotNo ?? '') === filters.slotNo)
    .filter((image) => filters.enabled === undefined || String(image.enabled) === filters.enabled)
    .filter((image) => {
      if (!keyword) {
        return true;
      }

      return [
        image.fileName,
        image.originalName,
        image.alt,
        image.description,
        image.caption,
      ].some((value) => value.toLowerCase().includes(keyword));
    })
    .sort((a, b) => (a.sortOrder - b.sortOrder) || String(b.createdAt).localeCompare(String(a.createdAt)));
}
