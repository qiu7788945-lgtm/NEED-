import 'dotenv/config';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RowDataPacket } from 'mysql2/promise';
import { closeDbPool, getDbPool, getSafeDatabaseConfig } from '../db/client.js';
import {
  buildMediaLibraryOwnershipProfile,
  classifyMediaLibraryOwnership,
  normalizeMediaLibraryCategory,
  type MediaLibraryOwnershipKind,
  type NormalizedMediaLibraryOwnership,
} from '../services/data-source/media-library-content-source.js';

type UnknownRecord = Record<string, unknown>;
type ShadowAction = 'all' | 'upload' | 'metadata' | 'archive' | 'restore' | 'delete';
type PlanDecision = 'insert' | 'update' | 'skip' | 'conflict' | 'warning';
type DiffSeverity = 'update' | 'normalized_match' | 'warning';
type DeleteRiskDecision = 'blocked' | 'needs_review' | 'safe_candidate';

type MediaStableKey =
  | {
      type: 'public_url';
      value: string;
    }
  | {
      type: 'file_path';
      value: string;
    }
  | {
      type: 'file_name_size';
      value: string;
      fileName: string;
      fileSize: number;
    };

interface MediaLibraryEntry {
  sourceKey: string;
  record: UnknownRecord;
}

interface UploadFileInfo {
  expectedPath: string | null;
  exists: boolean;
  size: number | null;
  warning: string | null;
}

interface PlannedMediaFile {
  sourceKey: string;
  sourceRecord: UnknownRecord;
  action: ShadowAction;
  fileName: string | null;
  originalName: string | null;
  displayName: string | null;
  fileType: string | null;
  filePathForWrite: string | null;
  publicUrlForWrite: string | null;
  mimeType: string | null;
  fileExt: string | null;
  fileSize: number;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  category: string;
  normalizedCategory: string;
  altText: string | null;
  description: string | null;
  status: string;
  metadataJson: UnknownRecord;
  stableKey: MediaStableKey | null;
  uploadFile: UploadFileInfo;
  sourceWarnings: string[];
}

interface MysqlMediaRow extends RowDataPacket {
  id: unknown;
  file_name: unknown;
  original_name: unknown;
  file_path: unknown;
  public_url: unknown;
  mime_type: unknown;
  file_ext: unknown;
  file_size: unknown;
  width: unknown;
  height: unknown;
  duration_seconds: unknown;
  category: unknown;
  alt_text: unknown;
  description: unknown;
  usage_count: unknown;
  metadata_json: unknown;
  status: unknown;
  created_at: unknown;
  updated_at: unknown;
  deleted_at: unknown;
}

interface MysqlRowProfile {
  row: MysqlMediaRow;
  metadataJson: unknown;
  ownershipKind: MediaLibraryOwnershipKind;
  ownershipReason: string;
  normalizedOwnership: NormalizedMediaLibraryOwnership;
  ownershipConflicts: string[];
}

interface FieldDiff {
  fieldName: string;
  expected: unknown;
  actual: unknown;
  normalizedExpected?: unknown;
  normalizedActual?: unknown;
  severity: DiffSeverity;
  message: string;
}

interface ShadowPlan {
  sourceKey: string;
  fileName: string | null;
  stableKey: string | null;
  action: ShadowAction;
  decision: PlanDecision;
  mysqlId: number | null;
  plannedOperation: 'insert' | 'update' | 'soft-delete' | 'none';
  reasons: string[];
  warnings: string[];
  conflicts: string[];
  diffs: FieldDiff[];
  expected: {
    publicUrl: string | null;
    filePath: string | null;
    category: string;
    normalizedCategory: string;
    status: string;
    metadataModuleName: string;
  };
  mysql?: ReturnType<typeof summarizeMysqlRow>;
}

interface CliOptions {
  moduleName: string;
  action: ShadowAction;
  writeRequested: boolean;
  target: string | null;
}

interface DeleteReference {
  source: string;
  sourceFile: string;
  jsonPath: string;
  matchedBy: string;
  value: string;
}

interface CoverageDetail {
  covered: boolean;
  reason: string;
  sourceFile?: string;
}

interface DeleteRiskItem {
  url: string | null;
  fileName: string | null;
  status: string;
  decision: DeleteRiskDecision;
  reasons: string[];
  references: DeleteReference[];
  mysql: {
    matched: boolean;
    matchCount: number;
    status: string | null;
    ownershipKind: MediaLibraryOwnershipKind | null;
    hasConflict: boolean;
    stableKeyConsistent: boolean;
    ids: number[];
  };
  uploadFile: {
    exists: boolean;
    path: string | null;
    size: number | null;
  };
}

interface SourceStringValue {
  source: string;
  sourceFile: string;
  jsonPath: string;
  value: string;
}

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const dataDir = path.join(serverRoot, 'data');
const mediaIndexPath = path.join(serverRoot, 'data', 'media-library.json');
const uploadsRoot = path.join(serverRoot, 'uploads');
const imageUploadDir = path.join(uploadsRoot, 'images');
const videoUploadDir = path.join(uploadsRoot, 'videos');
const allowedActions = new Set<ShadowAction>(['all', 'upload', 'metadata', 'archive', 'restore', 'delete']);

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function firstString(record: UnknownRecord, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = asString(record[key]);
    if (value) {
      return value;
    }
  }

  return null;
}

function asNumber(value: unknown, fallback = 0): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function asUnsignedInteger(value: unknown): number | null {
  const numberValue = asNullableNumber(value);
  if (numberValue === null || numberValue < 0) {
    return null;
  }

  return Math.trunc(numberValue);
}

function asBoolean(value: unknown, fallback = true): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'enabled', 'active'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'disabled', 'inactive'].includes(normalized)) {
      return false;
    }
  }

  return fallback;
}

function normalizeMediaPath(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/\\/g, '/');
  if (!normalized) {
    return null;
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(normalized) || normalized.startsWith('/')) {
    return normalized;
  }

  return normalized.startsWith('uploads/') ? `/${normalized}` : normalized;
}

function normalizeFileName(publicUrl: string | null, fallback: string | null): string | null {
  if (fallback) {
    return fallback;
  }

  if (!publicUrl) {
    return null;
  }

  const parts = publicUrl.split('/').filter(Boolean);
  return parts.at(-1) ?? null;
}

function extFromFileName(fileName: string): string | null {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex >= 0 ? fileName.slice(dotIndex + 1).toLowerCase() : null;
}

function mimeFromFileName(fileName: string): string | null {
  const ext = extFromFileName(fileName);
  if (!ext) {
    return null;
  }

  if (['jpg', 'jpeg'].includes(ext)) {
    return 'image/jpeg';
  }

  if (ext === 'png') {
    return 'image/png';
  }

  if (ext === 'webp') {
    return 'image/webp';
  }

  if (ext === 'mp4') {
    return 'video/mp4';
  }

  if (ext === 'webm') {
    return 'video/webm';
  }

  return null;
}

function normalizeStatus(value: unknown): string {
  const status = asString(value).toLowerCase();
  if (status === 'inactive') {
    return 'archived';
  }

  return status || 'active';
}

function getRecordStatus(record: UnknownRecord): string {
  const status = firstString(record, 'status');
  if (status) {
    return normalizeStatus(status);
  }

  return asBoolean(record.enabled ?? record.is_enabled, true) ? 'active' : 'archived';
}

function stableKeyLabel(stableKey: MediaStableKey | null): string | null {
  if (!stableKey) {
    return null;
  }

  return `${stableKey.type}:${stableKey.value}`;
}

function buildMediaStableKey(input: {
  publicUrl: string | null;
  filePath: string | null;
  fileName: string | null;
  fileSize: number;
}): MediaStableKey | null {
  if (input.publicUrl) {
    return {
      type: 'public_url',
      value: input.publicUrl,
    };
  }

  if (input.filePath) {
    return {
      type: 'file_path',
      value: input.filePath,
    };
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
  return trimmed ? JSON.parse(trimmed) : undefined;
}

function pathIsInside(childPath: string, parentPath: string): boolean {
  const relative = path.relative(parentPath, childPath);
  return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function uploadPathFromPublicUrl(publicUrl: string | null, fileName: string | null, fileType: string | null): string | null {
  if (publicUrl?.startsWith('/uploads/')) {
    const resolved = path.resolve(serverRoot, `.${publicUrl}`);
    return pathIsInside(resolved, uploadsRoot) ? resolved : null;
  }

  if (!fileName) {
    return null;
  }

  if (fileType === 'video') {
    return path.join(videoUploadDir, fileName);
  }

  return path.join(imageUploadDir, fileName);
}

async function readUploadFileInfo(publicUrl: string | null, fileName: string | null, fileType: string | null): Promise<UploadFileInfo> {
  const expectedPath = uploadPathFromPublicUrl(publicUrl, fileName, fileType);

  if (!expectedPath) {
    return {
      expectedPath: null,
      exists: false,
      size: null,
      warning: 'No safe local upload path could be derived from the media record.',
    };
  }

  try {
    const stat = await fs.stat(expectedPath);
    return {
      expectedPath,
      exists: stat.isFile(),
      size: stat.isFile() ? stat.size : null,
      warning: stat.isFile() ? null : 'Resolved upload path exists but is not a file.',
    };
  } catch (error) {
    const code = isRecord(error) ? error.code : undefined;
    return {
      expectedPath,
      exists: false,
      size: null,
      warning: code === 'ENOENT'
        ? 'Upload file is missing on disk.'
        : `Upload file stat failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function buildMediaLibraryEntries(data: unknown): MediaLibraryEntry[] {
  if (Array.isArray(data)) {
    return data
      .map((item, index) => {
        if (!isRecord(item)) {
          return null;
        }

        return {
          sourceKey: firstString(item, 'sourceKey', 'source_key', 'key', 'id', 'fileName', 'file_name') ?? `index-${index + 1}`,
          record: item,
        };
      })
      .filter((entry): entry is MediaLibraryEntry => Boolean(entry));
  }

  if (!isRecord(data)) {
    return [];
  }

  return Object.entries(data)
    .map(([sourceKey, item]) => {
      if (!isRecord(item)) {
        return null;
      }

      return {
        sourceKey,
        record: item,
      };
    })
    .filter((entry): entry is MediaLibraryEntry => Boolean(entry));
}

async function readMediaLibraryJson(): Promise<{ sourceCount: number; entries: MediaLibraryEntry[] }> {
  const raw = await fs.readFile(mediaIndexPath, 'utf8');
  const data = JSON.parse(raw) as unknown;
  const entries = buildMediaLibraryEntries(data);

  return {
    sourceCount: isRecord(data) ? Object.keys(data).length : Array.isArray(data) ? data.length : 0,
    entries,
  };
}

function fileNameFromUrl(value: string | null): string {
  if (!value) {
    return '';
  }

  const normalized = normalizeMediaPath(value) ?? value;
  const withoutQuery = normalized.split('?')[0] ?? normalized;
  const fileName = withoutQuery.split(/[\\/]/).filter(Boolean).pop() ?? '';

  try {
    return decodeURIComponent(fileName);
  } catch {
    return fileName;
  }
}

function truncateValue(value: string, maxLength = 220): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function normalizeTarget(value: string | null): { raw: string; normalizedPath: string; fileName: string } | null {
  const raw = value?.trim() ?? '';
  if (!raw) {
    return null;
  }

  const normalizedPath = normalizeMediaPath(raw) ?? raw.replace(/\\/g, '/');
  return {
    raw,
    normalizedPath,
    fileName: fileNameFromUrl(normalizedPath) || raw,
  };
}

function targetMatchesPrepared(prepared: PlannedMediaFile, target: ReturnType<typeof normalizeTarget>) {
  if (!target) {
    return true;
  }

  const values = [
    prepared.fileName,
    prepared.publicUrlForWrite,
    prepared.filePathForWrite,
    prepared.uploadFile.expectedPath ? path.basename(prepared.uploadFile.expectedPath) : null,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  const normalizedValues = new Set<string>();

  for (const value of values) {
    const normalizedPath = normalizeMediaPath(value) ?? value.replace(/\\/g, '/');
    normalizedValues.add(value);
    normalizedValues.add(normalizedPath);
    normalizedValues.add(fileNameFromUrl(normalizedPath));
  }

  return normalizedValues.has(target.raw)
    || normalizedValues.has(target.normalizedPath)
    || normalizedValues.has(target.fileName);
}

const deleteReferenceSources = [
  {
    source: 'homeVideo',
    filePath: path.join(dataDir, 'home-video.json'),
    coverageKeys: ['homeVideo'],
  },
  {
    source: 'homeInteractiveImages',
    filePath: path.join(dataDir, 'home-interactive-images.json'),
    coverageKeys: ['homeInteractiveImages'],
  },
  {
    source: 'companyAssets',
    filePath: path.join(dataDir, 'company-assets.json'),
    coverageKeys: ['companyAssets'],
  },
  {
    source: 'cases',
    filePath: path.join(dataDir, 'cases.json'),
    coverageKeys: ['cases', 'caseImages'],
  },
  {
    source: 'solutions',
    filePath: path.join(dataDir, 'solutions.json'),
    coverageKeys: ['solutions', 'solutionGroups', 'solutionMediaItems'],
  },
  {
    source: 'scenarioDetailPages',
    filePath: path.join(dataDir, 'scenario-detail-pages.json'),
    coverageKeys: ['scenarioDetailPages'],
  },
  {
    source: 'pages',
    filePath: path.join(dataDir, 'pages.json'),
    coverageKeys: ['pages'],
  },
  {
    source: 'articles',
    filePath: path.join(dataDir, 'articles.json'),
    coverageKeys: ['articles', 'seoOg'],
  },
  {
    source: 'contactInfo',
    filePath: path.join(dataDir, 'contact-info.json'),
    coverageKeys: ['contactInfo', 'socialQr'],
  },
  {
    source: 'publicHomeMediaSeed',
    filePath: path.join(dataDir, 'seeds', 'public-home-media.seed.json'),
    coverageKeys: ['contactInfo', 'socialQr'],
  },
] as const;

function collectJsonStrings(
  value: unknown,
  input: {
    source: string;
    sourceFile: string;
    jsonPath: string;
    output: SourceStringValue[];
  },
) {
  if (typeof value === 'string') {
    input.output.push({
      source: input.source,
      sourceFile: input.sourceFile,
      jsonPath: input.jsonPath,
      value,
    });
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectJsonStrings(item, {
        ...input,
        jsonPath: `${input.jsonPath}[${index}]`,
      });
    });
    return;
  }

  if (isRecord(value)) {
    for (const [key, nextValue] of Object.entries(value)) {
      collectJsonStrings(nextValue, {
        ...input,
        jsonPath: input.jsonPath ? `${input.jsonPath}.${key}` : key,
      });
    }
  }
}

async function readDeleteReferenceStrings(): Promise<{
  coverage: Record<string, boolean>;
  coverageDetails: Record<string, CoverageDetail>;
  sourceStrings: SourceStringValue[];
}> {
  const coverage: Record<string, boolean> = {
    mediaLibraryJson: true,
    uploads: true,
    mysqlMediaFiles: true,
    homeVideo: false,
    homeInteractiveImages: false,
    companyAssets: false,
    cases: false,
    caseImages: false,
    solutions: false,
    solutionGroups: false,
    solutionMediaItems: false,
    scenarioDetailPages: false,
    pages: false,
    articles: false,
    contactInfo: false,
    socialQr: false,
    seoOg: false,
  };
  const coverageDetails: Record<string, CoverageDetail> = {
    mediaLibraryJson: { covered: true, reason: 'media-library source JSON was read as the checked item list.', sourceFile: mediaIndexPath },
    uploads: { covered: true, reason: 'upload file existence and stat are checked per item.', sourceFile: uploadsRoot },
    mysqlMediaFiles: { covered: true, reason: 'media_files rows are read for stable-key, status, and ownership checks.' },
  };
  const sourceStrings: SourceStringValue[] = [];

  for (const source of deleteReferenceSources) {
    const relativePath = path.relative(serverRoot, source.filePath).replace(/\\/g, '/');
    try {
      const raw = await fs.readFile(source.filePath, 'utf8');
      const data = raw.trim() ? JSON.parse(raw) as unknown : null;
      collectJsonStrings(data, {
        source: source.source,
        sourceFile: relativePath,
        jsonPath: '',
        output: sourceStrings,
      });

      for (const key of source.coverageKeys) {
        coverage[key] = true;
        coverageDetails[key] = {
          covered: true,
          reason: 'source_scanned',
          sourceFile: relativePath,
        };
      }
    } catch (error) {
      const code = isRecord(error) ? error.code : undefined;
      const sourceMissing = code === 'ENOENT';

      for (const key of source.coverageKeys) {
        const existing = coverageDetails[key];
        if (existing?.covered) {
          continue;
        }

        coverage[key] = sourceMissing;
        coverageDetails[key] = {
          covered: sourceMissing,
          reason: sourceMissing ? 'source_missing_empty' : `source_read_failed: ${error instanceof Error ? error.message : String(error)}`,
          sourceFile: relativePath,
        };
      }
    }
  }

  return {
    coverage,
    coverageDetails,
    sourceStrings,
  };
}

function mediaNeedles(prepared: PlannedMediaFile, matches: MysqlMediaRow[]) {
  const needles = new Map<string, string>();

  function add(label: string, value: unknown) {
    const text = asString(value);
    if (!text) {
      return;
    }

    needles.set(text, label);
    const normalizedPath = normalizeMediaPath(text);
    if (normalizedPath) {
      needles.set(normalizedPath, label);
      const withoutLeadingSlash = normalizedPath.replace(/^\//, '');
      if (withoutLeadingSlash) {
        needles.set(withoutLeadingSlash, label);
      }
      const fileName = fileNameFromUrl(normalizedPath);
      if (fileName) {
        needles.set(fileName, 'fileName');
      }
    }
  }

  add('publicUrl', prepared.publicUrlForWrite);
  add('filePath', prepared.filePathForWrite);
  add('fileName', prepared.fileName);

  for (const row of matches) {
    add('mysql.public_url', row.public_url);
    add('mysql.file_path', row.file_path);
    add('mysql.file_name', row.file_name);
  }

  return needles;
}

function findReferencesForPrepared(
  prepared: PlannedMediaFile,
  matches: MysqlMediaRow[],
  sourceStrings: SourceStringValue[],
): DeleteReference[] {
  const needles = mediaNeedles(prepared, matches);
  const references: DeleteReference[] = [];
  const seen = new Set<string>();

  for (const sourceString of sourceStrings) {
    for (const [needle, label] of needles.entries()) {
      if (!needle || !sourceString.value.includes(needle)) {
        continue;
      }

      const key = `${sourceString.source}:${sourceString.jsonPath}:${needle}`;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      references.push({
        source: sourceString.source,
        sourceFile: sourceString.sourceFile,
        jsonPath: sourceString.jsonPath || '$',
        matchedBy: label,
        value: truncateValue(sourceString.value),
      });
    }
  }

  return references;
}

function plannedStatusForAction(action: ShadowAction, record: UnknownRecord): string {
  if (action === 'archive') {
    return 'archived';
  }

  if (action === 'restore') {
    return 'active';
  }

  return getRecordStatus(record);
}

function buildMetadataJson(prepared: Omit<PlannedMediaFile, 'metadataJson'>): UnknownRecord {
  return {
    moduleName: 'media-library',
    sourceKey: prepared.sourceKey,
    displayName: prepared.displayName,
    title: firstString(prepared.sourceRecord, 'title'),
    fileType: prepared.fileType,
    ownerType: firstString(prepared.sourceRecord, 'ownerType', 'owner_type'),
    ownerId: prepared.sourceRecord.ownerId ?? prepared.sourceRecord.owner_id ?? null,
    ownerSlug: firstString(prepared.sourceRecord, 'ownerSlug', 'owner_slug'),
    groupKey: firstString(prepared.sourceRecord, 'groupKey', 'group_key'),
    slotNo: asUnsignedInteger(prepared.sourceRecord.slotNo ?? prepared.sourceRecord.slot_no),
    caption: firstString(prepared.sourceRecord, 'caption'),
    enabled: asBoolean(prepared.sourceRecord.enabled ?? prepared.sourceRecord.is_enabled, true),
    sortOrder: asUnsignedInteger(prepared.sourceRecord.sortOrder ?? prepared.sourceRecord.sort_order),
    createdAt: firstString(prepared.sourceRecord, 'createdAt', 'created_at'),
    dedupeKey: prepared.stableKey
      ? {
          type: prepared.stableKey.type,
          value: prepared.stableKey.value,
        }
      : null,
    sourceRecord: prepared.sourceRecord,
  };
}

async function prepareMediaFile(entry: MediaLibraryEntry, action: ShadowAction): Promise<PlannedMediaFile> {
  const publicUrl = normalizeMediaPath(firstString(entry.record, 'publicUrl', 'public_url', 'url'));
  const sourceFilePath = normalizeMediaPath(firstString(entry.record, 'filePath', 'file_path', 'path'));
  const fileName = normalizeFileName(
    publicUrl,
    firstString(entry.record, 'fileName', 'file_name', 'storageFileName', 'storage_file_name', 'name'),
  ) ?? entry.sourceKey;
  const fileType = firstString(entry.record, 'fileType', 'file_type')
    ?? (mimeFromFileName(fileName)?.startsWith('video/') ? 'video' : 'image');
  const uploadFile = await readUploadFileInfo(publicUrl, fileName, fileType);
  const sourceWarnings: string[] = [];
  const jsonFileSize = asUnsignedInteger(entry.record.fileSize ?? entry.record.file_size ?? entry.record.size);
  const fileSize = jsonFileSize ?? uploadFile.size ?? 0;
  const category = firstString(entry.record, 'category', 'fileType', 'file_type') ?? 'general';
  const fileExt = firstString(entry.record, 'fileExt', 'file_ext') ?? extFromFileName(fileName);
  const mimeType = firstString(entry.record, 'mimeType', 'mime_type') ?? mimeFromFileName(fileName);
  const stableKey = buildMediaStableKey({
    publicUrl,
    filePath: sourceFilePath,
    fileName,
    fileSize,
  });

  if (uploadFile.warning) {
    sourceWarnings.push(uploadFile.warning);
  }

  if (jsonFileSize !== null && uploadFile.size !== null && jsonFileSize !== uploadFile.size) {
    sourceWarnings.push(`JSON file size (${jsonFileSize}) differs from upload file size (${uploadFile.size}).`);
  }

  const preparedWithoutMetadata: Omit<PlannedMediaFile, 'metadataJson'> = {
    sourceKey: entry.sourceKey,
    sourceRecord: entry.record,
    action,
    fileName,
    originalName: firstString(entry.record, 'originalName', 'original_name') ?? fileName,
    displayName: firstString(entry.record, 'displayName', 'display_name', 'title') ?? fileName,
    fileType,
    filePathForWrite: sourceFilePath ?? publicUrl,
    publicUrlForWrite: publicUrl ?? sourceFilePath,
    mimeType,
    fileExt,
    fileSize,
    width: asUnsignedInteger(entry.record.width),
    height: asUnsignedInteger(entry.record.height),
    durationSeconds: asNullableNumber(entry.record.durationSeconds ?? entry.record.duration_seconds ?? entry.record.duration),
    category,
    normalizedCategory: normalizeMediaLibraryCategory(category),
    altText: firstString(entry.record, 'altText', 'alt_text', 'alt', 'displayName', 'display_name', 'title'),
    description: firstString(entry.record, 'description', 'caption'),
    status: plannedStatusForAction(action, entry.record),
    stableKey,
    uploadFile,
    sourceWarnings,
  };

  return {
    ...preparedWithoutMetadata,
    metadataJson: buildMetadataJson(preparedWithoutMetadata),
  };
}

async function readMysqlRows(): Promise<MysqlMediaRow[]> {
  const pool = getDbPool();
  const [rows] = await pool.query<MysqlMediaRow[]>(
    `SELECT id, file_name, original_name, file_path, public_url, mime_type, file_ext,
            file_size, width, height, duration_seconds, category, alt_text, description,
            usage_count, metadata_json, status, created_at, updated_at, deleted_at
     FROM media_files
     ORDER BY id ASC`,
  );

  return rows;
}

function buildRowProfile(row: MysqlMediaRow): MysqlRowProfile {
  const metadataJson = parseJsonColumn(row.metadata_json);
  const category = asString(row.category);
  const ownershipProfile = buildMediaLibraryOwnershipProfile(metadataJson, category);
  const ownership = classifyMediaLibraryOwnership(metadataJson, category);

  return {
    row,
    metadataJson,
    ownershipKind: ownership.kind,
    ownershipReason: ownership.reason,
    normalizedOwnership: ownershipProfile.normalizedOwnership,
    ownershipConflicts: ownershipProfile.conflicts,
  };
}

function mysqlRowId(row: MysqlMediaRow): number {
  return asNumber(row.id);
}

function mysqlDeletedAt(row: MysqlMediaRow): string {
  if (row.deleted_at instanceof Date && !Number.isNaN(row.deleted_at.getTime())) {
    return row.deleted_at.toISOString();
  }

  return asString(row.deleted_at);
}

function mysqlStableKeyValue(row: MysqlMediaRow): string {
  const publicUrl = asString(row.public_url);
  const filePath = asString(row.file_path);
  const fileName = asString(row.file_name);
  const fileSize = asNumber(row.file_size);

  if (publicUrl) {
    return `public_url:${publicUrl}`;
  }

  if (filePath) {
    return `file_path:${filePath}`;
  }

  return `file_name_size:${fileName}#${fileSize}`;
}

function summarizeMysqlRow(profile: MysqlRowProfile) {
  const row = profile.row;
  const category = asString(row.category);

  return {
    id: mysqlRowId(row),
    stableKey: mysqlStableKeyValue(row),
    fileName: asString(row.file_name),
    publicUrl: asString(row.public_url),
    filePath: asString(row.file_path),
    fileSize: asNumber(row.file_size),
    category,
    normalizedCategory: normalizeMediaLibraryCategory(category),
    status: normalizeStatus(row.status),
    deletedAt: mysqlDeletedAt(row) || null,
    ownershipKind: profile.ownershipKind,
    ownershipReason: profile.ownershipReason,
    normalizedOwnership: profile.normalizedOwnership,
    ownershipConflicts: profile.ownershipConflicts,
  };
}

function buildMysqlLookup(rows: MysqlMediaRow[]) {
  const publicUrl = new Map<string, MysqlMediaRow[]>();
  const filePath = new Map<string, MysqlMediaRow[]>();
  const fileNameSize = new Map<string, MysqlMediaRow[]>();

  function add(map: Map<string, MysqlMediaRow[]>, key: string, row: MysqlMediaRow) {
    if (!key) {
      return;
    }

    const current = map.get(key) ?? [];
    current.push(row);
    map.set(key, current);
  }

  for (const row of rows) {
    add(publicUrl, asString(row.public_url), row);
    add(filePath, asString(row.file_path), row);
    const fileName = asString(row.file_name);
    const size = asNumber(row.file_size);
    if (fileName) {
      add(fileNameSize, `${fileName}#${size}`, row);
    }
  }

  return {
    publicUrl,
    filePath,
    fileNameSize,
  };
}

function findMysqlMatches(
  lookup: ReturnType<typeof buildMysqlLookup>,
  stableKey: MediaStableKey | null,
): MysqlMediaRow[] {
  if (!stableKey) {
    return [];
  }

  const matches = new Map<number, MysqlMediaRow>();

  function addRows(rows: MysqlMediaRow[] | undefined) {
    for (const row of rows ?? []) {
      matches.set(mysqlRowId(row), row);
    }
  }

  if (stableKey.type === 'public_url') {
    addRows(lookup.publicUrl.get(stableKey.value));
    addRows(lookup.filePath.get(stableKey.value));
  } else if (stableKey.type === 'file_path') {
    addRows(lookup.filePath.get(stableKey.value));
    addRows(lookup.publicUrl.get(stableKey.value));
  } else {
    addRows(lookup.fileNameSize.get(stableKey.value));
  }

  return Array.from(matches.values());
}

function metadataRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function normalizeStringForCompare(value: unknown): string | null {
  const text = asString(value);
  return text || null;
}

function normalizeNumberForCompare(value: unknown): number | null {
  return asNullableNumber(value);
}

function addSimpleDiff(
  diffs: FieldDiff[],
  fieldName: string,
  expected: unknown,
  actual: unknown,
  normalizeValue: (value: unknown) => unknown,
) {
  const normalizedExpected = normalizeValue(expected);
  const normalizedActual = normalizeValue(actual);

  if (normalizedExpected !== normalizedActual) {
    diffs.push({
      fieldName,
      expected,
      actual,
      normalizedExpected,
      normalizedActual,
      severity: 'update',
      message: `${fieldName} differs and would be updated by a future shadow upsert.`,
    });
  }
}

function collectDiffs(prepared: PlannedMediaFile, profile: MysqlRowProfile): FieldDiff[] {
  const row = profile.row;
  const metadata = metadataRecord(profile.metadataJson);
  const diffs: FieldDiff[] = [];
  const category = asString(row.category);
  const normalizedExpectedCategory = normalizeMediaLibraryCategory(prepared.category);
  const normalizedActualCategory = normalizeMediaLibraryCategory(category);

  addSimpleDiff(diffs, 'file_name', prepared.fileName, row.file_name, normalizeStringForCompare);
  addSimpleDiff(diffs, 'original_name', prepared.originalName, row.original_name, normalizeStringForCompare);
  addSimpleDiff(diffs, 'file_path', prepared.filePathForWrite, row.file_path, normalizeStringForCompare);
  addSimpleDiff(diffs, 'public_url', prepared.publicUrlForWrite, row.public_url, normalizeStringForCompare);
  addSimpleDiff(diffs, 'mime_type', prepared.mimeType, row.mime_type, normalizeStringForCompare);
  addSimpleDiff(diffs, 'file_ext', prepared.fileExt, row.file_ext, normalizeStringForCompare);
  addSimpleDiff(diffs, 'file_size', prepared.fileSize, row.file_size, normalizeNumberForCompare);
  addSimpleDiff(diffs, 'width', prepared.width, row.width, normalizeNumberForCompare);
  addSimpleDiff(diffs, 'height', prepared.height, row.height, normalizeNumberForCompare);
  addSimpleDiff(diffs, 'duration_seconds', prepared.durationSeconds, row.duration_seconds, normalizeNumberForCompare);
  addSimpleDiff(diffs, 'alt_text', prepared.altText, row.alt_text, normalizeStringForCompare);
  addSimpleDiff(diffs, 'description', prepared.description, row.description, normalizeStringForCompare);
  addSimpleDiff(diffs, 'status', prepared.status, row.status, (value) => normalizeStatus(value));

  if (prepared.category !== category) {
    diffs.push({
      fieldName: 'category',
      expected: prepared.category,
      actual: category,
      normalizedExpected: normalizedExpectedCategory,
      normalizedActual: normalizedActualCategory,
      severity: normalizedExpectedCategory === normalizedActualCategory ? 'normalized_match' : 'update',
      message: normalizedExpectedCategory === normalizedActualCategory
        ? 'Raw category differs, but normalized category is equivalent; future writes should not treat this as a hard mismatch.'
        : 'Category differs after normalization and would need review before a future write.',
    });
  }

  addSimpleDiff(diffs, 'metadata_json.moduleName', 'media-library', metadata.moduleName, normalizeStringForCompare);
  addSimpleDiff(diffs, 'metadata_json.sourceKey', prepared.sourceKey, metadata.sourceKey, normalizeStringForCompare);
  addSimpleDiff(diffs, 'metadata_json.displayName', prepared.displayName, metadata.displayName, normalizeStringForCompare);
  addSimpleDiff(diffs, 'metadata_json.ownerType', prepared.metadataJson.ownerType, metadata.ownerType, normalizeStringForCompare);
  addSimpleDiff(diffs, 'metadata_json.ownerSlug', prepared.metadataJson.ownerSlug, metadata.ownerSlug, normalizeStringForCompare);
  addSimpleDiff(diffs, 'metadata_json.groupKey', prepared.metadataJson.groupKey, metadata.groupKey, normalizeStringForCompare);
  addSimpleDiff(diffs, 'metadata_json.slotNo', prepared.metadataJson.slotNo, metadata.slotNo, normalizeNumberForCompare);
  addSimpleDiff(diffs, 'metadata_json.sortOrder', prepared.metadataJson.sortOrder, metadata.sortOrder, normalizeNumberForCompare);

  return diffs;
}

function isUpdateDiff(diff: FieldDiff): boolean {
  return diff.severity === 'update';
}

function buildOwnershipConflicts(profile: MysqlRowProfile): string[] {
  const conflicts = [...profile.ownershipConflicts];

  if (profile.ownershipKind !== 'likelyMediaLibrary') {
    conflicts.push(
      `Matched MySQL row is ${profile.ownershipKind}; normal media-library writes must not mutate shared or unknown rows.`,
    );
  }

  return conflicts;
}

function buildPlan(prepared: PlannedMediaFile, matches: MysqlMediaRow[]): ShadowPlan {
  const stableKey = stableKeyLabel(prepared.stableKey);
  const warnings = [...prepared.sourceWarnings];
  const conflicts: string[] = [];
  const reasons: string[] = [];

  if (!prepared.stableKey) {
    return {
      sourceKey: prepared.sourceKey,
      fileName: prepared.fileName,
      stableKey,
      action: prepared.action,
      decision: 'warning',
      mysqlId: null,
      plannedOperation: 'none',
      reasons: ['No stable key can be formed from publicUrl, filePath, or fileName+fileSize.'],
      warnings,
      conflicts,
      diffs: [],
      expected: summarizeExpected(prepared),
    };
  }

  if (!prepared.fileName || !prepared.publicUrlForWrite) {
    return {
      sourceKey: prepared.sourceKey,
      fileName: prepared.fileName,
      stableKey,
      action: prepared.action,
      decision: 'warning',
      mysqlId: null,
      plannedOperation: 'none',
      reasons: ['Future insert is unsafe because fileName or publicUrl is missing.'],
      warnings,
      conflicts,
      diffs: [],
      expected: summarizeExpected(prepared),
    };
  }

  if (matches.length > 1) {
    return {
      sourceKey: prepared.sourceKey,
      fileName: prepared.fileName,
      stableKey,
      action: prepared.action,
      decision: 'conflict',
      mysqlId: null,
      plannedOperation: 'none',
      reasons: ['More than one MySQL media_files row matches the same stable key.'],
      warnings,
      conflicts: matches.map((row) => `Matched media_files#${mysqlRowId(row)} via ${stableKey}.`),
      diffs: [],
      expected: summarizeExpected(prepared),
    };
  }

  if (prepared.action === 'delete' && getRecordStatus(prepared.sourceRecord) !== 'archived') {
    return {
      sourceKey: prepared.sourceKey,
      fileName: prepared.fileName,
      stableKey,
      action: prepared.action,
      decision: 'skip',
      mysqlId: null,
      plannedOperation: 'none',
      reasons: ['Delete shadow plan skips active records; current delete requires archived status first.'],
      warnings,
      conflicts,
      diffs: [],
      expected: summarizeExpected(prepared),
    };
  }

  if (matches.length === 0) {
    if (prepared.action === 'delete') {
      return {
        sourceKey: prepared.sourceKey,
        fileName: prepared.fileName,
        stableKey,
        action: prepared.action,
        decision: 'skip',
        mysqlId: null,
        plannedOperation: 'none',
        reasons: ['No MySQL row matched; future delete shadow write would be treated as already absent.'],
        warnings,
        conflicts,
        diffs: [],
        expected: summarizeExpected(prepared),
      };
    }

    return {
      sourceKey: prepared.sourceKey,
      fileName: prepared.fileName,
      stableKey,
      action: prepared.action,
      decision: 'insert',
      mysqlId: null,
      plannedOperation: 'insert',
      reasons: ['No MySQL row matched; future shadow writer would insert a media_files row.'],
      warnings,
      conflicts,
      diffs: [],
      expected: summarizeExpected(prepared),
    };
  }

  const profile = buildRowProfile(matches[0]);
  const ownershipConflicts = buildOwnershipConflicts(profile);
  const mysqlSummary = summarizeMysqlRow(profile);

  if (ownershipConflicts.length > 0) {
    return {
      sourceKey: prepared.sourceKey,
      fileName: prepared.fileName,
      stableKey,
      action: prepared.action,
      decision: 'conflict',
      mysqlId: mysqlRowId(profile.row),
      plannedOperation: 'none',
      reasons: ['Matched row is not safe for normal media-library write mutation.'],
      warnings,
      conflicts: ownershipConflicts,
      diffs: [],
      expected: summarizeExpected(prepared),
      mysql: mysqlSummary,
    };
  }

  if (prepared.action === 'delete') {
    if (mysqlDeletedAt(profile.row)) {
      return {
        sourceKey: prepared.sourceKey,
        fileName: prepared.fileName,
        stableKey,
        action: prepared.action,
        decision: 'skip',
        mysqlId: mysqlRowId(profile.row),
        plannedOperation: 'none',
        reasons: ['Matched MySQL row is already soft-deleted.'],
        warnings,
        conflicts,
        diffs: [],
        expected: summarizeExpected(prepared),
        mysql: mysqlSummary,
      };
    }

    return {
      sourceKey: prepared.sourceKey,
      fileName: prepared.fileName,
      stableKey,
      action: prepared.action,
      decision: 'update',
      mysqlId: mysqlRowId(profile.row),
      plannedOperation: 'soft-delete',
      reasons: ['Future delete write should soft-delete/tombstone the MySQL row before any physical file removal.'],
      warnings,
      conflicts,
      diffs: [],
      expected: summarizeExpected(prepared),
      mysql: mysqlSummary,
    };
  }

  const diffs = collectDiffs(prepared, profile);
  const updateDiffs = diffs.filter(isUpdateDiff);

  if (mysqlDeletedAt(profile.row)) {
    warnings.push('Matched MySQL row has deleted_at set; future upsert would need an explicit restore policy before clearing deleted_at.');
  }

  if (updateDiffs.length > 0 || mysqlDeletedAt(profile.row)) {
    reasons.push(`${updateDiffs.length} update-level field differences were found.`);
    return {
      sourceKey: prepared.sourceKey,
      fileName: prepared.fileName,
      stableKey,
      action: prepared.action,
      decision: 'update',
      mysqlId: mysqlRowId(profile.row),
      plannedOperation: 'update',
      reasons,
      warnings,
      conflicts,
      diffs,
      expected: summarizeExpected(prepared),
      mysql: mysqlSummary,
    };
  }

  if (diffs.some((diff) => diff.severity === 'normalized_match')) {
    reasons.push('Only normalized-equivalent differences were found.');
  } else {
    reasons.push('MySQL row already matches the planned shadow write shape.');
  }

  return {
    sourceKey: prepared.sourceKey,
    fileName: prepared.fileName,
    stableKey,
    action: prepared.action,
    decision: 'skip',
    mysqlId: mysqlRowId(profile.row),
    plannedOperation: 'none',
    reasons,
    warnings,
    conflicts,
    diffs,
    expected: summarizeExpected(prepared),
    mysql: mysqlSummary,
  };
}

function summarizeExpected(prepared: PlannedMediaFile) {
  return {
    publicUrl: prepared.publicUrlForWrite,
    filePath: prepared.filePathForWrite,
    category: prepared.category,
    normalizedCategory: prepared.normalizedCategory,
    status: prepared.status,
    metadataModuleName: 'media-library',
  };
}

function mysqlStableKeyConsistent(prepared: PlannedMediaFile, row: MysqlMediaRow | undefined): boolean {
  if (!row) {
    return false;
  }

  const expectedUrl = prepared.publicUrlForWrite ?? '';
  const expectedFilePath = prepared.filePathForWrite ?? expectedUrl;
  const mysqlPublicUrl = asString(row.public_url);
  const mysqlFilePath = asString(row.file_path);
  const mysqlFileName = asString(row.file_name);
  const mysqlFileSize = asNumber(row.file_size);
  const urlMatches = Boolean(expectedUrl && (mysqlPublicUrl === expectedUrl || mysqlFilePath === expectedUrl));
  const filePathMatches = Boolean(expectedFilePath && (mysqlFilePath === expectedFilePath || mysqlPublicUrl === expectedFilePath));
  const fileNameSizeMatches = Boolean(
    prepared.fileName
    && mysqlFileName === prepared.fileName
    && mysqlFileSize === prepared.fileSize,
  );

  return (urlMatches || filePathMatches) && fileNameSizeMatches;
}

function addReason(reasons: string[], reason: string) {
  if (!reasons.includes(reason)) {
    reasons.push(reason);
  }
}

function decideDeleteRiskItem(input: {
  prepared: PlannedMediaFile;
  matches: MysqlMediaRow[];
  references: DeleteReference[];
  coverageComplete: boolean;
}): DeleteRiskItem {
  const { prepared, matches, references, coverageComplete } = input;
  const reasons: string[] = [];
  let decision: DeleteRiskDecision = 'safe_candidate';
  const profile = matches.length === 1 ? buildRowProfile(matches[0]) : null;
  const mysqlStatus = profile ? normalizeStatus(profile.row.status) : null;
  const mysqlOwnershipKind = profile?.ownershipKind ?? null;
  const hasMysqlConflict = Boolean(profile && profile.ownershipConflicts.length > 0);
  const stableKeyConsistent = mysqlStableKeyConsistent(prepared, matches[0]);

  function block(reason: string) {
    decision = 'blocked';
    addReason(reasons, reason);
  }

  function review(reason: string) {
    if (decision !== 'blocked') {
      decision = 'needs_review';
    }
    addReason(reasons, reason);
  }

  if (normalizeStatus(prepared.status) !== 'archived') {
    block('not_archived');
  }

  if (references.length > 0) {
    block('referenced');
  }

  if (!coverageComplete) {
    review('incomplete_reference_coverage');
  }

  if (!prepared.uploadFile.exists) {
    review('missing_upload_file');
  }

  if (prepared.sourceWarnings.length > 0) {
    review('json_upload_metadata_warning');
  }

  if (matches.length === 0) {
    review('mysql_row_missing');
  } else if (matches.length > 1) {
    review('mysql_duplicate_stable_key_match');
  } else {
    if (mysqlOwnershipKind === 'sharedButReferenced') {
      block('mysql_shared_but_referenced');
    }

    if (mysqlOwnershipKind === 'unknown') {
      review('mysql_unknown_ownership');
    }

    if (hasMysqlConflict) {
      review('mysql_ownership_conflict');
    }

    if (!stableKeyConsistent) {
      review('json_upload_mysql_stable_key_mismatch');
    }
  }

  return {
    url: prepared.publicUrlForWrite,
    fileName: prepared.fileName,
    status: normalizeStatus(prepared.status),
    decision,
    reasons,
    references,
    mysql: {
      matched: matches.length > 0,
      matchCount: matches.length,
      status: mysqlStatus,
      ownershipKind: mysqlOwnershipKind,
      hasConflict: hasMysqlConflict || matches.length > 1,
      stableKeyConsistent,
      ids: matches.map((row) => mysqlRowId(row)),
    },
    uploadFile: {
      exists: prepared.uploadFile.exists,
      path: prepared.uploadFile.expectedPath
        ? path.relative(serverRoot, prepared.uploadFile.expectedPath).replace(/\\/g, '/')
        : null,
      size: prepared.uploadFile.size,
    },
  };
}

async function buildDeleteProtectionReport(
  preparedItems: PlannedMediaFile[],
  lookup: ReturnType<typeof buildMysqlLookup>,
) {
  const { coverage, coverageDetails, sourceStrings } = await readDeleteReferenceStrings();
  const coverageComplete = Object.values(coverage).every(Boolean);
  const items = preparedItems.map((prepared) => {
    const matches = findMysqlMatches(lookup, prepared.stableKey);
    const references = findReferencesForPrepared(prepared, matches, sourceStrings);
    return decideDeleteRiskItem({
      prepared,
      matches,
      references,
      coverageComplete,
    });
  });

  const summary = items.reduce(
    (nextSummary, item) => {
      nextSummary.checkedCount += 1;
      nextSummary.blockedCount += item.decision === 'blocked' ? 1 : 0;
      nextSummary.needsReviewCount += item.decision === 'needs_review' ? 1 : 0;
      nextSummary.safeCandidateCount += item.decision === 'safe_candidate' ? 1 : 0;
      nextSummary.archivedCount += item.status === 'archived' ? 1 : 0;
      nextSummary.activeCount += item.status !== 'archived' ? 1 : 0;
      nextSummary.missingUploadFileCount += item.uploadFile.exists ? 0 : 1;
      nextSummary.referencedCount += item.references.length > 0 ? 1 : 0;
      nextSummary.unknownCoverageCount += coverageComplete ? 0 : 1;
      return nextSummary;
    },
    {
      checkedCount: 0,
      blockedCount: 0,
      needsReviewCount: 0,
      safeCandidateCount: 0,
      archivedCount: 0,
      activeCount: 0,
      missingUploadFileCount: 0,
      referencedCount: 0,
      unknownCoverageCount: 0,
    },
  );

  return {
    mode: 'dry-run',
    action: 'delete',
    summary,
    coverage,
    coverageDetails,
    decisionPolicy: {
      blocked: ['not_archived', 'referenced', 'mysql_shared_but_referenced'],
      needsReview: [
        'incomplete_reference_coverage',
        'missing_upload_file',
        'mysql_row_missing',
        'mysql_unknown_ownership',
        'mysql_ownership_conflict',
        'json_upload_mysql_stable_key_mismatch',
      ],
      safeCandidate: 'Only a risk-report candidate. This is not permission to delete.',
    },
    items,
  };
}

function parseArgs(argv: string[]): CliOptions {
  let moduleName = 'media-library';
  let action: ShadowAction = 'all';
  let writeRequested = false;
  let target: string | null = null;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--write') {
      writeRequested = true;
      continue;
    }

    if (arg === '--module') {
      moduleName = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (arg.startsWith('--module=')) {
      moduleName = arg.slice('--module='.length);
      continue;
    }

    if (arg === '--action') {
      const nextAction = argv[index + 1] ?? '';
      action = allowedActions.has(nextAction as ShadowAction) ? (nextAction as ShadowAction) : action;
      index += 1;
      continue;
    }

    if (arg.startsWith('--action=')) {
      const nextAction = arg.slice('--action='.length);
      action = allowedActions.has(nextAction as ShadowAction) ? (nextAction as ShadowAction) : action;
      continue;
    }

    if (arg === '--target') {
      target = argv[index + 1] ?? '';
      index += 1;
      continue;
    }

    if (arg.startsWith('--target=')) {
      target = arg.slice('--target='.length);
    }
  }

  return {
    moduleName,
    action,
    writeRequested,
    target,
  };
}

function mysqlCounts(rows: MysqlMediaRow[]) {
  const counts: Record<MediaLibraryOwnershipKind | 'total' | 'deleted', number> = {
    likelyMediaLibrary: 0,
    sharedButReferenced: 0,
    unknown: 0,
    total: 0,
    deleted: 0,
  };

  for (const row of rows) {
    const profile = buildRowProfile(row);
    counts[profile.ownershipKind] += 1;
    counts.total += 1;
    if (mysqlDeletedAt(row)) {
      counts.deleted += 1;
    }
  }

  return counts;
}

function printJson(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const generatedAt = new Date().toISOString();

  if (options.writeRequested) {
    printJson({
      generatedAt,
      status: 'rejected',
      mode: 'dry-run-only',
      error: '--write is intentionally disabled in 22-5C-4B. This tool never writes MySQL, JSON, or uploads.',
    });
    process.exitCode = 1;
    return;
  }

  if (options.moduleName !== 'media-library') {
    printJson({
      generatedAt,
      status: 'rejected',
      mode: 'dry-run-only',
      error: `Unsupported module "${options.moduleName}". 22-5C-4B only supports media-library.`,
    });
    process.exitCode = 1;
    return;
  }

  const mysqlConfig = getSafeDatabaseConfig();
  if (!mysqlConfig.configured) {
    printJson({
      generatedAt,
      status: 'failed',
      mode: 'dry-run-only',
      error: `MySQL is not configured. Missing: ${mysqlConfig.missing.join(', ')}`,
      mysql: {
        configured: false,
        missing: mysqlConfig.missing,
      },
    });
    process.exitCode = 1;
    return;
  }

  const [jsonSource, mysqlRows] = await Promise.all([
    readMediaLibraryJson(),
    readMysqlRows(),
  ]);
  const lookup = buildMysqlLookup(mysqlRows);
  const target = normalizeTarget(options.target);
  const preparedItems: PlannedMediaFile[] = [];
  const plans: ShadowPlan[] = [];

  for (const entry of jsonSource.entries) {
    const prepared = await prepareMediaFile(entry, options.action);
    if (!targetMatchesPrepared(prepared, target)) {
      continue;
    }

    preparedItems.push(prepared);
    plans.push(buildPlan(prepared, findMysqlMatches(lookup, prepared.stableKey)));
  }

  const counts = plans.reduce(
    (nextCounts, plan) => {
      nextCounts[plan.decision] += 1;
      nextCounts.warningItems += plan.warnings.length > 0 ? 1 : 0;
      nextCounts.warningCount += plan.warnings.length;
      nextCounts.conflictCount += plan.conflicts.length;
      nextCounts.updateDiffCount += plan.diffs.filter((diff) => diff.severity === 'update').length;
      nextCounts.normalizedDifferenceCount += plan.diffs.filter((diff) => diff.severity === 'normalized_match').length;
      return nextCounts;
    },
    {
      insert: 0,
      update: 0,
      skip: 0,
      conflict: 0,
      warning: 0,
      warningItems: 0,
      warningCount: 0,
      conflictCount: 0,
      updateDiffCount: 0,
      normalizedDifferenceCount: 0,
    },
  );

  const status = counts.conflict > 0
    ? 'conflict'
    : counts.warning > 0 || counts.warningItems > 0
      ? 'warning'
      : 'ok';
  const deleteProtection = options.action === 'delete'
    ? await buildDeleteProtectionReport(preparedItems, lookup)
    : undefined;

  printJson({
    generatedAt,
    status: deleteProtection?.summary.blockedCount
      ? 'blocked'
      : deleteProtection?.summary.needsReviewCount
        ? 'needs_review'
        : status,
    mode: options.action === 'delete' ? 'dry-run' : 'dry-run-only',
    module: options.moduleName,
    action: options.action,
    target: options.target,
    note: 'Standalone 22-5C-4B shadow plan only. No official media route/controller/service writes are changed or invoked.',
    writeSafety: {
      mysqlWrites: false,
      jsonWrites: false,
      uploadWrites: false,
      writeFlagSupported: false,
      writeFlagBehavior: '--write is recognized and rejected.',
    },
    actionSemantics: {
      all: 'Plan a current-state media_files upsert for every JSON media-library record.',
      upload: 'Plan the shadow upsert shape that would run after a future JSON-primary upload.',
      metadata: 'Plan the shadow upsert shape that would run after a future JSON-primary displayName/metadata update.',
      archive: 'Plan the shadow upsert shape with status forced to archived.',
      restore: 'Plan the shadow upsert shape with status forced to active.',
      delete: 'Plan only archived records for a future MySQL soft-delete/tombstone; active records are skipped.',
    },
    counts: {
      jsonSourceCount: jsonSource.sourceCount,
      jsonRecordCount: jsonSource.entries.length,
      checkedRecordCount: preparedItems.length,
      mysqlRows: mysqlCounts(mysqlRows),
      plans: counts,
    },
    upsertPlanShape: {
      table: 'media_files',
      stableKeyPriority: ['public_url', 'file_path', 'file_name+file_size'],
      insertPolicy: 'insert only when a safe stable key and publicUrl/fileName exist',
      updatePolicy: 'update only likely media-library rows; sharedButReferenced and unknown rows are conflicts',
      deletePolicy: 'future delete should use soft-delete/tombstone before physical upload removal',
    },
    deleteProtection,
    plans,
  });
}

main()
  .catch((error) => {
    printJson({
      generatedAt: new Date().toISOString(),
      status: 'failed',
      mode: 'dry-run-only',
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDbPool();
  });
