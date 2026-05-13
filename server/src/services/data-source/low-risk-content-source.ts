import type { RowDataPacket } from 'mysql2/promise';
import { getDbPool, getSafeDatabaseConfig } from '../../db/client.js';
import { logger } from '../../utils/logger.js';

type JsonFallback<T> = () => Promise<T>;
type Normalizer<T> = (value: unknown) => T;
type UnknownRecord = Record<string, unknown>;

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
  video_url: unknown;
  poster_url: unknown;
  title: unknown;
  description: unknown;
  is_enabled: unknown;
};

type HomeInteractiveImageRow = RowDataPacket & {
  slot_number: unknown;
  image_url: unknown;
  alt_text: unknown;
  sort_order: unknown;
  is_enabled: unknown;
};

type CountRow = RowDataPacket & {
  count: number;
};

const warnedFallbacks = new Set<string>();

function warnFallbackOnce(moduleName: string, reason: string, message: string, meta?: UnknownRecord) {
  const key = `${moduleName}:${reason}`;
  if (warnedFallbacks.has(key)) {
    return;
  }

  warnedFallbacks.add(key);
  logger.warn(message, {
    moduleName,
    reason,
    ...meta,
  });
}

function canUseMysql(moduleName: string) {
  try {
    const config = getSafeDatabaseConfig();
    return config.configured;
  } catch (error) {
    warnFallbackOnce(
      moduleName,
      'mysql-config-invalid',
      'Low-risk content source is falling back to JSON because MySQL config is invalid.',
      { message: error instanceof Error ? error.message : String(error) },
    );
    return false;
  }
}

async function readWithMysqlFallback<T>(
  moduleName: string,
  readJson: JsonFallback<T>,
  readMysql: () => Promise<T | null>,
): Promise<T> {
  if (!canUseMysql(moduleName)) {
    return readJson();
  }

  try {
    const mysqlValue = await readMysql();
    if (mysqlValue !== null) {
      return mysqlValue;
    }

    warnFallbackOnce(
      moduleName,
      'mysql-empty',
      'Low-risk content source is falling back to JSON because MySQL returned no usable rows.',
    );
    return readJson();
  } catch (error) {
    warnFallbackOnce(
      moduleName,
      'mysql-read-failed',
      'Low-risk content source is falling back to JSON because MySQL read failed.',
      { message: error instanceof Error ? error.message : String(error) },
    );
    return readJson();
  }
}

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
  if (!trimmed) {
    return undefined;
  }

  return JSON.parse(trimmed);
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown, fallback: number) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function asMysqlBoolean(value: unknown, fallback = true) {
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

function fileNameFromUrl(value: unknown) {
  const rawValue = asString(value);
  if (!rawValue) {
    return '';
  }

  const withoutQuery = rawValue.split('?')[0]?.split('#')[0] ?? rawValue;
  return withoutQuery.split(/[\\/]/).filter(Boolean).pop() ?? '';
}

function pickString(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = asString(record[key]);
    if (value) {
      return value;
    }
  }

  return '';
}

function pickNumber(record: UnknownRecord, keys: string[], fallback: number) {
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

function pickBoolean(record: UnknownRecord, keys: string[], fallback: boolean) {
  for (const key of keys) {
    if (typeof record[key] === 'boolean') {
      return record[key] as boolean;
    }
  }

  return fallback;
}

async function readJsonBase<T>(moduleName: string, readJson: JsonFallback<T>): Promise<Partial<T>> {
  try {
    return await readJson() as Partial<T>;
  } catch (error) {
    warnFallbackOnce(
      moduleName,
      'json-base-unavailable',
      'Low-risk content source could not read JSON base while shaping MySQL data.',
      { message: error instanceof Error ? error.message : String(error) },
    );
    return {};
  }
}

export async function readContactInfoWithMysqlFallback<T>(
  readJson: JsonFallback<T>,
  normalize: Normalizer<T>,
) {
  return readWithMysqlFallback('contact-info', readJson, async () => {
    const pool = getDbPool();
    const [rows] = await pool.query<ContactInfoRow[]>(
      `SELECT content_json, is_enabled
       FROM contact_info
       WHERE singleton_key = ? AND deleted_at IS NULL
       ORDER BY id ASC
       LIMIT 1`,
      ['contact_info'],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    const content = parseJsonColumn(row.content_json);
    if (!isRecord(content)) {
      return null;
    }

    return normalize(content);
  });
}

export async function readCompanyAssetsWithMysqlFallback<T>(
  readJson: JsonFallback<T[]>,
  normalize: Normalizer<T[]>,
) {
  return readWithMysqlFallback('company-assets', readJson, async () => {
    const pool = getDbPool();
    const [rows] = await pool.query<CompanyAssetRow[]>(
      `SELECT asset_key, media_url, alt_text, description, sort_order, is_enabled, raw_json
       FROM company_assets
       WHERE deleted_at IS NULL
       ORDER BY sort_order ASC, asset_key ASC`,
    );

    if (rows.length === 0) {
      return null;
    }

    const assets = rows.map((row, index) => {
      const parsedRaw = parseJsonColumn(row.raw_json);
      const rawRecord = isRecord(parsedRaw) ? parsedRaw : {};
      const sortOrder = pickNumber(rawRecord, ['sortOrder', 'sort_order'], asNumber(row.sort_order, index + 1));
      const mediaUrl = pickString(rawRecord, ['imageUrl', 'image_url', 'mediaUrl', 'media_url'])
        || asString(row.media_url);
      const imageAlt = pickString(rawRecord, ['imageAlt', 'image_alt', 'altText', 'alt_text'])
        || asString(row.alt_text);

      return {
        ...rawRecord,
        id: pickString(rawRecord, ['id', 'assetKey', 'asset_key']) || asString(row.asset_key),
        title: pickString(rawRecord, ['title']),
        summary: pickString(rawRecord, ['summary']),
        description: pickString(rawRecord, ['description']) || asString(row.description),
        location: pickString(rawRecord, ['location']),
        imageUrl: mediaUrl,
        imageAlt,
        sortOrder,
        enabled: pickBoolean(rawRecord, ['enabled', 'isEnabled', 'is_enabled'], asMysqlBoolean(row.is_enabled)),
      };
    });

    const hasMissingRawCoreField = assets.some((asset) => (
      !asString(asset.title)
      || !asString(asset.summary)
      || !asString(asset.location)
    ));
    if (hasMissingRawCoreField) {
      throw new Error('company_assets raw_json is missing core display fields.');
    }

    return normalize(assets);
  });
}

export async function readHomeVideoWithMysqlFallback<T>(
  readJson: JsonFallback<T>,
  normalize: Normalizer<T>,
) {
  return readWithMysqlFallback('home-video', readJson, async () => {
    const pool = getDbPool();
    const [rows] = await pool.query<HomeVideoRow[]>(
      `SELECT video_url, poster_url, title, description, is_enabled
       FROM home_video
       WHERE singleton_key = ? AND deleted_at IS NULL
       ORDER BY id ASC
       LIMIT 1`,
      ['home_video'],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    const videoUrl = asString(row.video_url);
    if (!videoUrl) {
      return null;
    }

    const base = await readJsonBase('home-video', readJson);
    const baseRecord = base as UnknownRecord;
    const posterUrl = asString(row.poster_url);
    const nextConfig = {
      ...base,
      videoUrl,
      videoFileName: asString(baseRecord.videoFileName) || fileNameFromUrl(videoUrl),
      videoDisplayName: asString(baseRecord.videoDisplayName),
      posterUrl,
      posterFileName: asString(baseRecord.posterFileName) || fileNameFromUrl(posterUrl),
      posterDisplayName: asString(baseRecord.posterDisplayName),
      title: asString(row.title) || asString(baseRecord.title),
      description: asString(row.description) || asString(baseRecord.description),
      enabled: asMysqlBoolean(row.is_enabled, typeof baseRecord.enabled === 'boolean' ? baseRecord.enabled : true),
      updatedAt: asString(baseRecord.updatedAt),
    };

    return normalize(nextConfig);
  });
}

export async function readHomeInteractiveImagesWithMysqlFallback<T>(
  readJson: JsonFallback<T[]>,
  normalize: Normalizer<T[]>,
) {
  return readWithMysqlFallback('home-interactive-images', readJson, async () => {
    const pool = getDbPool();
    const [rows] = await pool.query<HomeInteractiveImageRow[]>(
      `SELECT slot_number, image_url, alt_text, sort_order, is_enabled
       FROM home_interactive_images
       WHERE deleted_at IS NULL
       ORDER BY slot_number ASC, sort_order ASC`,
    );

    if (rows.length === 0) {
      return null;
    }

    const slots = rows.map((row, index) => {
      const slotNo = asNumber(row.slot_number, index + 1);
      const mediaUrl = asString(row.image_url);
      return {
        slotNo,
        mediaUrl,
        mediaFileName: fileNameFromUrl(mediaUrl),
        alt: asString(row.alt_text),
        sortOrder: asNumber(row.sort_order, slotNo),
        enabled: asMysqlBoolean(row.is_enabled),
      };
    });

    return normalize(slots);
  });
}

export async function readPagesWithMysqlFallback<T>(readJson: JsonFallback<T>) {
  if (!canUseMysql('pages')) {
    return readJson();
  }

  try {
    const pool = getDbPool();
    const [rows] = await pool.query<CountRow[]>(
      'SELECT COUNT(*) AS count FROM pages WHERE deleted_at IS NULL',
    );
    const count = Number(rows[0]?.count ?? 0);

    if (count > 0) {
      warnFallbackOnce(
        'pages',
        'mysql-pages-not-empty',
        'Pages remains JSON fallback in 22-5A because MySQL pages is not empty and route exposure is not part of this step.',
        { mysqlCount: count },
      );
    }

    return readJson();
  } catch (error) {
    warnFallbackOnce(
      'pages',
      'mysql-read-failed',
      'Pages source is falling back to JSON because MySQL read failed.',
      { message: error instanceof Error ? error.message : String(error) },
    );
    return readJson();
  }
}
