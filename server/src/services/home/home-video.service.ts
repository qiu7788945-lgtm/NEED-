import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HomeVideoConfig } from '../../../../shared/types/home.js';

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

export async function readHomeVideoConfig() {
  await fs.mkdir(dataDir, { recursive: true });

  try {
    const raw = await fs.readFile(configPath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<HomeVideoConfig>;

    return normalizeHomeVideoConfig({
      ...createDefaultHomeVideoConfig(),
      ...parsed,
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : false,
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }

    return createDefaultHomeVideoConfig();
  }
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
