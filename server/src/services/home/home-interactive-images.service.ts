import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HomeInteractiveImageSlot } from '../../../../shared/types/home.js';
import { writeHomeInteractiveImagesToMysqlPrimary } from '../data-source/home-interactive-images-primary-write.js';
import { readHomeInteractiveImagesWithMysqlFallback } from '../data-source/low-risk-content-source.js';
import { logger } from '../../utils/logger.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const dataDir = path.join(serverRoot, 'data');
const configPath = path.join(dataDir, 'home-interactive-images.json');
const MODULE_NAME = 'home-interactive-images';

type UnknownRecord = Record<string, unknown>;

function createDefaultSlots(): HomeInteractiveImageSlot[] {
  return Array.from({ length: 12 }, (_, index) => ({
    slotNo: index + 1,
    mediaUrl: '',
    mediaFileName: '',
    alt: '',
    sortOrder: index + 1,
    enabled: true,
  }));
}

function normalizeJsonText(text: string) {
  return text.replace(/^\uFEFF/, '').trim();
}

function isRecoverableConfigError(error: unknown) {
  return error instanceof SyntaxError
    || (typeof error === 'object'
      && error !== null
      && 'code' in error
      && error.code === 'INVALID_HOME_INTERACTIVE_IMAGES');
}

function createValidationError(message: string) {
  return Object.assign(new Error(message), {
    statusCode: 400,
    code: 'INVALID_HOME_INTERACTIVE_IMAGES',
  });
}

function createJsonShadowWriteError(error: unknown) {
  return Object.assign(
    new Error('Home-interactive-images MySQL primary write succeeded, but JSON shadow write-back failed.'),
    {
      statusCode: 500,
      code: 'HOME_INTERACTIVE_IMAGES_JSON_SHADOW_WRITE_FAILED',
      cause: error,
    },
  );
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateHomeInteractiveSlots(slots: unknown): HomeInteractiveImageSlot[] {
  if (!Array.isArray(slots) || slots.length !== 12) {
    throw createValidationError('Home interactive images must contain exactly 12 slots');
  }

  const slotNumbers = new Set<number>();

  return slots.map((slot) => {
    if (!isRecord(slot)) {
      throw createValidationError('Each home interactive image slot must be an object');
    }

    const { slotNo, mediaUrl, mediaFileName, alt, sortOrder, enabled } = slot;

    if (typeof slotNo !== 'number' || !Number.isInteger(slotNo) || slotNo < 1 || slotNo > 12) {
      throw createValidationError('slotNo must be an integer from 1 to 12');
    }

    if (slotNumbers.has(slotNo)) {
      throw createValidationError('slotNo must be unique');
    }

    slotNumbers.add(slotNo);

    if (typeof mediaUrl !== 'string' || typeof mediaFileName !== 'string') {
      throw createValidationError('mediaUrl and mediaFileName must be strings');
    }

    if (typeof alt !== 'string') {
      throw createValidationError('alt must be a string');
    }

    if (typeof enabled !== 'boolean') {
      throw createValidationError('enabled must be boolean');
    }

    if (typeof sortOrder !== 'number' || !Number.isFinite(sortOrder)) {
      throw createValidationError('sortOrder must be a number');
    }

    return {
      slotNo,
      mediaUrl: mediaUrl.trim(),
      mediaFileName: mediaFileName.trim(),
      alt: alt.trim(),
      sortOrder,
      enabled,
    };
  }).sort((a, b) => a.slotNo - b.slotNo);
}

async function writeHomeInteractiveImagesJson(slots: HomeInteractiveImageSlot[]) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(configPath, `${JSON.stringify(slots, null, 2)}\n`, 'utf8');
}

async function readHomeInteractiveImagesFromJson() {
  await fs.mkdir(dataDir, { recursive: true });

  try {
    const raw = await fs.readFile(configPath, 'utf8');
    const normalizedRaw = normalizeJsonText(raw);
    if (!normalizedRaw) {
      logger.warn('Home interactive images config is empty. Falling back to default slots.', { path: configPath });
      return createDefaultSlots();
    }

    const parsed = JSON.parse(normalizedRaw) as HomeInteractiveImageSlot[];

    return validateHomeInteractiveSlots(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      const defaultSlots = createDefaultSlots();
      await writeHomeInteractiveImagesJson(defaultSlots);
      return defaultSlots;
    }

    if (isRecoverableConfigError(error)) {
      logger.warn('Home interactive images config is invalid. Falling back to default slots.', {
        path: configPath,
        message: error instanceof Error ? error.message : String(error),
      });
      return createDefaultSlots();
    }

    throw error;
  }
}

export async function readHomeInteractiveImages() {
  return readHomeInteractiveImagesWithMysqlFallback(
    readHomeInteractiveImagesFromJson,
    (value) => validateHomeInteractiveSlots(value),
  );
}

export async function writeHomeInteractiveImages(slots: unknown) {
  const nextSlots = validateHomeInteractiveSlots(slots);

  await writeHomeInteractiveImagesToMysqlPrimary(nextSlots);

  try {
    await writeHomeInteractiveImagesJson(nextSlots);
  } catch (error) {
    logger.error('Home-interactive-images JSON shadow write-back failed after MySQL primary write succeeded.', {
      moduleName: MODULE_NAME,
      operation: 'json-shadow-write-back',
      jsonPath: configPath,
      message: error instanceof Error ? error.message : String(error),
    });

    throw createJsonShadowWriteError(error);
  }

  return nextSlots;
}
