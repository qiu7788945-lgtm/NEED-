import type { RowDataPacket } from 'mysql2/promise';
import { getDbPool, getSafeDatabaseConfig } from '../../db/client.js';

type UnknownRecord = Record<string, unknown>;

export type MediaLibraryOwnershipKind = 'likelyMediaLibrary' | 'sharedButReferenced' | 'unknown';

export interface MediaLibraryMysqlCandidate {
  id: number;
  url: string;
  publicUrl: string;
  fileName: string;
  originalName: string;
  displayName: string;
  title: string;
  filePath: string;
  mimeType: string;
  fileExt: string;
  fileSize: number;
  category: string;
  altText: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  source: 'mysql-media_files';
  ownershipKind: MediaLibraryOwnershipKind;
  ownershipReason: string;
  rawMetadata: unknown;
}

export interface MediaLibraryMysqlCandidatesResult {
  source: 'mysql-media_files';
  counts: Record<MediaLibraryOwnershipKind | 'total', number>;
  candidates: MediaLibraryMysqlCandidate[];
}

type MediaFileRow = RowDataPacket & {
  id: unknown;
  file_name: unknown;
  original_name: unknown;
  file_path: unknown;
  public_url: unknown;
  mime_type: unknown;
  file_ext: unknown;
  file_size: unknown;
  category: unknown;
  alt_text: unknown;
  description: unknown;
  metadata_json: unknown;
  status: unknown;
  created_at: unknown;
  updated_at: unknown;
};

const sharedModuleNames = new Set([
  'cases',
  'solutions',
  'home-video',
  'home-interactive-images',
  'company-assets',
  'scenario-detail-pages',
]);

const sharedOwnerTypes = new Set(['home', 'case', 'solution', 'company-assets']);
const sharedCategories = new Set([
  'home_interactive',
  'home_video',
  'case_image',
  'solution_image',
  'solution_video',
  'company-assets',
]);

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown, fallback = 0) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function asDateString(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  return asString(value);
}

function metadataString(metadata: UnknownRecord, sourceRecord: UnknownRecord | undefined, ...keys: string[]) {
  for (const key of keys) {
    const metadataValue = asString(metadata[key]);
    if (metadataValue) {
      return metadataValue;
    }

    const sourceValue = sourceRecord ? asString(sourceRecord[key]) : '';
    if (sourceValue) {
      return sourceValue;
    }
  }

  return '';
}

function sourceRecordHasMediaLibraryShape(sourceRecord: UnknownRecord | undefined) {
  if (!sourceRecord) {
    return false;
  }

  const hasStableMediaField = Boolean(
    asString(sourceRecord.publicUrl)
    || asString(sourceRecord.public_url)
    || asString(sourceRecord.url)
    || asString(sourceRecord.filePath)
    || asString(sourceRecord.file_path)
    || asString(sourceRecord.fileName)
    || asString(sourceRecord.file_name),
  );
  const hasLibraryDisplayField = Boolean(
    asString(sourceRecord.originalName)
    || asString(sourceRecord.original_name)
    || asString(sourceRecord.displayName)
    || asString(sourceRecord.display_name)
    || asString(sourceRecord.title),
  );

  return hasStableMediaField && hasLibraryDisplayField;
}

function getSharedReason(input: {
  moduleName: string;
  sourceModuleName: string;
  ownerType: string;
  sourceOwnerType: string;
  category: string;
  sourceCategory: string;
}) {
  if (sharedModuleNames.has(input.moduleName)) {
    return `metadata_json.moduleName is ${input.moduleName}`;
  }
  if (sharedModuleNames.has(input.sourceModuleName)) {
    return `metadata_json.sourceRecord.moduleName is ${input.sourceModuleName}`;
  }
  if (sharedOwnerTypes.has(input.ownerType)) {
    return `metadata_json.ownerType is ${input.ownerType}`;
  }
  if (sharedOwnerTypes.has(input.sourceOwnerType)) {
    return `metadata_json.sourceRecord.ownerType is ${input.sourceOwnerType}`;
  }
  if (sharedCategories.has(input.category)) {
    return `media_files.category is ${input.category}`;
  }
  if (sharedCategories.has(input.sourceCategory)) {
    return `metadata_json.sourceRecord.category is ${input.sourceCategory}`;
  }

  return '';
}

export function classifyMediaLibraryOwnership(
  metadataJson: unknown,
  rowCategory: string,
): { kind: MediaLibraryOwnershipKind; reason: string } {
  const metadata = isRecord(metadataJson) ? metadataJson : {};
  const sourceRecord = isRecord(metadata.sourceRecord) ? metadata.sourceRecord : undefined;
  const moduleName = asString(metadata.moduleName);
  const sourceModuleName = sourceRecord ? asString(sourceRecord.moduleName) : '';
  const ownerType = metadataString(metadata, sourceRecord, 'ownerType', 'owner_type');
  const sourceOwnerType = sourceRecord ? asString(sourceRecord.ownerType ?? sourceRecord.owner_type) : '';
  const category = rowCategory || metadataString(metadata, sourceRecord, 'category');
  const sourceCategory = sourceRecord ? asString(sourceRecord.category) : '';

  if (moduleName === 'media-library') {
    return { kind: 'likelyMediaLibrary', reason: 'metadata_json.moduleName is media-library.' };
  }

  if (sourceModuleName === 'media-library') {
    return { kind: 'likelyMediaLibrary', reason: 'metadata_json.sourceRecord.moduleName is media-library.' };
  }

  const sharedReason = getSharedReason({
    moduleName,
    sourceModuleName,
    ownerType,
    sourceOwnerType,
    category,
    sourceCategory,
  });
  if (sharedReason) {
    return { kind: 'sharedButReferenced', reason: sharedReason };
  }

  if (sourceRecordHasMediaLibraryShape(sourceRecord)) {
    return {
      kind: 'likelyMediaLibrary',
      reason: 'metadata_json.sourceRecord keeps media-library style stable and display fields.',
    };
  }

  if (asString(metadata.sourceKey) && (asString(metadata.displayName) || asString(metadata.title))) {
    return {
      kind: 'likelyMediaLibrary',
      reason: 'metadata_json keeps sourceKey and display metadata compatible with media-library.',
    };
  }

  return {
    kind: 'unknown',
    reason: 'metadata_json does not contain enough ownership metadata for a safe media-library list decision.',
  };
}

export function assertMediaLibraryMysqlConfigured() {
  const config = getSafeDatabaseConfig();
  if (!config.configured) {
    throw new Error(`MySQL is not configured. Missing: ${config.missing.join(', ')}`);
  }
}

export async function readMediaLibraryMysqlCandidates(): Promise<MediaLibraryMysqlCandidatesResult> {
  assertMediaLibraryMysqlConfigured();

  const pool = getDbPool();
  const [rows] = await pool.query<MediaFileRow[]>(
    `SELECT id, file_name, original_name, file_path, public_url, mime_type, file_ext,
            file_size, category, alt_text, description, metadata_json, status, created_at, updated_at
     FROM media_files
     WHERE deleted_at IS NULL
     ORDER BY id ASC`,
  );

  const candidates = rows.map((row) => {
    const rawMetadata = parseJsonColumn(row.metadata_json);
    const metadata = isRecord(rawMetadata) ? rawMetadata : {};
    const sourceRecord = isRecord(metadata.sourceRecord) ? metadata.sourceRecord : undefined;
    const category = asString(row.category);
    const ownership = classifyMediaLibraryOwnership(rawMetadata, category);
    const displayName = metadataString(metadata, sourceRecord, 'displayName', 'display_name', 'title');
    const publicUrl = asString(row.public_url);

    return {
      id: asNumber(row.id),
      url: publicUrl,
      publicUrl,
      fileName: asString(row.file_name),
      originalName: asString(row.original_name),
      displayName,
      title: displayName,
      filePath: asString(row.file_path),
      mimeType: asString(row.mime_type),
      fileExt: asString(row.file_ext),
      fileSize: asNumber(row.file_size),
      category,
      altText: asString(row.alt_text),
      description: asString(row.description),
      status: asString(row.status),
      createdAt: asDateString(row.created_at),
      updatedAt: asDateString(row.updated_at),
      source: 'mysql-media_files' as const,
      ownershipKind: ownership.kind,
      ownershipReason: ownership.reason,
      rawMetadata,
    };
  });

  const counts = candidates.reduce<Record<MediaLibraryOwnershipKind | 'total', number>>(
    (nextCounts, candidate) => ({
      ...nextCounts,
      [candidate.ownershipKind]: nextCounts[candidate.ownershipKind] + 1,
      total: nextCounts.total + 1,
    }),
    {
      likelyMediaLibrary: 0,
      sharedButReferenced: 0,
      unknown: 0,
      total: 0,
    },
  );

  return {
    source: 'mysql-media_files',
    counts,
    candidates,
  };
}
