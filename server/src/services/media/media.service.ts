import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Express } from 'express';
import type { MediaCategory, MediaOwnerType, MediaStatus } from '../../../../shared/types/media.js';
import { imageUploadDir, normalizeOriginalFileName } from '../../middlewares/upload.middleware.js';
import { readHomeInteractiveImages } from '../home/home-interactive-images.service.js';

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

const allowedStatuses = new Set<MediaStatus>(['active', 'archived']);

export interface LocalImageFile {
  fileName: string;
  originalName: string;
  displayName: string;
  url: string;
  size: number;
  mimeType: string;
  width: number | null;
  height: number | null;
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
  status: MediaStatus;
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
  status?: string;
}

export interface MediaUploadMetadata {
  category?: string;
  displayName?: string;
  storageName?: string;
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
  displayName?: string;
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
  width?: number | null;
  height?: number | null;
  status?: MediaStatus;
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

function normalizeStatus(status?: string): MediaStatus {
  if (status && allowedStatuses.has(status as MediaStatus)) {
    return status as MediaStatus;
  }

  return 'active';
}

function normalizeStatusFilter(status?: string): MediaStatus | 'all' {
  if (!status) {
    return 'active';
  }

  if (status === 'all' || allowedStatuses.has(status as MediaStatus)) {
    return status as MediaStatus | 'all';
  }

  throw Object.assign(new Error('Invalid media status'), {
    statusCode: 400,
    code: 'INVALID_MEDIA_STATUS',
  });
}

function validateSafeFileName(fileName: string) {
  if (
    !fileName
    || fileName !== path.basename(fileName)
    || fileName.includes('/')
    || fileName.includes('\\')
    || !mimeTypeByExt[path.extname(fileName).toLowerCase()]
  ) {
    throw Object.assign(new Error('Invalid media file name'), {
      statusCode: 400,
      code: 'INVALID_MEDIA_FILE_NAME',
    });
  }
}

function createMediaError(message: string, statusCode: number, code: string, details?: unknown) {
  return Object.assign(new Error(message), {
    statusCode,
    code,
    details,
  });
}

function normalizeDisplayName(displayName: string | undefined, originalName: string) {
  const nextDisplayName = displayName?.trim();
  return nextDisplayName || originalName;
}

function normalizeStorageBaseName(storageName?: string) {
  const nextStorageName = storageName?.trim();
  if (!nextStorageName) {
    return '';
  }

  if (!/^[A-Za-z0-9_-]+$/.test(nextStorageName)) {
    throw createMediaError('Storage file name can only contain letters, numbers, hyphens, and underscores', 400, 'INVALID_STORAGE_NAME');
  }

  return nextStorageName;
}

async function applyCustomStorageName(file: Express.Multer.File, storageName?: string) {
  const baseName = normalizeStorageBaseName(storageName);
  if (!baseName) {
    return file;
  }

  const ext = path.extname(file.filename).toLowerCase();
  const nextFileName = `${baseName}${ext}`;
  validateSafeFileName(nextFileName);

  if (file.filename === nextFileName) {
    return file;
  }

  const nextPath = path.join(imageUploadDir, nextFileName);
  const targetExists = await fs.access(nextPath).then(() => true).catch(() => false);
  if (targetExists) {
    throw createMediaError('Storage file name already exists', 400, 'STORAGE_NAME_EXISTS');
  }

  try {
    await fs.rename(file.path, nextPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw createMediaError('Storage file name already exists', 400, 'STORAGE_NAME_EXISTS');
    }

    throw error;
  }

  file.filename = nextFileName;
  file.path = nextPath;
  return file;
}

function parsePngDimensions(buffer: Buffer) {
  if (buffer.length < 24 || buffer.toString('ascii', 1, 4) !== 'PNG') {
    return null;
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function parseJpegDimensions(buffer: Buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2) {
      return null;
    }

    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      return {
        width: buffer.readUInt16BE(offset + 7),
        height: buffer.readUInt16BE(offset + 5),
      };
    }

    offset += 2 + length;
  }

  return null;
}

function readUInt24LE(buffer: Buffer, offset: number) {
  return buffer[offset] + (buffer[offset + 1] << 8) + (buffer[offset + 2] << 16);
}

function parseWebpDimensions(buffer: Buffer) {
  if (buffer.length < 30 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') {
    return null;
  }

  const chunkType = buffer.toString('ascii', 12, 16);
  if (chunkType === 'VP8X') {
    return {
      width: readUInt24LE(buffer, 24) + 1,
      height: readUInt24LE(buffer, 27) + 1,
    };
  }

  if (chunkType === 'VP8 ') {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }

  if (chunkType === 'VP8L') {
    const bits = buffer.readUInt32LE(21);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }

  return null;
}

async function readImageDimensions(filePath: string) {
  const buffer = await fs.readFile(filePath);
  const dimensions = parsePngDimensions(buffer) ?? parseJpegDimensions(buffer) ?? parseWebpDimensions(buffer);

  return {
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
  };
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
  width?: number | null;
  height?: number | null;
  createdAt?: string;
}): LocalImageFile {
  const originalName = entry.originalName ?? file.originalName ?? fileName;

  return {
    fileName,
    originalName,
    displayName: normalizeDisplayName(entry.displayName, originalName),
    url: toImageUrl(fileName),
    size: file.size,
    mimeType: file.mimeType,
    width: entry.width ?? file.width ?? null,
    height: entry.height ?? file.height ?? null,
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
    status: normalizeStatus(entry.status),
    createdAt: entry.createdAt ?? file.createdAt,
  };
}

export async function toUploadedImage(file: Express.Multer.File, metadata: MediaUploadMetadata): Promise<LocalImageFile> {
  const storedFile = await applyCustomStorageName(file, metadata.storageName);
  const index = await readMediaIndex();
  const slotNo = normalizeOptionalNumber(metadata.slotNo);
  const ownerId = normalizeOptionalNumber(metadata.ownerId);
  const createdAt = new Date().toISOString();
  const originalName = normalizeOriginalFileName(storedFile.originalname);
  const dimensions = await readImageDimensions(storedFile.path);
  const entry: MediaIndexEntry = {
    originalName,
    displayName: normalizeDisplayName(metadata.displayName, originalName),
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
    width: dimensions.width,
    height: dimensions.height,
    status: 'active',
    createdAt,
  };

  index[storedFile.filename] = entry;
  await writeMediaIndex(index);

  return normalizeEntry(storedFile.filename, entry, {
    originalName,
    size: storedFile.size,
    mimeType: storedFile.mimetype,
    width: dimensions.width,
    height: dimensions.height,
    createdAt,
  });
}

export async function listLocalImages(filters: MediaListFilters = {}): Promise<LocalImageFile[]> {
  await fs.mkdir(imageUploadDir, { recursive: true });

  const index = await readMediaIndex();
  const keyword = filters.keyword?.trim().toLowerCase();
  const status = normalizeStatusFilter(filters.status);
  const entries = await fs.readdir(imageUploadDir, { withFileTypes: true });
  const images = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .filter((entry) => mimeTypeByExt[path.extname(entry.name).toLowerCase()])
      .map(async (entry) => {
        const filePath = path.join(imageUploadDir, entry.name);
        const stats = await fs.stat(filePath);
        const dimensions = await readImageDimensions(filePath).catch(() => ({
          width: null,
          height: null,
        }));
        const ext = path.extname(entry.name).toLowerCase();

        return normalizeEntry(entry.name, index[entry.name] ?? {}, {
          size: stats.size,
          mimeType: mimeTypeByExt[ext],
          width: dimensions.width,
          height: dimensions.height,
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
    .filter((image) => status === 'all' || image.status === status)
    .filter((image) => {
      if (!keyword) {
        return true;
      }

      return [
        image.fileName,
        image.originalName,
        image.displayName,
        image.alt,
        image.description,
        image.caption,
      ].some((value) => value.toLowerCase().includes(keyword));
    })
    .sort((a, b) => (a.sortOrder - b.sortOrder) || String(b.createdAt).localeCompare(String(a.createdAt)));
}

async function getExistingImage(fileName: string) {
  validateSafeFileName(fileName);

  const filePath = path.join(imageUploadDir, fileName);
  const stats = await fs.stat(filePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') {
      throw Object.assign(new Error('Media file not found'), {
        statusCode: 404,
        code: 'MEDIA_FILE_NOT_FOUND',
      });
    }

    throw error;
  });
  const ext = path.extname(fileName).toLowerCase();
  const dimensions = await readImageDimensions(filePath).catch(() => ({
    width: null,
    height: null,
  }));

  return {
    size: stats.size,
    mimeType: mimeTypeByExt[ext],
    width: dimensions.width,
    height: dimensions.height,
    createdAt: stats.birthtime.toISOString(),
  };
}

async function assertNotUsedByHomeInteractive(fileName: string) {
  const slots = await readHomeInteractiveImages();
  const usedSlots = slots.filter((slot) => slot.mediaFileName === fileName);

  if (usedSlots.length > 0) {
    throw createMediaError('该图片正在首页使用，建议先解除引用。', 409, 'MEDIA_USED_BY_HOME', {
      slots: usedSlots.map((slot) => slot.slotNo),
    });
  }
}

async function updateMediaStatus(fileName: string, status: MediaStatus) {
  const file = await getExistingImage(fileName);
  const index = await readMediaIndex();
  const entry = index[fileName] ?? {};
  const nextEntry: MediaIndexEntry = {
    ...entry,
    status,
  };

  index[fileName] = nextEntry;
  await writeMediaIndex(index);

  return normalizeEntry(fileName, nextEntry, file);
}

export async function archiveLocalImage(fileName: string) {
  await assertNotUsedByHomeInteractive(fileName);
  return updateMediaStatus(fileName, 'archived');
}

export async function restoreLocalImage(fileName: string) {
  return updateMediaStatus(fileName, 'active');
}

export interface DeleteLocalImageResult {
  fileName: string;
  deletedFile: boolean;
  removedFromIndex: boolean;
  fileMissing: boolean;
}

export async function deleteLocalImage(fileName: string): Promise<DeleteLocalImageResult> {
  validateSafeFileName(fileName);
  await assertNotUsedByHomeInteractive(fileName);

  const index = await readMediaIndex();
  const entry = index[fileName];
  const status = normalizeStatus(entry?.status);

  if (status !== 'archived') {
    throw createMediaError('Only archived media can be permanently deleted', 400, 'MEDIA_NOT_ARCHIVED');
  }

  const filePath = path.join(imageUploadDir, fileName);
  let deletedFile = false;
  let fileMissing = false;

  try {
    await fs.unlink(filePath);
    deletedFile = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      fileMissing = true;
    } else {
      throw error;
    }
  }

  const removedFromIndex = Boolean(index[fileName]);
  delete index[fileName];
  await writeMediaIndex(index);

  return {
    fileName,
    deletedFile,
    removedFromIndex,
    fileMissing,
  };
}
