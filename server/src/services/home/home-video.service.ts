import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HomeVideoConfig } from '../../../../shared/types/home.js';
import { readHomeVideoWithMysqlFallback } from '../data-source/low-risk-content-source.js';
import { logger } from '../../utils/logger.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const dataDir = path.join(serverRoot, 'data');
const configPath = path.join(dataDir, 'home-video.json');

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
    updatedAt: normalizeString(config.updatedAt) || new Date().toISOString(),
  };
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

export async function writeHomeVideoConfig(config: Partial<HomeVideoConfig>) {
  const nextConfig = normalizeHomeVideoConfig({
    ...createDefaultHomeVideoConfig(),
    ...config,
    updatedAt: new Date().toISOString(),
  });

  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, 'utf8');

  return nextConfig;
}
