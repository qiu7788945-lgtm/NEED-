import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HomeVideoConfig } from '../../../../shared/types/home.js';
import { writeHomeVideoToMysqlPrimary } from '../data-source/home-video-primary-write.js';
import { readHomeVideoWithMysqlFallback } from '../data-source/low-risk-content-source.js';
import { logger } from '../../utils/logger.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const dataDir = path.join(serverRoot, 'data');
const configPath = path.join(dataDir, 'home-video.json');
const MODULE_NAME = 'home-video';

type UnknownRecord = Record<string, unknown>;
type HomeVideoWriteRecord = UnknownRecord & Omit<HomeVideoConfig, 'updatedAt'> & {
  updatedAt?: string;
};

const HOME_VIDEO_KEYS = new Set([
  'videoUrl',
  'videoFileName',
  'videoDisplayName',
  'posterUrl',
  'posterFileName',
  'posterDisplayName',
  'title',
  'description',
  'enabled',
  'updatedAt',
]);
const HOME_VIDEO_REQUIRED_STRING_KEYS: Array<keyof Omit<HomeVideoConfig, 'enabled' | 'updatedAt'>> = [
  'videoUrl',
  'videoFileName',
  'videoDisplayName',
  'posterUrl',
  'posterFileName',
  'posterDisplayName',
  'title',
  'description',
];

function createDefaultHomeVideoConfig(): HomeVideoConfig {
  return {
    videoUrl: '',
    videoFileName: '',
    videoDisplayName: '',
    posterUrl: '',
    posterFileName: '',
    posterDisplayName: '',
    title: '',
    description: '',
    enabled: false,
    updatedAt: '',
  };
}

function normalizeJsonText(text: string) {
  return text.replace(/^\uFEFF/, '').trim();
}

function isRecoverableConfigError(error: unknown) {
  return error instanceof SyntaxError
    || (typeof error === 'object'
      && error !== null
      && 'code' in error
      && error.code === 'INVALID_HOME_VIDEO');
}

function createValidationError(message: string) {
  return Object.assign(new Error(message), {
    statusCode: 400,
    code: 'INVALID_HOME_VIDEO',
  });
}

function createJsonShadowWriteError(error: unknown) {
  return Object.assign(
    new Error('Home-video MySQL primary write succeeded, but JSON shadow write-back failed.'),
    {
      statusCode: 500,
      code: 'HOME_VIDEO_JSON_SHADOW_WRITE_FAILED',
      cause: error,
    },
  );
}

function isPlainRecord(value: unknown): value is UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeHomeVideoConfig(config: Partial<HomeVideoConfig>): HomeVideoConfig {
  if (typeof config.enabled !== 'boolean') {
    throw createValidationError('enabled must be boolean');
  }

  return {
    videoUrl: normalizeString(config.videoUrl),
    videoFileName: normalizeString(config.videoFileName),
    videoDisplayName: normalizeString(config.videoDisplayName),
    posterUrl: normalizeString(config.posterUrl),
    posterFileName: normalizeString(config.posterFileName),
    posterDisplayName: normalizeString(config.posterDisplayName),
    title: normalizeString(config.title),
    description: normalizeString(config.description),
    enabled: config.enabled,
    updatedAt: normalizeString(config.updatedAt),
  };
}

function requireString(record: UnknownRecord, key: keyof HomeVideoConfig) {
  const value = record[key];

  if (typeof value !== 'string') {
    throw createValidationError(`${key} must be string`);
  }

  return value.trim();
}

function rejectUnknownHomeVideoKeys(record: UnknownRecord) {
  const unknownKey = Object.keys(record).find((key) => !HOME_VIDEO_KEYS.has(key));

  if (unknownKey) {
    throw createValidationError(`${unknownKey} is not allowed`);
  }
}

function validateHomeVideoWriteRecord(value: unknown): HomeVideoWriteRecord {
  if (!isPlainRecord(value)) {
    throw createValidationError('Home video config must be an object');
  }

  rejectUnknownHomeVideoKeys(value);

  if (typeof value.enabled !== 'boolean') {
    throw createValidationError('enabled must be boolean');
  }

  if (value.updatedAt !== undefined && typeof value.updatedAt !== 'string') {
    throw createValidationError('updatedAt must be string');
  }

  for (const key of HOME_VIDEO_REQUIRED_STRING_KEYS) {
    requireString(value, key);
  }

  if (value.enabled && !(value.videoUrl as string).trim()) {
    throw createValidationError('enabled home video must have videoUrl');
  }

  return value as HomeVideoWriteRecord;
}

function normalizeHomeVideoWriteBody(value: HomeVideoWriteRecord, updatedAtFallback: string): HomeVideoConfig {
  const nextConfig: HomeVideoConfig = {
    videoUrl: value.videoUrl.trim(),
    videoFileName: value.videoFileName.trim(),
    videoDisplayName: value.videoDisplayName.trim(),
    posterUrl: value.posterUrl.trim(),
    posterFileName: value.posterFileName.trim(),
    posterDisplayName: value.posterDisplayName.trim(),
    title: value.title.trim(),
    description: value.description.trim(),
    enabled: value.enabled,
    updatedAt: value.updatedAt === undefined
      ? updatedAtFallback.trim()
      : value.updatedAt.trim(),
  };

  if (nextConfig.enabled && !nextConfig.videoUrl) {
    throw createValidationError('enabled home video must have videoUrl');
  }

  return nextConfig;
}

async function writeHomeVideoJson(config: HomeVideoConfig) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

async function readHomeVideoConfigFromJson() {
  await fs.mkdir(dataDir, { recursive: true });

  try {
    const raw = await fs.readFile(configPath, 'utf8');
    const normalizedRaw = normalizeJsonText(raw);
    if (!normalizedRaw) {
      logger.warn('Home video config is empty. Falling back to default config.', { path: configPath });
      return createDefaultHomeVideoConfig();
    }

    const parsed = JSON.parse(normalizedRaw) as Partial<HomeVideoConfig>;

    return normalizeHomeVideoConfig({
      ...createDefaultHomeVideoConfig(),
      ...parsed,
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : false,
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return createDefaultHomeVideoConfig();
    }

    if (isRecoverableConfigError(error)) {
      logger.warn('Home video config is invalid. Falling back to default config.', {
        path: configPath,
        message: error instanceof Error ? error.message : String(error),
      });
      return createDefaultHomeVideoConfig();
    }

    throw error;
  }
}

export async function readHomeVideoConfig() {
  return readHomeVideoWithMysqlFallback(
    readHomeVideoConfigFromJson,
    (value) => normalizeHomeVideoConfig(value as Partial<HomeVideoConfig>),
  );
}

export async function writeHomeVideoConfig(config: unknown) {
  const writeRecord = validateHomeVideoWriteRecord(config);
  const updatedAtFallback = typeof writeRecord.updatedAt === 'string'
    ? writeRecord.updatedAt
    : (await readHomeVideoConfigFromJson()).updatedAt;
  const nextConfig = normalizeHomeVideoWriteBody(writeRecord, updatedAtFallback);

  await writeHomeVideoToMysqlPrimary(nextConfig);

  try {
    await writeHomeVideoJson(nextConfig);
  } catch (error) {
    logger.error('Home-video JSON shadow write-back failed after MySQL primary write succeeded.', {
      moduleName: MODULE_NAME,
      operation: 'json-shadow-write-back',
      jsonPath: configPath,
      message: error instanceof Error ? error.message : String(error),
    });

    throw createJsonShadowWriteError(error);
  }

  return nextConfig;
}
