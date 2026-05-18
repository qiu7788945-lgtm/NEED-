import type { RowDataPacket } from 'mysql2/promise';
import { getDbPool, getSafeDatabaseConfig } from '../../db/client.js';

type UnknownRecord = Record<string, unknown>;

export type MediaLibraryOwnershipKind = 'likelyMediaLibrary' | 'sharedButReferenced' | 'unknown';
export type NormalizedMediaLibraryOwnership =
  | 'media-library'
  | 'home-video'
  | 'home-interactive-images'
  | 'company-assets'
  | 'case-media'
  | 'solution-media'
  | 'unknown';

export interface MediaLibraryOwnershipSignal {
  fieldName: string;
  rawValue: string;
  normalizedValue: string;
  ownership: NormalizedMediaLibraryOwnership;
}

export interface MediaLibraryOwnershipProfile {
  rawCategory: string;
  normalizedCategory: string;
  normalizedCategoryOwnership: NormalizedMediaLibraryOwnership;
  normalizedOwnership: NormalizedMediaLibraryOwnership;
  signals: MediaLibraryOwnershipSignal[];
  conflicts: string[];
}

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
  rawCategory: string;
  normalizedCategory: string;
  altText: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  source: 'mysql-media_files';
  ownershipKind: MediaLibraryOwnershipKind;
  ownershipReason: string;
  ownershipProfile: MediaLibraryOwnershipProfile;
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

const sharedBusinessOwnerships = new Set<NormalizedMediaLibraryOwnership>([
  'home-video',
  'home-interactive-images',
  'company-assets',
  'case-media',
  'solution-media',
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

function normalizeToken(value: unknown) {
  const text = asString(value).toLowerCase();
  if (!text) {
    return '';
  }

  return text
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function compactToken(value: unknown) {
  return normalizeToken(value).replace(/-/g, '');
}

export function normalizeMediaLibraryCategory(value: unknown) {
  const normalized = normalizeToken(value);
  const compact = normalized.replace(/-/g, '');

  switch (compact) {
    case 'solutionimage':
    case 'solutionimages':
    case 'solutionmedia':
    case 'solutionmedias':
    case 'solutionvideo':
    case 'solutionvideos':
    case 'solutioncover':
    case 'solutionpagecover':
      return 'solution-media';
    case 'caseimage':
    case 'caseimages':
    case 'casemedia':
    case 'casemedias':
    case 'casecover':
      return 'case-media';
    case 'homeinteractive':
    case 'homeinteractiveimage':
    case 'homeinteractiveimages':
      return 'home-interactive-images';
    case 'homevideo':
    case 'homevideos':
      return 'home-video';
    case 'companyasset':
    case 'companyassets':
      return 'company-assets';
    case 'medialibrary':
    case 'medialibraries':
      return 'media-library';
    default:
      return normalized;
  }
}

function ownershipFromCategory(value: unknown): NormalizedMediaLibraryOwnership {
  const normalized = normalizeMediaLibraryCategory(value);

  switch (normalized) {
    case 'media-library':
    case 'home-video':
    case 'home-interactive-images':
    case 'company-assets':
    case 'case-media':
    case 'solution-media':
      return normalized;
    default:
      return 'unknown';
  }
}

function ownershipFromModuleName(value: unknown): NormalizedMediaLibraryOwnership {
  const categoryOwnership = ownershipFromCategory(value);
  if (categoryOwnership !== 'unknown') {
    return categoryOwnership;
  }

  switch (compactToken(value)) {
    case 'cases':
    case 'case':
      return 'case-media';
    case 'solutions':
    case 'solution':
    case 'scenariodetailpages':
    case 'solutionpages':
      return 'solution-media';
    default:
      return 'unknown';
  }
}

function ownershipFromOwnerType(value: unknown): NormalizedMediaLibraryOwnership {
  switch (compactToken(value)) {
    case 'case':
    case 'cases':
      return 'case-media';
    case 'solution':
    case 'solutions':
    case 'solutionpage':
    case 'solutionpages':
      return 'solution-media';
    case 'company':
    case 'companyasset':
    case 'companyassets':
      return 'company-assets';
    case 'medialibrary':
      return 'media-library';
    default:
      return 'unknown';
  }
}

function ownershipFromGroupKey(value: unknown): NormalizedMediaLibraryOwnership {
  const compact = compactToken(value);

  if (compact === 'homeinteractive' || compact === 'homeinteractiveimages') {
    return 'home-interactive-images';
  }

  if (compact === 'homevideo') {
    return 'home-video';
  }

  return 'unknown';
}

function addOwnershipSignal(
  signals: MediaLibraryOwnershipSignal[],
  fieldName: string,
  rawValue: unknown,
  normalizeValue: (value: unknown) => string,
  getOwnership: (value: unknown) => NormalizedMediaLibraryOwnership,
) {
  const rawText = asString(rawValue);
  if (!rawText) {
    return;
  }

  signals.push({
    fieldName,
    rawValue: rawText,
    normalizedValue: normalizeValue(rawText),
    ownership: getOwnership(rawText),
  });
}

function summarizeOwnershipSignals(signals: MediaLibraryOwnershipSignal[]) {
  return signals
    .map((signal) => `${signal.fieldName}=${signal.rawValue} -> ${signal.ownership}`)
    .join('; ');
}

export function buildMediaLibraryOwnershipProfile(
  metadataJson: unknown,
  rowCategory: string,
): MediaLibraryOwnershipProfile {
  const metadata = isRecord(metadataJson) ? metadataJson : {};
  const sourceRecord = isRecord(metadata.sourceRecord) ? metadata.sourceRecord : undefined;
  const signals: MediaLibraryOwnershipSignal[] = [];
  const rawCategory = asString(rowCategory);
  const normalizedCategory = normalizeMediaLibraryCategory(rawCategory);

  addOwnershipSignal(signals, 'media_files.category', rawCategory, normalizeMediaLibraryCategory, ownershipFromCategory);
  addOwnershipSignal(signals, 'metadata_json.moduleName', metadata.moduleName, normalizeToken, ownershipFromModuleName);
  addOwnershipSignal(signals, 'metadata_json.ownerType', metadata.ownerType ?? metadata.owner_type, normalizeToken, ownershipFromOwnerType);
  addOwnershipSignal(signals, 'metadata_json.ownerSlug', metadata.ownerSlug ?? metadata.owner_slug, normalizeToken, () => 'unknown');
  addOwnershipSignal(signals, 'metadata_json.groupKey', metadata.groupKey ?? metadata.group_key, normalizeToken, ownershipFromGroupKey);

  if (sourceRecord) {
    addOwnershipSignal(
      signals,
      'metadata_json.sourceRecord.moduleName',
      sourceRecord.moduleName,
      normalizeToken,
      ownershipFromModuleName,
    );
    addOwnershipSignal(
      signals,
      'metadata_json.sourceRecord.category',
      sourceRecord.category,
      normalizeMediaLibraryCategory,
      ownershipFromCategory,
    );
    addOwnershipSignal(
      signals,
      'metadata_json.sourceRecord.ownerType',
      sourceRecord.ownerType ?? sourceRecord.owner_type,
      normalizeToken,
      ownershipFromOwnerType,
    );
    addOwnershipSignal(
      signals,
      'metadata_json.sourceRecord.ownerSlug',
      sourceRecord.ownerSlug ?? sourceRecord.owner_slug,
      normalizeToken,
      () => 'unknown',
    );
    addOwnershipSignal(
      signals,
      'metadata_json.sourceRecord.groupKey',
      sourceRecord.groupKey ?? sourceRecord.group_key,
      normalizeToken,
      ownershipFromGroupKey,
    );
  }

  const businessSignals = signals.filter((signal) => sharedBusinessOwnerships.has(signal.ownership));
  const businessOwnerships = Array.from(new Set(businessSignals.map((signal) => signal.ownership)));
  const hasMediaLibraryOwnership = signals.some((signal) => signal.ownership === 'media-library');
  let normalizedOwnership: NormalizedMediaLibraryOwnership = 'unknown';

  if (businessOwnerships.length === 1) {
    normalizedOwnership = businessOwnerships[0] ?? 'unknown';
  } else if (hasMediaLibraryOwnership) {
    normalizedOwnership = 'media-library';
  }
  const conflicts = businessOwnerships.length > 1
    ? [`category / ownership signals disagree: ${summarizeOwnershipSignals(businessSignals)}`]
    : [];

  return {
    rawCategory,
    normalizedCategory,
    normalizedCategoryOwnership: ownershipFromCategory(rawCategory),
    normalizedOwnership,
    signals,
    conflicts,
  };
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

function getSharedReason(profile: MediaLibraryOwnershipProfile) {
  const signal = profile.signals.find((item) => sharedBusinessOwnerships.has(item.ownership));
  if (signal) {
    return `${signal.fieldName} is ${signal.rawValue}; normalized ownership is ${signal.ownership}.`;
  }

  const ambiguousHomeSignal = profile.signals.find(
    (item) => item.fieldName.endsWith('ownerType') && item.normalizedValue === 'home',
  );
  if (ambiguousHomeSignal) {
    return `${ambiguousHomeSignal.fieldName} is ${ambiguousHomeSignal.rawValue}; home ownership is shared but needs category/module/groupKey to distinguish home-video from home-interactive-images.`;
  }

  return '';
}

export function classifyMediaLibraryOwnership(
  metadataJson: unknown,
  rowCategory: string,
): { kind: MediaLibraryOwnershipKind; reason: string } {
  const metadata = isRecord(metadataJson) ? metadataJson : {};
  const sourceRecord = isRecord(metadata.sourceRecord) ? metadata.sourceRecord : undefined;
  const profile = buildMediaLibraryOwnershipProfile(metadataJson, rowCategory);
  const moduleNameSignal = profile.signals.find(
    (signal) => signal.fieldName === 'metadata_json.moduleName' && signal.ownership === 'media-library',
  );
  const sourceModuleNameSignal = profile.signals.find(
    (signal) => signal.fieldName === 'metadata_json.sourceRecord.moduleName' && signal.ownership === 'media-library',
  );

  if (moduleNameSignal) {
    return { kind: 'likelyMediaLibrary', reason: `${moduleNameSignal.fieldName} is ${moduleNameSignal.rawValue}.` };
  }

  if (sourceModuleNameSignal) {
    return { kind: 'likelyMediaLibrary', reason: `${sourceModuleNameSignal.fieldName} is ${sourceModuleNameSignal.rawValue}.` };
  }

  const sharedReason = getSharedReason(profile);
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
    const ownershipProfile = buildMediaLibraryOwnershipProfile(rawMetadata, category);
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
      rawCategory: category,
      normalizedCategory: ownershipProfile.normalizedCategory,
      altText: asString(row.alt_text),
      description: asString(row.description),
      status: asString(row.status),
      createdAt: asDateString(row.created_at),
      updatedAt: asDateString(row.updated_at),
      source: 'mysql-media_files' as const,
      ownershipKind: ownership.kind,
      ownershipReason: ownership.reason,
      ownershipProfile,
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
