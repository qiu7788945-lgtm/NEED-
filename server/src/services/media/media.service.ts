import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Express } from 'express';
import type { MediaCategory, MediaFileType, MediaOwnerType, MediaStatus } from '../../../../shared/types/media.js';
import { env } from '../../config/env.js';
import { imageUploadDir, normalizeOriginalFileName, videoUploadDir } from '../../middlewares/upload.middleware.js';
import { logger } from '../../utils/logger.js';
import {
  normalizeMediaLibraryCategory,
  readMediaLibraryMysqlCandidates,
  type MediaLibraryMysqlCandidate,
} from '../data-source/media-library-content-source.js';
import { readHomeInteractiveImages } from '../home/home-interactive-images.service.js';
import { readHomeVideoConfig } from '../home/home-video.service.js';
import { shadowUpdateMediaMetadata, shadowWriteUploadedMedia } from './media-shadow-writer.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const dataDir = path.join(serverRoot, 'data');
const mediaIndexPath = path.join(dataDir, 'media-library.json');
let mediaIndexQueue = Promise.resolve();

const mimeTypeByExt: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

const imageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const videoMimeTypes = new Set(['video/mp4', 'video/webm']);
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const videoExtensions = new Set(['.mp4', '.webm']);
const maxImageSize = env.media.maxImageSizeMb * 1024 * 1024;
const largeFileThreshold = 2 * 1024 * 1024;
const largeDimensionThreshold = 2500;
const cleanupAgeMs = 30 * 24 * 60 * 60 * 1000;
const mediaListFallbackWarningIntervalMs = 60 * 1000;
let lastMediaListFallbackWarningAt = 0;

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
  fileType: MediaFileType;
  url: string;
  size: number;
  mimeType: string;
  width: number | null;
  height: number | null;
  duration: number | null;
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
  usageCount: number;
  usages: MediaUsage[];
  suggestedCategory?: MediaCategory;
  categoryWarning?: string;
  duplicateWarnings: DuplicateWarning[];
  isLargeFile: boolean;
  isLargeDimension: boolean;
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
  fileType?: string;
  cleanup?: string;
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

export interface MediaUpdateMetadata {
  displayName?: unknown;
  category?: unknown;
  alt?: unknown;
  caption?: unknown;
  description?: unknown;
  ownerType?: unknown;
  ownerId?: unknown;
  ownerSlug?: unknown;
  groupKey?: unknown;
  slotNo?: unknown;
  sortOrder?: unknown;
  enabled?: unknown;
}

export interface RegisterLocalMediaMetadata {
  originalName?: string;
  displayName?: string;
  category?: string;
  alt?: string;
  description?: string;
  ownerType?: string;
  ownerId?: string | number | null;
  ownerSlug?: string;
  groupKey?: string;
  slotNo?: string | number | null;
  caption?: string;
  enabled?: string | boolean;
  sortOrder?: string | number | null;
}

export interface MediaUsage {
  type: 'home_interactive' | 'home_video';
  label: string;
  detail: string;
}

export interface DuplicateWarning {
  type: 'same_original_name' | 'same_display_name' | 'same_file_name' | 'same_size' | 'same_original_name_and_size' | 'storage_name_renamed';
  message: string;
  fileName?: string;
}

export interface BatchMediaResultItem {
  fileName: string;
  status: 'success' | 'skipped' | 'failed';
  reason?: string;
}

export interface BatchMediaResult {
  total: number;
  success: number;
  skipped: number;
  failed: number;
  results: BatchMediaResultItem[];
}

type MediaIndexEntry = {
  originalName?: string;
  displayName?: string;
  fileType?: MediaFileType;
  url?: string;
  size?: number;
  mimeType?: string;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
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
  status?: MediaStatus;
  createdAt?: string;
};

type MediaIndex = Record<string, MediaIndexEntry>;

function toImageUrl(fileName: string) {
  return `/uploads/images/${encodeURIComponent(fileName)}`;
}

function toMediaUrl(fileName: string, fileType: MediaFileType) {
  const basePath = fileType === 'video' ? '/uploads/videos' : '/uploads/images';
  return `${basePath}/${encodeURIComponent(fileName)}`;
}

function getFileTypeFromMimeType(mimeType?: string): MediaFileType {
  if (mimeType && videoMimeTypes.has(mimeType)) {
    return 'video';
  }

  return 'image';
}

function getFileTypeFromFileName(fileName: string): MediaFileType {
  return videoExtensions.has(path.extname(fileName).toLowerCase()) ? 'video' : 'image';
}

function getMediaUploadDir(fileType: MediaFileType) {
  return fileType === 'video' ? videoUploadDir : imageUploadDir;
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

function normalizeEditableText(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() : undefined;
}

function normalizeEditableNumber(value: unknown): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === '') {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return normalizeOptionalNumber(value);
  }

  return undefined;
}

function normalizeEditableBoolean(value: unknown): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === 'boolean' || typeof value === 'string') {
    return normalizeBoolean(value);
  }

  return undefined;
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
    throw createMediaError('存储文件名只能包含英文、数字、短横线和下划线。', 400, 'INVALID_STORAGE_NAME');
  }

  return nextStorageName;
}

async function applyCustomStorageName(file: Express.Multer.File, storageName?: string) {
  normalizeStorageBaseName(storageName);
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

function normalizeJsonText(text: string) {
  return text.replace(/^\uFEFF/, '').trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function createCorruptMediaIndexPath() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(dataDir, `media-library.corrupt-${timestamp}.json`);
}

function createMediaIndexTmpPath() {
  return `${mediaIndexPath}.${Date.now()}.${Math.random().toString(36).slice(2, 10)}.tmp`;
}

function withMediaIndexLock<T>(task: () => Promise<T>): Promise<T> {
  const run = mediaIndexQueue.then(task, task);
  mediaIndexQueue = run.then(() => undefined, () => undefined);
  return run;
}

function sanitizeMediaIndexEntry(entry: MediaIndexEntry): MediaIndexEntry {
  return {
    originalName: entry.originalName,
    displayName: entry.displayName,
    fileType: entry.fileType,
    url: entry.url,
    size: entry.size,
    mimeType: entry.mimeType,
    width: entry.width,
    height: entry.height,
    duration: entry.duration,
    category: entry.category,
    alt: entry.alt,
    description: entry.description,
    ownerType: entry.ownerType,
    ownerId: entry.ownerId,
    ownerSlug: entry.ownerSlug,
    groupKey: entry.groupKey,
    slotNo: entry.slotNo,
    caption: entry.caption,
    enabled: entry.enabled,
    sortOrder: entry.sortOrder,
    status: entry.status,
    createdAt: entry.createdAt,
  };
}

function sanitizeMediaIndex(index: MediaIndex): MediaIndex {
  return Object.fromEntries(
    Object.entries(index).map(([fileName, entry]) => [fileName, sanitizeMediaIndexEntry(entry)]),
  );
}

async function readMediaIndex(): Promise<MediaIndex> {
  await fs.mkdir(dataDir, { recursive: true });

  try {
    const raw = normalizeJsonText(await fs.readFile(mediaIndexPath, 'utf8'));
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      throw new SyntaxError('Media index root must be an object');
    }

    return parsed as MediaIndex;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }

    if (error instanceof SyntaxError) {
      const backupPath = createCorruptMediaIndexPath();
      let backedUp = true;
      await fs.rename(mediaIndexPath, backupPath).catch((backupError) => {
        backedUp = false;
        logger.warn('媒体索引文件损坏，但备份失败。已降级为空索引。', {
          path: mediaIndexPath,
          backupPath,
          message: backupError instanceof Error ? backupError.message : String(backupError),
        });
      });
      if (backedUp) {
        logger.warn('媒体索引文件损坏，已备份并降级为空索引。', {
          path: mediaIndexPath,
          backupPath,
          message: error.message,
        });
      }
      return {};
    }

    throw error;
  }
}

async function writeMediaIndex(index: MediaIndex) {
  await fs.mkdir(dataDir, { recursive: true });
  const tmpPath = createMediaIndexTmpPath();
  const persistedIndex = sanitizeMediaIndex(index);
  await fs.writeFile(tmpPath, `${JSON.stringify(persistedIndex, null, 2)}\n`, 'utf8');
  try {
    await fs.rename(tmpPath, mediaIndexPath);
  } catch (error) {
    logger.warn('媒体索引原子写入失败，临时文件重命名未完成。', {
      tmpPath,
      targetPath: mediaIndexPath,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

function normalizeEntry(fileName: string, entry: MediaIndexEntry, file: {
  originalName?: string;
  size: number;
  mimeType: string;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  fileType?: MediaFileType;
  createdAt?: string;
}): LocalImageFile {
  const originalName = entry.originalName ?? file.originalName ?? fileName;
  const fileType = entry.fileType ?? file.fileType ?? getFileTypeFromMimeType(file.mimeType);
  const width = fileType === 'image' ? (entry.width ?? file.width ?? null) : null;
  const height = fileType === 'image' ? (entry.height ?? file.height ?? null) : null;
  const size = file.size;
  const displayName = normalizeDisplayName(entry.displayName, originalName);
  const category = normalizeCategory(entry.category);
  const alt = entry.alt ?? '';
  const caption = entry.caption ?? '';
  const ownerSlug = entry.ownerSlug ?? '';
  const groupKey = entry.groupKey ?? '';
  const suggestedCategory = category === 'temporary'
    ? suggestCategory({ fileType, fileName, originalName, displayName, alt, caption, ownerSlug, groupKey })
    : undefined;

  return {
    fileName,
    originalName,
    displayName,
    fileType,
    url: entry.url ?? toMediaUrl(fileName, fileType),
    size,
    mimeType: entry.mimeType ?? file.mimeType,
    width,
    height,
    duration: entry.duration ?? file.duration ?? null,
    category,
    alt,
    description: entry.description ?? '',
    ownerType: normalizeOwnerType(entry.ownerType),
    ownerId: entry.ownerId ?? null,
    ownerSlug,
    groupKey,
    slotNo: entry.slotNo ?? null,
    caption,
    enabled: entry.enabled ?? true,
    sortOrder: entry.sortOrder ?? entry.slotNo ?? 0,
    status: normalizeStatus(entry.status),
    createdAt: entry.createdAt ?? file.createdAt,
    usageCount: 0,
    usages: [],
    suggestedCategory,
    categoryWarning: category === 'temporary' ? '这张素材仍是临时素材，建议归类。' : undefined,
    duplicateWarnings: [],
    isLargeFile: fileType === 'image' && size > largeFileThreshold,
    isLargeDimension: fileType === 'image' && Boolean((width && width > largeDimensionThreshold) || (height && height > largeDimensionThreshold)),
  };
}

function withUsages(image: LocalImageFile, usages: MediaUsage[] = []): LocalImageFile {
  return {
    ...image,
    usageCount: usages.length,
    usages,
  };
}

function getFileNameFromMediaUrl(mediaUrl: string) {
  if (!mediaUrl) {
    return '';
  }

  const rawName = path.basename(mediaUrl.split('?')[0]);
  try {
    return decodeURIComponent(rawName);
  } catch {
    return rawName;
  }
}

export async function getMediaUsagesByFileName(): Promise<Record<string, MediaUsage[]>> {
  const slots = await readHomeInteractiveImages();
  const homeVideo = await readHomeVideoConfig();
  const usageMap: Record<string, MediaUsage[]> = {};

  slots.forEach((slot) => {
    const referencedNames = new Set(
      [slot.mediaFileName, getFileNameFromMediaUrl(slot.mediaUrl)]
        .map((value) => value.trim())
        .filter(Boolean),
    );

    referencedNames.forEach((fileName) => {
      usageMap[fileName] = [
        ...(usageMap[fileName] ?? []),
        {
          type: 'home_interactive',
          label: '首页管理 / 创意案例现场图组',
          detail: `第 ${slot.slotNo} 张图`,
        },
      ];
    });
  });

  if (homeVideo.videoFileName) {
    usageMap[homeVideo.videoFileName] = [
      ...(usageMap[homeVideo.videoFileName] ?? []),
      {
        type: 'home_video',
        label: '首页管理 / 首页视频',
        detail: '首页视频文件',
      },
    ];
  }

  if (homeVideo.posterFileName) {
    usageMap[homeVideo.posterFileName] = [
      ...(usageMap[homeVideo.posterFileName] ?? []),
      {
        type: 'home_video',
        label: '首页管理 / 首页视频',
        detail: '视频封面',
      },
    ];
  }

  return usageMap;
}

function suggestCategory(input: {
  fileType: MediaFileType;
  fileName: string;
  originalName: string;
  displayName: string;
  alt: string;
  caption: string;
  ownerSlug: string;
  groupKey: string;
}): MediaCategory | undefined {
  const text = [
    input.fileName,
    input.originalName,
    input.displayName,
    input.alt,
    input.caption,
    input.ownerSlug,
    input.groupKey,
  ].join(' ').toLowerCase();

  if (/(qrcode|qr|二维码)/i.test(text)) {
    return 'qrcode';
  }
  if (/(home|hero|首页|交互)/i.test(text)) {
    return input.fileType === 'video' ? 'home_video' : 'home_interactive';
  }
  if (/(solution|场景|家庭日|年会|沙龙|论坛|展览|family|annual|salon|forum|exhibition)/i.test(text)) {
    return input.fileType === 'video' ? 'solution_video' : 'solution_image';
  }
  if (/(article|文章|封面)/i.test(text)) {
    return 'article_cover';
  }
  if (/(case|案例|项目)/i.test(text)) {
    return 'case_image';
  }

  return input.fileType === 'video' ? 'temporary' : undefined;
}

function getDuplicateWarnings(index: MediaIndex, fileName: string, entry: MediaIndexEntry, size: number): DuplicateWarning[] {
  const warnings: DuplicateWarning[] = [];
  const originalName = entry.originalName ?? '';
  const displayName = entry.displayName ?? '';

  Object.entries(index).forEach(([existingFileName, existingEntry]) => {
    if (existingFileName === fileName) {
      return;
    }

    if (existingFileName === fileName) {
      warnings.push({ type: 'same_file_name', message: '已有相同存储文件名', fileName: existingFileName });
    }
    if (originalName && existingEntry.originalName === originalName) {
      warnings.push({ type: 'same_original_name', message: '已有同名原始文件', fileName: existingFileName });
    }
    if (displayName && existingEntry.displayName === displayName) {
      warnings.push({ type: 'same_display_name', message: '已有同名素材名称', fileName: existingFileName });
    }
    if (typeof existingEntry.size === 'number' && existingEntry.size === size) {
      warnings.push({ type: 'same_size', message: '已有大小相同的素材', fileName: existingFileName });
    }
    if (originalName && existingEntry.originalName === originalName && existingEntry.size === size) {
      warnings.push({ type: 'same_original_name_and_size', message: '原始文件名和大小相同，高度疑似重复', fileName: existingFileName });
    }
  });

  return warnings;
}

function wasStorageNameRenamed(storageName: string | undefined, fileName: string) {
  const baseName = normalizeStorageBaseName(storageName);
  if (!baseName) {
    return false;
  }

  return path.basename(fileName, path.extname(fileName)) !== baseName;
}

function isOlderThanThirtyDays(createdAt?: string) {
  if (!createdAt) {
    return false;
  }

  const time = new Date(createdAt).getTime();
  return Number.isFinite(time) && Date.now() - time > cleanupAgeMs;
}

function applyMediaListFilters(images: LocalImageFile[], filters: MediaListFilters = {}) {
  const keyword = filters.keyword?.trim().toLowerCase();
  const status = normalizeStatusFilter(filters.status);

  return images
    .filter((image) => !filters.category || image.category === filters.category)
    .filter((image) => !filters.ownerType || image.ownerType === filters.ownerType)
    .filter((image) => !filters.ownerId || String(image.ownerId ?? '') === filters.ownerId)
    .filter((image) => !filters.ownerSlug || image.ownerSlug === filters.ownerSlug)
    .filter((image) => !filters.groupKey || image.groupKey === filters.groupKey)
    .filter((image) => !filters.slotNo || String(image.slotNo ?? '') === filters.slotNo)
    .filter((image) => filters.enabled === undefined || String(image.enabled) === filters.enabled)
    .filter((image) => status === 'all' || image.status === status)
    .filter((image) => !filters.fileType || image.fileType === filters.fileType)
    .filter((image) => {
      if (!filters.cleanup) {
        return true;
      }
      if (filters.cleanup === 'temporary') {
        return image.category === 'temporary';
      }
      if (filters.cleanup === 'old_temporary') {
        return image.category === 'temporary' && isOlderThanThirtyDays(image.createdAt);
      }
      if (filters.cleanup === 'old_archived') {
        return image.status === 'archived' && isOlderThanThirtyDays(image.createdAt);
      }
      return true;
    })
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

function warnMediaListFallback(reason: string, error?: unknown) {
  const now = Date.now();
  if (now - lastMediaListFallbackWarningAt < mediaListFallbackWarningIntervalMs) {
    return;
  }

  lastMediaListFallbackWarningAt = now;
  logger.warn('media-library MySQL list fallback to JSON/uploads.', {
    reason,
    message: error instanceof Error ? error.message : error ? String(error) : undefined,
  });
}

function textValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function firstMetadataValue(
  metadata: Record<string, unknown>,
  sourceRecord: Record<string, unknown>,
  ...keys: string[]
) {
  for (const key of keys) {
    if (metadata[key] !== undefined && metadata[key] !== null && metadata[key] !== '') {
      return metadata[key];
    }

    if (sourceRecord[key] !== undefined && sourceRecord[key] !== null && sourceRecord[key] !== '') {
      return sourceRecord[key];
    }
  }

  return undefined;
}

function firstMetadataString(
  metadata: Record<string, unknown>,
  sourceRecord: Record<string, unknown>,
  ...keys: string[]
) {
  const value = firstMetadataValue(metadata, sourceRecord, ...keys);
  return textValue(value);
}

function normalizeMysqlNumber(value: unknown) {
  if (typeof value === 'number' || typeof value === 'string' || value === null || value === undefined) {
    return normalizeOptionalNumber(value as string | number | null | undefined);
  }

  return null;
}

function normalizeMysqlBoolean(value: unknown) {
  if (typeof value === 'boolean' || typeof value === 'string' || value === undefined) {
    return normalizeBoolean(value as string | boolean | undefined);
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  return true;
}

function compactMediaCategory(value: string) {
  return value.toLowerCase().replace(/[\s_-]+/g, '');
}

function mysqlCategoryToMediaCategory(rawCategory: string, fileType: MediaFileType): MediaCategory | null {
  if (allowedCategories.has(rawCategory as MediaCategory)) {
    return rawCategory as MediaCategory;
  }

  switch (compactMediaCategory(rawCategory)) {
    case 'homeinteractive':
    case 'homeinteractiveimage':
    case 'homeinteractiveimages':
      return 'home_interactive';
    case 'homevideo':
    case 'homevideos':
      return 'home_video';
    case 'caseimage':
    case 'caseimages':
    case 'casemedia':
    case 'casemedias':
    case 'casecover':
      return 'case_image';
    case 'solutionimage':
    case 'solutionimages':
    case 'solutionmedia':
    case 'solutionmedias':
    case 'solutioncover':
    case 'solutionpagecover':
      return fileType === 'video' ? 'solution_video' : 'solution_image';
    case 'solutionvideo':
    case 'solutionvideos':
      return 'solution_video';
    case 'articlecover':
    case 'articlecovers':
      return 'article_cover';
    case 'pageeditor':
      return 'page_editor';
    case 'wordimport':
      return 'word_import';
    case 'qrcode':
      return 'qrcode';
    case 'temporary':
      return 'temporary';
    default:
      break;
  }

  const normalizedCategory = normalizeMediaLibraryCategory(rawCategory);
  if (normalizedCategory === 'solution-media') {
    return fileType === 'video' ? 'solution_video' : 'solution_image';
  }
  if (normalizedCategory === 'case-media') {
    return 'case_image';
  }
  if (normalizedCategory === 'home-interactive-images') {
    return 'home_interactive';
  }
  if (normalizedCategory === 'home-video') {
    return 'home_video';
  }

  return null;
}

function mysqlStatusToMediaStatus(value: string): MediaStatus | null {
  const status = value.trim().toLowerCase();
  if (!status) {
    return 'active';
  }
  if (status === 'inactive') {
    return 'archived';
  }
  if (allowedStatuses.has(status as MediaStatus)) {
    return status as MediaStatus;
  }

  return null;
}

function mysqlPathToPublicUrl(value: string) {
  const normalized = value.trim().replace(/\\/g, '/');
  if (!normalized) {
    return '';
  }
  if (/^https?:\/\//i.test(normalized) || normalized.startsWith('/')) {
    return normalized;
  }

  const uploadsIndex = normalized.indexOf('/uploads/');
  if (uploadsIndex >= 0) {
    return normalized.slice(uploadsIndex);
  }
  if (normalized.startsWith('uploads/')) {
    return `/${normalized}`;
  }

  return normalized;
}

function getMysqlMetadata(candidate: MediaLibraryMysqlCandidate) {
  const metadata = isRecord(candidate.rawMetadata) ? candidate.rawMetadata : {};
  const sourceRecord = isRecord(metadata.sourceRecord) ? metadata.sourceRecord : {};

  return { metadata, sourceRecord };
}

type MysqlMediaMapResult =
  | { ok: true; image: LocalImageFile }
  | { ok: false; reason: string };

function mapMysqlCandidateToLocalImage(
  candidate: MediaLibraryMysqlCandidate,
  usagesByFileName: Record<string, MediaUsage[]>,
): MysqlMediaMapResult {
  const { metadata, sourceRecord } = getMysqlMetadata(candidate);
  const rawUrl = textValue(candidate.publicUrl) || textValue(candidate.url) || textValue(candidate.filePath);
  const url = mysqlPathToPublicUrl(rawUrl);
  const fileName = textValue(candidate.fileName) || getFileNameFromMediaUrl(url);

  if (!fileName || !url) {
    return { ok: false, reason: `media_files#${candidate.id} is missing fileName or public url.` };
  }

  const metadataFileType = firstMetadataString(metadata, sourceRecord, 'fileType', 'file_type');
  const fileType: MediaFileType = metadataFileType === 'video' || metadataFileType === 'image'
    ? metadataFileType
    : candidate.mimeType
      ? getFileTypeFromMimeType(candidate.mimeType)
      : getFileTypeFromFileName(fileName);
  const rawCategory = firstMetadataString(metadata, sourceRecord, 'category') || candidate.category;
  const category = mysqlCategoryToMediaCategory(rawCategory, fileType);
  const status = mysqlStatusToMediaStatus(candidate.status);

  if (!category) {
    return { ok: false, reason: `media_files#${candidate.id} category cannot be mapped to the existing media API category set.` };
  }

  if (!status) {
    return { ok: false, reason: `media_files#${candidate.id} status cannot be mapped to the existing media API status set.` };
  }

  if (!candidate.mimeType || !Number.isFinite(candidate.fileSize) || candidate.fileSize <= 0) {
    return { ok: false, reason: `media_files#${candidate.id} is missing mimeType or fileSize.` };
  }

  const originalName = candidate.originalName || fileName;
  const displayName = firstMetadataString(metadata, sourceRecord, 'displayName', 'display_name', 'title')
    || candidate.displayName
    || candidate.title
    || originalName;
  const slotNo = normalizeMysqlNumber(firstMetadataValue(metadata, sourceRecord, 'slotNo', 'slot_no', 'slotNumber', 'slot_number'));
  const sortOrder = normalizeMysqlNumber(firstMetadataValue(metadata, sourceRecord, 'sortOrder', 'sort_order')) ?? slotNo ?? 0;
  const width = fileType === 'image' ? candidate.width : null;
  const height = fileType === 'image' ? candidate.height : null;
  const image: LocalImageFile = {
    fileName,
    originalName,
    displayName,
    fileType,
    url,
    size: candidate.fileSize,
    mimeType: candidate.mimeType,
    width,
    height,
    duration: candidate.durationSeconds,
    category,
    alt: candidate.altText,
    description: candidate.description,
    ownerType: normalizeOwnerType(firstMetadataString(metadata, sourceRecord, 'ownerType', 'owner_type')),
    ownerId: normalizeMysqlNumber(firstMetadataValue(metadata, sourceRecord, 'ownerId', 'owner_id')),
    ownerSlug: firstMetadataString(metadata, sourceRecord, 'ownerSlug', 'owner_slug'),
    groupKey: firstMetadataString(metadata, sourceRecord, 'groupKey', 'group_key'),
    slotNo,
    caption: firstMetadataString(metadata, sourceRecord, 'caption'),
    enabled: normalizeMysqlBoolean(firstMetadataValue(metadata, sourceRecord, 'enabled', 'is_enabled')),
    sortOrder,
    status,
    createdAt: firstMetadataString(metadata, sourceRecord, 'createdAt', 'created_at') || candidate.createdAt,
    usageCount: 0,
    usages: [],
    suggestedCategory: undefined,
    categoryWarning: undefined,
    duplicateWarnings: [],
    isLargeFile: fileType === 'image' && candidate.fileSize > largeFileThreshold,
    isLargeDimension: fileType === 'image' && Boolean((width && width > largeDimensionThreshold) || (height && height > largeDimensionThreshold)),
  };

  return {
    ok: true,
    image: withUsages(image, usagesByFileName[fileName]),
  };
}

async function readMysqlMediaLibraryImages(): Promise<LocalImageFile[]> {
  const mysqlResult = await readMediaLibraryMysqlCandidates();
  const ownershipConflict = mysqlResult.candidates.find((item) => item.ownershipProfile.conflicts.length > 0);
  if (ownershipConflict) {
    throw new Error(`media_files#${ownershipConflict.id} has conflicting ownership metadata.`);
  }

  if (mysqlResult.counts.unknown > 0) {
    throw new Error(`${mysqlResult.counts.unknown} media_files rows have unknown ownership.`);
  }

  const likelyMediaLibrary = mysqlResult.candidates.filter((item) => item.ownershipKind === 'likelyMediaLibrary');
  if (!likelyMediaLibrary.length) {
    throw new Error('MySQL media-library adapter returned no likelyMediaLibrary rows.');
  }

  const usagesByFileName = await getMediaUsagesByFileName();
  const images: LocalImageFile[] = [];

  for (const candidate of likelyMediaLibrary) {
    const mapped = mapMysqlCandidateToLocalImage(candidate, usagesByFileName);
    if (mapped.ok === false) {
      throw new Error(mapped.reason);
    }

    images.push(mapped.image);
  }

  return images;
}

export async function listMediaLibraryImages(filters: MediaListFilters = {}): Promise<LocalImageFile[]> {
  normalizeStatusFilter(filters.status);

  try {
    return applyMediaListFilters(await readMysqlMediaLibraryImages(), filters);
  } catch (error) {
    warnMediaListFallback('mysql-media-library-list-unavailable', error);
    return listLocalImages(filters);
  }
}

export async function toUploadedImage(file: Express.Multer.File, metadata: MediaUploadMetadata): Promise<LocalImageFile> {
  const storedFile = await applyCustomStorageName(file, metadata.storageName);
  const fileType = getFileTypeFromMimeType(storedFile.mimetype);
  if (fileType === 'image' && storedFile.size > maxImageSize) {
    await fs.unlink(storedFile.path).catch(() => undefined);
    throw createMediaError(`图片文件太大，当前默认最大 ${env.media.maxImageSizeMb}MB。`, 400, 'IMAGE_TOO_LARGE');
  }

  const slotNo = normalizeOptionalNumber(metadata.slotNo);
  const ownerId = normalizeOptionalNumber(metadata.ownerId);
  const createdAt = new Date().toISOString();
  const originalName = normalizeOriginalFileName(storedFile.originalname);
  const dimensions = fileType === 'image'
    ? await readImageDimensions(storedFile.path)
    : { width: null, height: null };
  const displayName = normalizeDisplayName(metadata.displayName, originalName);
  const uploadedCategory = normalizeCategory(metadata.category);
  const entry: MediaIndexEntry = {
    originalName,
    displayName,
    fileType,
    url: toMediaUrl(storedFile.filename, fileType),
    size: storedFile.size,
    mimeType: storedFile.mimetype,
    width: dimensions.width,
    height: dimensions.height,
    duration: null,
    category: uploadedCategory,
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
    status: 'active',
    createdAt,
  };

  const uploadedImage = await withMediaIndexLock(async () => {
    const index = await readMediaIndex();
    const duplicateWarnings = getDuplicateWarnings(index, storedFile.filename, entry, storedFile.size);
    if (wasStorageNameRenamed(metadata.storageName, storedFile.filename)) {
      duplicateWarnings.push({
        type: 'storage_name_renamed',
        message: '存储文件名冲突，已自动追加后缀避免覆盖',
        fileName: storedFile.filename,
      });
    }

    index[storedFile.filename] = entry;
    await writeMediaIndex(index);

    const usagesByFileName = await getMediaUsagesByFileName();

    return {
      ...withUsages(normalizeEntry(storedFile.filename, entry, {
        originalName,
        size: storedFile.size,
        mimeType: storedFile.mimetype,
        width: dimensions.width,
        height: dimensions.height,
        duration: null,
        fileType,
        createdAt,
      }), usagesByFileName[storedFile.filename]),
      duplicateWarnings,
    };
  });

  await shadowWriteUploadedMedia(uploadedImage);

  return uploadedImage;
}

export async function listLocalImages(filters: MediaListFilters = {}): Promise<LocalImageFile[]> {
  await fs.mkdir(imageUploadDir, { recursive: true });
  await fs.mkdir(videoUploadDir, { recursive: true });

  const index = await readMediaIndex();
  const usagesByFileName = await getMediaUsagesByFileName();
  const mediaDirs = [
    { dir: imageUploadDir, fileType: 'image' as MediaFileType },
    { dir: videoUploadDir, fileType: 'video' as MediaFileType },
  ];
  const entries = (
    await Promise.all(mediaDirs.map(async (mediaDir) => {
      const dirEntries = await fs.readdir(mediaDir.dir, { withFileTypes: true }).catch(() => []);
      return dirEntries.map((entry) => ({ entry, ...mediaDir }));
    }))
  ).flat();
  const images = await Promise.all(
    entries
      .filter(({ entry }) => entry.isFile())
      .filter(({ entry, fileType }) => {
        const ext = path.extname(entry.name).toLowerCase();
        return fileType === 'video' ? videoExtensions.has(ext) : imageExtensions.has(ext);
      })
      .map(async ({ entry, dir, fileType }) => {
        const filePath = path.join(dir, entry.name);
        const stats = await fs.stat(filePath);
        const dimensions = fileType === 'image'
          ? await readImageDimensions(filePath).catch(() => ({
            width: null,
            height: null,
          }))
          : ({
          width: null,
          height: null,
        });
        const ext = path.extname(entry.name).toLowerCase();

        const indexEntry = index[entry.name] ?? {};
        const image = withUsages(normalizeEntry(entry.name, indexEntry, {
          size: stats.size,
          mimeType: mimeTypeByExt[ext],
          width: dimensions.width,
          height: dimensions.height,
          duration: indexEntry.duration ?? null,
          fileType,
          createdAt: stats.birthtime.toISOString(),
        }), usagesByFileName[entry.name]);

        return {
          ...image,
          duplicateWarnings: getDuplicateWarnings(index, entry.name, indexEntry, stats.size),
        };
      }),
  );

  return applyMediaListFilters(images, filters);
}

async function getExistingImage(fileName: string) {
  validateSafeFileName(fileName);

  const fileType = getFileTypeFromFileName(fileName);
  const filePath = path.join(getMediaUploadDir(fileType), fileName);
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
  const dimensions = fileType === 'image'
    ? await readImageDimensions(filePath).catch(() => ({
      width: null,
      height: null,
    }))
    : { width: null, height: null };

  return {
    size: stats.size,
    mimeType: mimeTypeByExt[ext],
    width: dimensions.width,
    height: dimensions.height,
    duration: null,
    fileType,
    createdAt: stats.birthtime.toISOString(),
  };
}

async function assertNotUsedByHomeInteractive(fileName: string) {
  const usagesByFileName = await getMediaUsagesByFileName();
  const usages = usagesByFileName[fileName] ?? [];

  if (usages.length > 0) {
    throw createMediaError('该图片正在首页使用，建议先解除引用。', 409, 'MEDIA_USED_BY_HOME', {
      usages,
    });
  }
}

async function updateMediaStatus(fileName: string, status: MediaStatus) {
  const file = await getExistingImage(fileName);

  return withMediaIndexLock(async () => {
    const index = await readMediaIndex();
    const entry = index[fileName] ?? {};
    const nextEntry: MediaIndexEntry = {
      ...entry,
      status,
    };

    index[fileName] = nextEntry;
    await writeMediaIndex(index);

    const usagesByFileName = await getMediaUsagesByFileName();
    return withUsages(normalizeEntry(fileName, nextEntry, file), usagesByFileName[fileName]);
  });
}

export async function archiveLocalImage(fileName: string) {
  await assertNotUsedByHomeInteractive(fileName);
  return updateMediaStatus(fileName, 'archived');
}

export async function restoreLocalImage(fileName: string) {
  return updateMediaStatus(fileName, 'active');
}

export async function updateLocalImageMetadata(fileName: string, metadata: MediaUpdateMetadata) {
  const file = await getExistingImage(fileName);

  const updatedImage = await withMediaIndexLock(async () => {
    const index = await readMediaIndex();
    const entry = index[fileName] ?? {};
    const nextEntry: MediaIndexEntry = {
      ...entry,
    };
    const displayName = normalizeEditableText(metadata.displayName);
    const category = normalizeEditableText(metadata.category);
    const alt = normalizeEditableText(metadata.alt);
    const caption = normalizeEditableText(metadata.caption);
    const description = normalizeEditableText(metadata.description);
    const ownerType = normalizeEditableText(metadata.ownerType);
    const ownerId = normalizeEditableNumber(metadata.ownerId);
    const ownerSlug = normalizeEditableText(metadata.ownerSlug);
    const groupKey = normalizeEditableText(metadata.groupKey);
    const slotNo = normalizeEditableNumber(metadata.slotNo);
    const sortOrder = normalizeEditableNumber(metadata.sortOrder);
    const enabled = normalizeEditableBoolean(metadata.enabled);

    if (displayName !== undefined) {
      nextEntry.displayName = normalizeDisplayName(displayName, entry.originalName ?? fileName);
    }
    if (category !== undefined) {
      nextEntry.category = normalizeCategory(category);
    }
    if (alt !== undefined) {
      nextEntry.alt = alt;
    }
    if (caption !== undefined) {
      nextEntry.caption = caption;
    }
    if (description !== undefined) {
      nextEntry.description = description;
    }
    if (ownerType !== undefined) {
      nextEntry.ownerType = normalizeOwnerType(ownerType);
    }
    if (ownerId !== undefined) {
      nextEntry.ownerId = ownerId;
    }
    if (ownerSlug !== undefined) {
      nextEntry.ownerSlug = ownerSlug;
    }
    if (groupKey !== undefined) {
      nextEntry.groupKey = groupKey;
    }
    if (slotNo !== undefined) {
      nextEntry.slotNo = slotNo;
    }
    if (sortOrder !== undefined) {
      nextEntry.sortOrder = sortOrder ?? 0;
    }
    if (enabled !== undefined) {
      nextEntry.enabled = enabled;
    }

    index[fileName] = nextEntry;
    await writeMediaIndex(index);

    const usagesByFileName = await getMediaUsagesByFileName();
    return withUsages(normalizeEntry(fileName, nextEntry, file), usagesByFileName[fileName]);
  });

  await shadowUpdateMediaMetadata(updatedImage);

  return updatedImage;
}

export async function registerLocalImageFile(fileName: string, metadata: RegisterLocalMediaMetadata) {
  const file = await getExistingImage(fileName);
  if (file.fileType !== 'image') {
    throw createMediaError('只能登记图片素材。', 400, 'INVALID_IMAGE_TYPE');
  }

  const originalName = normalizeOriginalFileName(metadata.originalName ?? fileName);
  const slotNo = normalizeOptionalNumber(metadata.slotNo);
  const sortOrder = normalizeOptionalNumber(metadata.sortOrder) ?? slotNo ?? 0;

  return withMediaIndexLock(async () => {
    const index = await readMediaIndex();
    const entry: MediaIndexEntry = {
      ...index[fileName],
      originalName,
      displayName: normalizeDisplayName(metadata.displayName, originalName),
      fileType: 'image',
      url: toImageUrl(fileName),
      size: file.size,
      mimeType: file.mimeType,
      width: file.width,
      height: file.height,
      duration: null,
      category: normalizeCategory(metadata.category),
      alt: metadata.alt?.trim() ?? '',
      description: metadata.description?.trim() ?? '',
      ownerType: normalizeOwnerType(metadata.ownerType),
      ownerId: normalizeOptionalNumber(metadata.ownerId),
      ownerSlug: metadata.ownerSlug?.trim() ?? '',
      groupKey: metadata.groupKey?.trim() ?? '',
      slotNo,
      caption: metadata.caption?.trim() ?? '',
      enabled: normalizeBoolean(metadata.enabled),
      sortOrder,
      status: 'active',
      createdAt: index[fileName]?.createdAt ?? new Date().toISOString(),
    };

    index[fileName] = entry;
    await writeMediaIndex(index);

    const usagesByFileName = await getMediaUsagesByFileName();
    return withUsages(normalizeEntry(fileName, entry, file), usagesByFileName[fileName]);
  });
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

  return withMediaIndexLock(async () => {
    const index = await readMediaIndex();
    const entry = index[fileName];
    const status = normalizeStatus(entry?.status);

    if (status !== 'archived') {
      throw createMediaError('请先归档素材，再执行永久删除。', 400, 'MEDIA_NOT_ARCHIVED');
    }

    const filePath = path.join(getMediaUploadDir(getFileTypeFromFileName(fileName)), fileName);
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
  });
}

function createBatchSummary(results: BatchMediaResultItem[]): BatchMediaResult {
  return {
    total: results.length,
    success: results.filter((result) => result.status === 'success').length,
    skipped: results.filter((result) => result.status === 'skipped').length,
    failed: results.filter((result) => result.status === 'failed').length,
    results,
  };
}

function getMediaErrorCode(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }

  return 'MEDIA_OPERATION_FAILED';
}

async function getImageStatus(fileName: string): Promise<MediaStatus> {
  await getExistingImage(fileName);
  const index = await readMediaIndex();
  return normalizeStatus(index[fileName]?.status);
}

export async function batchArchiveLocalImages(fileNames: string[]): Promise<BatchMediaResult> {
  const results: BatchMediaResultItem[] = [];

  for (const fileName of fileNames) {
    try {
      validateSafeFileName(fileName);
      const status = await getImageStatus(fileName);
      if (status !== 'active') {
        results.push({ fileName, status: 'skipped', reason: 'MEDIA_NOT_ACTIVE' });
        continue;
      }

      await archiveLocalImage(fileName);
      results.push({ fileName, status: 'success' });
    } catch (error) {
      const reason = getMediaErrorCode(error);
      results.push({
        fileName,
        status: reason === 'MEDIA_USED_BY_HOME' ? 'skipped' : 'failed',
        reason,
      });
    }
  }

  return createBatchSummary(results);
}

export async function batchRestoreLocalImages(fileNames: string[]): Promise<BatchMediaResult> {
  const results: BatchMediaResultItem[] = [];

  for (const fileName of fileNames) {
    try {
      validateSafeFileName(fileName);
      const status = await getImageStatus(fileName);
      if (status !== 'archived') {
        results.push({ fileName, status: 'skipped', reason: 'MEDIA_NOT_ARCHIVED' });
        continue;
      }

      await restoreLocalImage(fileName);
      results.push({ fileName, status: 'success' });
    } catch (error) {
      results.push({ fileName, status: 'failed', reason: getMediaErrorCode(error) });
    }
  }

  return createBatchSummary(results);
}

export async function batchDeleteLocalImages(fileNames: string[]): Promise<BatchMediaResult> {
  const results: BatchMediaResultItem[] = [];

  for (const fileName of fileNames) {
    try {
      validateSafeFileName(fileName);
      const status = await getImageStatus(fileName);
      if (status !== 'archived') {
        results.push({ fileName, status: 'skipped', reason: 'MEDIA_NOT_ARCHIVED' });
        continue;
      }

      await deleteLocalImage(fileName);
      results.push({ fileName, status: 'success' });
    } catch (error) {
      const reason = getMediaErrorCode(error);
      results.push({
        fileName,
        status: reason === 'MEDIA_USED_BY_HOME' ? 'skipped' : 'failed',
        reason,
      });
    }
  }

  return createBatchSummary(results);
}
