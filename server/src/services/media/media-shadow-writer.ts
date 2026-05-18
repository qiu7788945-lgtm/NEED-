import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { getDbPool, getSafeDatabaseConfig } from '../../db/client.js';
import {
  buildMediaLibraryOwnershipProfile,
  classifyMediaLibraryOwnership,
  normalizeMediaLibraryCategory,
} from '../data-source/media-library-content-source.js';
import { logger } from '../../utils/logger.js';

type UnknownRecord = Record<string, unknown>;

export interface MediaUploadShadowRecord {
  fileName: string;
  originalName: string;
  displayName: string;
  fileType: string;
  url: string;
  size: number;
  mimeType: string;
  width: number | null;
  height: number | null;
  duration: number | null;
  category: string;
  alt: string;
  description: string;
  ownerType: string;
  ownerId: number | null;
  ownerSlug: string;
  groupKey: string;
  slotNo: number | null;
  caption: string;
  enabled: boolean;
  sortOrder: number;
  status: string;
  createdAt?: string;
}

type MediaStableKey =
  | { type: 'public_url'; value: string }
  | { type: 'file_path'; value: string }
  | { type: 'file_name_size'; value: string; fileName: string; fileSize: number };

type MysqlMediaRow = RowDataPacket & {
  id: unknown;
  file_name: unknown;
  file_path: unknown;
  public_url: unknown;
  file_size: unknown;
  category: unknown;
  metadata_json: unknown;
};

const uploadShadowWarningIntervalMs = 60 * 1000;
let lastUploadShadowWarningAt = 0;

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown, fallback = 0) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function warnUploadShadow(reason: string, error?: unknown, meta: UnknownRecord = {}) {
  const now = Date.now();
  if (now - lastUploadShadowWarningAt < uploadShadowWarningIntervalMs) {
    return;
  }

  lastUploadShadowWarningAt = now;
  logger.warn('media-library upload MySQL shadow write skipped.', {
    reason,
    message: error instanceof Error ? error.message : error ? String(error) : undefined,
    ...meta,
  });
}

function fileExtFromName(fileName: string) {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex >= 0 ? fileName.slice(dotIndex + 1).toLowerCase() : '';
}

function normalizeMediaPath(value: string) {
  const normalized = value.trim().replace(/\\/g, '/');
  if (!normalized) {
    return '';
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(normalized) || normalized.startsWith('/')) {
    return normalized;
  }

  return normalized.startsWith('uploads/') ? `/${normalized}` : normalized;
}

function normalizeStatus(value: string) {
  const status = value.trim().toLowerCase();
  if (status === 'inactive') {
    return 'archived';
  }

  return status || 'active';
}

function normalizeCategoryForWrite(category: string) {
  const normalized = category.trim() || 'general';
  return normalized.length > 80 ? normalized.slice(0, 80) : normalized;
}

function isoDateOrNull(value: string | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function buildStableKey(input: { publicUrl: string; filePath: string; fileName: string; fileSize: number }): MediaStableKey | null {
  if (input.publicUrl) {
    return { type: 'public_url', value: input.publicUrl };
  }

  if (input.filePath) {
    return { type: 'file_path', value: input.filePath };
  }

  if (input.fileName && input.fileSize >= 0) {
    return {
      type: 'file_name_size',
      value: `${input.fileName}#${input.fileSize}`,
      fileName: input.fileName,
      fileSize: input.fileSize,
    };
  }

  return null;
}

function parseJsonColumn(value: unknown): unknown {
  if (Buffer.isBuffer(value)) {
    return parseJsonColumn(value.toString('utf8'));
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

function sourceRecordFromUpload(record: MediaUploadShadowRecord): UnknownRecord {
  return {
    fileName: record.fileName,
    originalName: record.originalName,
    displayName: record.displayName,
    fileType: record.fileType,
    url: record.url,
    size: record.size,
    mimeType: record.mimeType,
    width: record.width,
    height: record.height,
    duration: record.duration,
    category: record.category,
    alt: record.alt,
    description: record.description,
    ownerType: record.ownerType,
    ownerId: record.ownerId,
    ownerSlug: record.ownerSlug,
    groupKey: record.groupKey,
    slotNo: record.slotNo,
    caption: record.caption,
    enabled: record.enabled,
    sortOrder: record.sortOrder,
    status: record.status,
    createdAt: record.createdAt,
  };
}

function metadataJson(record: MediaUploadShadowRecord, stableKey: MediaStableKey): string {
  return JSON.stringify({
    moduleName: 'media-library',
    sourceKey: record.fileName,
    displayName: record.displayName,
    title: record.displayName,
    fileType: record.fileType,
    ownerType: record.ownerType,
    ownerId: record.ownerId,
    ownerSlug: record.ownerSlug,
    groupKey: record.groupKey,
    slotNo: record.slotNo,
    caption: record.caption,
    enabled: record.enabled,
    sortOrder: record.sortOrder,
    createdAt: record.createdAt,
    normalizedCategory: normalizeMediaLibraryCategory(record.category),
    shadowWrite: true,
    shadowWriteStage: '22-5C-4C',
    dedupeKey: {
      type: stableKey.type,
      value: stableKey.value,
    },
    sourceRecord: sourceRecordFromUpload(record),
  });
}

function validateRecord(record: MediaUploadShadowRecord) {
  if (!record.fileName || !record.url || !record.mimeType || record.size < 0 || !record.category || !record.status) {
    return 'uploaded media is missing fileName, url, mimeType, size, category, or status';
  }

  return '';
}

async function findExistingMediaRows(stableKey: MediaStableKey): Promise<MysqlMediaRow[]> {
  const pool = getDbPool();

  if (stableKey.type === 'public_url') {
    const [rows] = await pool.query<MysqlMediaRow[]>(
      `SELECT id, file_name, file_path, public_url, file_size, category, metadata_json
       FROM media_files
       WHERE public_url = :publicUrl OR file_path = :publicUrl
       ORDER BY id ASC`,
      { publicUrl: stableKey.value },
    );
    return rows;
  }

  if (stableKey.type === 'file_path') {
    const [rows] = await pool.query<MysqlMediaRow[]>(
      `SELECT id, file_name, file_path, public_url, file_size, category, metadata_json
       FROM media_files
       WHERE file_path = :filePath OR public_url = :filePath
       ORDER BY id ASC`,
      { filePath: stableKey.value },
    );
    return rows;
  }

  const [rows] = await pool.query<MysqlMediaRow[]>(
    `SELECT id, file_name, file_path, public_url, file_size, category, metadata_json
     FROM media_files
     WHERE file_name = :fileName AND file_size = :fileSize
     ORDER BY id ASC`,
    {
      fileName: stableKey.fileName,
      fileSize: stableKey.fileSize,
    },
  );
  return rows;
}

function existingRowIsSafeToUpdate(row: MysqlMediaRow) {
  const category = asString(row.category);
  const metadata = parseJsonColumn(row.metadata_json);
  const ownership = classifyMediaLibraryOwnership(metadata, category);
  const profile = buildMediaLibraryOwnershipProfile(metadata, category);

  return {
    ok: ownership.kind === 'likelyMediaLibrary' && profile.conflicts.length === 0,
    reason: ownership.kind === 'likelyMediaLibrary'
      ? profile.conflicts.join(' ')
      : `matched media_files#${asNumber(row.id)} is ${ownership.kind}`,
  };
}

async function insertMediaFile(record: MediaUploadShadowRecord, stableKey: MediaStableKey) {
  const pool = getDbPool();
  const publicUrl = normalizeMediaPath(record.url);
  const filePath = publicUrl;
  const createdAt = isoDateOrNull(record.createdAt);

  await pool.execute<ResultSetHeader>(
    `INSERT INTO media_files (
      file_name,
      original_name,
      file_path,
      public_url,
      mime_type,
      file_ext,
      file_size,
      width,
      height,
      duration_seconds,
      category,
      alt_text,
      description,
      metadata_json,
      storage_provider,
      status,
      created_at,
      updated_at,
      deleted_at
    ) VALUES (
      :fileName,
      :originalName,
      :filePath,
      :publicUrl,
      :mimeType,
      :fileExt,
      :fileSize,
      :width,
      :height,
      :durationSeconds,
      :category,
      :altText,
      :description,
      :metadataJson,
      'local',
      :status,
      COALESCE(:createdAt, CURRENT_TIMESTAMP),
      CURRENT_TIMESTAMP,
      NULL
    )`,
    {
      fileName: record.fileName,
      originalName: record.originalName || record.fileName,
      filePath,
      publicUrl,
      mimeType: record.mimeType,
      fileExt: fileExtFromName(record.fileName),
      fileSize: record.size,
      width: record.width,
      height: record.height,
      durationSeconds: record.duration,
      category: normalizeCategoryForWrite(record.category),
      altText: record.alt,
      description: record.description,
      metadataJson: metadataJson(record, stableKey),
      status: normalizeStatus(record.status),
      createdAt,
    },
  );
}

async function updateMediaFile(row: MysqlMediaRow, record: MediaUploadShadowRecord, stableKey: MediaStableKey) {
  const pool = getDbPool();
  const publicUrl = normalizeMediaPath(record.url);
  const filePath = publicUrl;

  await pool.execute<ResultSetHeader>(
    `UPDATE media_files
     SET file_name = :fileName,
         original_name = :originalName,
         file_path = COALESCE(:filePath, file_path),
         public_url = COALESCE(:publicUrl, public_url),
         mime_type = :mimeType,
         file_ext = :fileExt,
         file_size = :fileSize,
         width = :width,
         height = :height,
         duration_seconds = :durationSeconds,
         category = :category,
         alt_text = :altText,
         description = :description,
         metadata_json = :metadataJson,
         storage_provider = 'local',
         status = :status,
         deleted_at = NULL
     WHERE id = :id`,
    {
      id: asNumber(row.id),
      fileName: record.fileName,
      originalName: record.originalName || record.fileName,
      filePath,
      publicUrl,
      mimeType: record.mimeType,
      fileExt: fileExtFromName(record.fileName),
      fileSize: record.size,
      width: record.width,
      height: record.height,
      durationSeconds: record.duration,
      category: normalizeCategoryForWrite(record.category),
      altText: record.alt,
      description: record.description,
      metadataJson: metadataJson(record, stableKey),
      status: normalizeStatus(record.status),
    },
  );
}

async function writeUploadShadow(record: MediaUploadShadowRecord) {
  const config = getSafeDatabaseConfig();
  if (!config.configured) {
    warnUploadShadow('mysql-not-configured');
    return;
  }

  const validationError = validateRecord(record);
  if (validationError) {
    warnUploadShadow('incomplete-upload-record', undefined, { fileName: record.fileName, validationError });
    return;
  }

  const publicUrl = normalizeMediaPath(record.url);
  const stableKey = buildStableKey({
    publicUrl,
    filePath: publicUrl,
    fileName: record.fileName,
    fileSize: record.size,
  });

  if (!stableKey) {
    warnUploadShadow('missing-stable-key', undefined, { fileName: record.fileName });
    return;
  }

  const matches = await findExistingMediaRows(stableKey);
  if (matches.length > 1) {
    warnUploadShadow('duplicate-stable-key-match', undefined, {
      fileName: record.fileName,
      stableKey: `${stableKey.type}:${stableKey.value}`,
      matchCount: matches.length,
    });
    return;
  }

  if (matches.length === 0) {
    await insertMediaFile(record, stableKey);
    return;
  }

  const safety = existingRowIsSafeToUpdate(matches[0]);
  if (!safety.ok) {
    warnUploadShadow('matched-row-not-safe-to-update', undefined, {
      fileName: record.fileName,
      reason: safety.reason,
    });
    return;
  }

  await updateMediaFile(matches[0], record, stableKey);
}

export async function shadowWriteUploadedMedia(record: MediaUploadShadowRecord): Promise<void> {
  try {
    await writeUploadShadow(record);
  } catch (error) {
    warnUploadShadow('mysql-shadow-write-failed', error, { fileName: record.fileName });
  }
}
