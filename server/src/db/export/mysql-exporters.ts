import type { RowDataPacket } from 'mysql2/promise';
import { getDbPool, getSafeDatabaseConfig } from '../client.js';
import type {
  ExportModuleDefinition,
  ExportModuleName,
  ExportStatus,
  MysqlExportReadResult,
} from './types.js';

type ContactInfoRow = RowDataPacket & {
  content_json: unknown;
  is_enabled: unknown;
};

type CompanyAssetRow = RowDataPacket & {
  asset_key: unknown;
  media_url: unknown;
  alt_text: unknown;
  description: unknown;
  sort_order: unknown;
  is_enabled: unknown;
  raw_json: unknown;
};

type HomeVideoRow = RowDataPacket & {
  video_media_id: unknown;
  poster_media_id: unknown;
  video_url: unknown;
  poster_url: unknown;
  title: unknown;
  description: unknown;
  is_enabled: unknown;
  updated_at: unknown;
  video_file_name: unknown;
  video_original_name: unknown;
  poster_file_name: unknown;
  poster_original_name: unknown;
};

type HomeInteractiveImageRow = RowDataPacket & {
  slot_number: unknown;
  media_id: unknown;
  image_url: unknown;
  alt_text: unknown;
  sort_order: unknown;
  is_enabled: unknown;
  media_file_name: unknown;
};

const implementedExportModules = new Set<ExportModuleName>([
  'contact-info',
  'company-assets',
  'home-video',
  'home-interactive-images',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function asMysqlBoolean(value: unknown, fallback = true): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'enabled', 'published'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'no', 'disabled', 'draft', 'archived'].includes(normalized)) {
      return false;
    }
  }

  return fallback;
}

function parseJsonColumn(value: unknown): unknown {
  if (Buffer.isBuffer(value)) {
    return parseJsonColumn(value.toString('utf8'));
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed ? JSON.parse(trimmed) as unknown : undefined;
}

function fileNameFromUrl(value: unknown): string {
  const rawValue = asString(value);
  if (!rawValue) {
    return '';
  }

  const withoutQuery = rawValue.split('?')[0]?.split('#')[0] ?? rawValue;
  return withoutQuery.split(/[\\/]/).filter(Boolean).pop() ?? '';
}

function pickString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = asString(record[key]);
    if (value) {
      return value;
    }
  }

  return '';
}

function pickNumber(record: Record<string, unknown>, keys: string[], fallback: number): number {
  for (const key of keys) {
    if (record[key] !== undefined) {
      const value = asNumber(record[key], Number.NaN);
      if (Number.isFinite(value)) {
        return value;
      }
    }
  }

  return fallback;
}

function pickBoolean(record: Record<string, unknown>, keys: string[], fallback: boolean): boolean {
  for (const key of keys) {
    if (typeof record[key] === 'boolean') {
      return record[key] as boolean;
    }
  }

  return fallback;
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string' && value.trim()) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value.trim() : date.toISOString();
  }

  return '';
}

function emptyExportResult(input: {
  definition: ExportModuleDefinition;
  status: MysqlExportReadResult['status'];
  implemented: boolean;
  warnings?: string[];
  blockers?: string[];
}): MysqlExportReadResult {
  return {
    moduleName: input.definition.moduleName,
    implemented: input.implemented,
    status: input.status,
    data: null,
    recordCount: 0,
    warnings: input.warnings ?? [],
    blockers: input.blockers ?? [],
  };
}

async function readContactInfoExport(definition: ExportModuleDefinition): Promise<MysqlExportReadResult> {
  const [rows] = await getDbPool().query<ContactInfoRow[]>(
    `SELECT content_json, is_enabled
     FROM contact_info
     WHERE singleton_key = ? AND deleted_at IS NULL
     ORDER BY is_enabled DESC, updated_at DESC, id DESC
     LIMIT 1`,
    ['contact_info'],
  );

  const row = rows[0];
  if (!row) {
    return emptyExportResult({
      definition,
      status: 'shape_risk',
      implemented: true,
      blockers: ['No active contact_info singleton row was found.'],
    });
  }

  let content: unknown;
  try {
    content = parseJsonColumn(row.content_json);
  } catch (error) {
    return emptyExportResult({
      definition,
      status: 'shape_risk',
      implemented: true,
      blockers: [
        `contact_info.content_json could not be parsed: ${error instanceof Error ? error.message : 'invalid JSON'}.`,
      ],
    });
  }

  if (!isRecord(content)) {
    return emptyExportResult({
      definition,
      status: 'shape_risk',
      implemented: true,
      blockers: ['contact_info.content_json is not an object, so contact-info.json shape cannot be restored.'],
    });
  }

  return {
    moduleName: definition.moduleName,
    implemented: true,
    status: 'exported',
    data: content,
    recordCount: 1,
    warnings: asMysqlBoolean(row.is_enabled, true)
      ? []
      : ['contact_info row is disabled; exported content_json is still reported for dry-run comparison.'],
    blockers: [],
  };
}

async function readCompanyAssetsExport(definition: ExportModuleDefinition): Promise<MysqlExportReadResult> {
  const [rows] = await getDbPool().query<CompanyAssetRow[]>(
    `SELECT asset_key, media_url, alt_text, description, sort_order, is_enabled, raw_json
     FROM company_assets
     WHERE deleted_at IS NULL
     ORDER BY sort_order ASC, asset_key ASC`,
  );
  const warnings: string[] = [];
  const blockers: string[] = [];
  const assets = rows.map((row, index) => {
    let rawJson: unknown;
    try {
      rawJson = parseJsonColumn(row.raw_json);
    } catch (error) {
      rawJson = undefined;
      warnings.push(
        `company_assets.${asString(row.asset_key) || `row_${index + 1}`} raw_json could not be parsed: ${
          error instanceof Error ? error.message : 'invalid JSON'
        }.`,
      );
    }

    const rawRecord = isRecord(rawJson) ? rawJson : {};
    const assetKey = asString(row.asset_key) || pickString(rawRecord, ['id', 'assetKey', 'asset_key']);
    const mediaUrl = asString(row.media_url) || pickString(rawRecord, ['imageUrl', 'image_url', 'mediaUrl', 'media_url']);
    const imageAlt = asString(row.alt_text) || pickString(rawRecord, ['imageAlt', 'image_alt', 'altText', 'alt_text']);
    const description = asString(row.description) || pickString(rawRecord, ['description', 'summary']);
    const sortOrder = asNumber(row.sort_order, pickNumber(rawRecord, ['sortOrder', 'sort_order'], index + 1));
    const enabled = asMysqlBoolean(row.is_enabled, pickBoolean(rawRecord, ['enabled', 'isEnabled', 'is_enabled'], true));

    const asset = {
      ...rawRecord,
      id: pickString(rawRecord, ['id', 'assetKey', 'asset_key']) || assetKey,
      title: pickString(rawRecord, ['title']),
      summary: pickString(rawRecord, ['summary']),
      description,
      location: pickString(rawRecord, ['location']),
      imageUrl: mediaUrl,
      imageAlt,
      sortOrder,
      enabled,
    };

    if (!isRecord(rawJson)) {
      warnings.push(`company_assets.${assetKey || `row_${index + 1}`} has no usable raw_json; only table fields were available.`);
    }

    const missingCoreFields = ['id', 'title', 'summary', 'description', 'location']
      .filter((fieldName) => !asString(asset[fieldName as keyof typeof asset]));

    if (missingCoreFields.length > 0) {
      blockers.push(
        `company_assets.${assetKey || `row_${index + 1}`} cannot fully restore core JSON fields: ${missingCoreFields.join(', ')}.`,
      );
    }

    if (!mediaUrl || !imageAlt) {
      warnings.push(`company_assets.${assetKey || `row_${index + 1}`} has incomplete media fields; this is a dry-run warning only.`);
    }

    return asset;
  });

  return {
    moduleName: definition.moduleName,
    implemented: true,
    status: blockers.length > 0 ? 'shape_risk' : 'exported',
    data: assets,
    recordCount: rows.length,
    warnings,
    blockers,
  };
}

async function readHomeVideoExport(definition: ExportModuleDefinition): Promise<MysqlExportReadResult> {
  const [rows] = await getDbPool().query<HomeVideoRow[]>(
    `SELECT
       hv.video_media_id,
       hv.poster_media_id,
       hv.video_url,
       hv.poster_url,
       hv.title,
       hv.description,
       hv.is_enabled,
       hv.updated_at,
       video_media.file_name AS video_file_name,
       video_media.original_name AS video_original_name,
       poster_media.file_name AS poster_file_name,
       poster_media.original_name AS poster_original_name
     FROM home_video hv
     LEFT JOIN media_files video_media ON video_media.id = hv.video_media_id AND video_media.deleted_at IS NULL
     LEFT JOIN media_files poster_media ON poster_media.id = hv.poster_media_id AND poster_media.deleted_at IS NULL
     WHERE hv.singleton_key = ? AND hv.deleted_at IS NULL
     ORDER BY hv.is_enabled DESC, hv.updated_at DESC, hv.id DESC
     LIMIT 1`,
    ['home_video'],
  );

  const row = rows[0];
  if (!row) {
    return emptyExportResult({
      definition,
      status: 'shape_risk',
      implemented: true,
      blockers: ['No active home_video singleton row was found.'],
    });
  }

  const warnings: string[] = [];
  const videoUrl = asString(row.video_url);
  const posterUrl = asString(row.poster_url);
  const videoFileName = asString(row.video_file_name) || fileNameFromUrl(videoUrl);
  const posterFileName = asString(row.poster_file_name) || fileNameFromUrl(posterUrl);

  if (row.video_media_id && !asString(row.video_file_name)) {
    warnings.push('home_video.video_media_id has no active media_files row; videoFileName was derived from video_url.');
  }

  if (row.poster_media_id && !asString(row.poster_file_name)) {
    warnings.push('home_video.poster_media_id has no active media_files row; posterFileName was derived from poster_url.');
  }

  return {
    moduleName: definition.moduleName,
    implemented: true,
    status: 'exported',
    data: {
      videoUrl,
      videoFileName,
      videoDisplayName: asString(row.video_original_name),
      posterUrl,
      posterFileName,
      posterDisplayName: asString(row.poster_original_name),
      title: asString(row.title),
      description: asString(row.description),
      enabled: asMysqlBoolean(row.is_enabled, true),
      updatedAt: toIsoString(row.updated_at),
    },
    recordCount: 1,
    warnings,
    blockers: [],
  };
}

function createDefaultInteractiveSlots() {
  return Array.from({ length: 12 }, (_, index) => ({
    slotNo: index + 1,
    mediaUrl: '',
    mediaFileName: '',
    alt: '',
    sortOrder: index + 1,
    enabled: true,
  }));
}

async function readHomeInteractiveImagesExport(definition: ExportModuleDefinition): Promise<MysqlExportReadResult> {
  const [rows] = await getDbPool().query<HomeInteractiveImageRow[]>(
    `SELECT
       slots.slot_number,
       slots.media_id,
       slots.image_url,
       slots.alt_text,
       slots.sort_order,
       slots.is_enabled,
       media_files.file_name AS media_file_name
     FROM home_interactive_images slots
     LEFT JOIN media_files ON media_files.id = slots.media_id AND media_files.deleted_at IS NULL
     WHERE slots.deleted_at IS NULL
     ORDER BY slots.slot_number ASC, slots.sort_order ASC`,
  );
  const warnings: string[] = [];
  const slots = createDefaultInteractiveSlots();
  const seenSlots = new Set<number>();

  if (rows.length !== 12) {
    warnings.push(`home_interactive_images has ${rows.length} active rows; expected exactly 12.`);
  }

  for (const row of rows) {
    const slotNo = asNumber(row.slot_number, -1);

    if (!Number.isInteger(slotNo) || slotNo < 1 || slotNo > 12) {
      warnings.push(`home_interactive_images contains invalid slot_number "${String(row.slot_number)}"; it was not exported.`);
      continue;
    }

    if (seenSlots.has(slotNo)) {
      warnings.push(`home_interactive_images contains duplicate slot_number "${slotNo}"; first row was kept.`);
      continue;
    }

    seenSlots.add(slotNo);
    const mediaUrl = asString(row.image_url);

    if (row.media_id && !asString(row.media_file_name)) {
      warnings.push(`home_interactive_images slot ${slotNo} has no active media_files row; mediaFileName was derived from image_url.`);
    }

    slots[slotNo - 1] = {
      slotNo,
      mediaUrl,
      mediaFileName: asString(row.media_file_name) || fileNameFromUrl(mediaUrl),
      alt: asString(row.alt_text),
      sortOrder: asNumber(row.sort_order, slotNo),
      enabled: asMysqlBoolean(row.is_enabled, true),
    };
  }

  return {
    moduleName: definition.moduleName,
    implemented: true,
    status: 'exported',
    data: slots,
    recordCount: rows.length,
    warnings,
    blockers: [],
  };
}

export async function readMysqlExportedData(input: {
  definition: ExportModuleDefinition;
  exportStatus: ExportStatus;
}): Promise<MysqlExportReadResult> {
  if (input.exportStatus !== 'implemented' || !implementedExportModules.has(input.definition.moduleName)) {
    return emptyExportResult({
      definition: input.definition,
      status: 'not_implemented',
      implemented: false,
    });
  }

  try {
    const safeConfig = getSafeDatabaseConfig();
    if (!safeConfig.configured) {
      return emptyExportResult({
        definition: input.definition,
        status: 'mysql_unavailable',
        implemented: true,
        warnings: [`MySQL is not configured. Missing: ${safeConfig.missing.join(', ')}`],
      });
    }

    await getDbPool().query('SELECT 1');

    switch (input.definition.moduleName) {
      case 'contact-info':
        return readContactInfoExport(input.definition);
      case 'company-assets':
        return readCompanyAssetsExport(input.definition);
      case 'home-video':
        return readHomeVideoExport(input.definition);
      case 'home-interactive-images':
        return readHomeInteractiveImagesExport(input.definition);
      default:
        return emptyExportResult({
          definition: input.definition,
          status: 'not_implemented',
          implemented: false,
        });
    }
  } catch (error) {
    return emptyExportResult({
      definition: input.definition,
      status: 'mysql_unavailable',
      implemented: true,
      blockers: [error instanceof Error ? error.message : 'Unable to read MySQL export data.'],
    });
  }
}
