import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HomeInteractiveImageSlot } from '../../../../shared/types/home.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const dataDir = path.join(serverRoot, 'data');
const configPath = path.join(dataDir, 'home-interactive-images.json');

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

function createValidationError(message: string) {
  return Object.assign(new Error(message), {
    statusCode: 400,
    code: 'INVALID_HOME_INTERACTIVE_IMAGES',
  });
}

function normalizeSlot(slot: HomeInteractiveImageSlot): HomeInteractiveImageSlot {
  return {
    slotNo: slot.slotNo,
    mediaUrl: slot.mediaUrl.trim(),
    mediaFileName: slot.mediaFileName.trim(),
    alt: slot.alt.trim(),
    sortOrder: slot.sortOrder,
    enabled: slot.enabled,
  };
}

export function validateHomeInteractiveSlots(slots: HomeInteractiveImageSlot[]) {
  if (!Array.isArray(slots) || slots.length !== 12) {
    throw createValidationError('Home interactive images must contain exactly 12 slots');
  }

  const slotNumbers = new Set<number>();

  return slots.map((slot) => {
    if (!Number.isInteger(slot.slotNo) || slot.slotNo < 1 || slot.slotNo > 12) {
      throw createValidationError('slotNo must be an integer from 1 to 12');
    }

    if (slotNumbers.has(slot.slotNo)) {
      throw createValidationError('slotNo must be unique');
    }

    slotNumbers.add(slot.slotNo);

    if (typeof slot.mediaUrl !== 'string' || typeof slot.mediaFileName !== 'string') {
      throw createValidationError('mediaUrl and mediaFileName must be strings');
    }

    if (typeof slot.alt !== 'string') {
      throw createValidationError('alt must be a string');
    }

    if (typeof slot.enabled !== 'boolean') {
      throw createValidationError('enabled must be boolean');
    }

    if (typeof slot.sortOrder !== 'number' || !Number.isFinite(slot.sortOrder)) {
      throw createValidationError('sortOrder must be a number');
    }

    return normalizeSlot(slot);
  }).sort((a, b) => a.slotNo - b.slotNo);
}

export async function readHomeInteractiveImages() {
  await fs.mkdir(dataDir, { recursive: true });

  try {
    const raw = await fs.readFile(configPath, 'utf8');
    const parsed = JSON.parse(raw) as HomeInteractiveImageSlot[];

    return validateHomeInteractiveSlots(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }

    const defaultSlots = createDefaultSlots();
    await writeHomeInteractiveImages(defaultSlots);
    return defaultSlots;
  }
}

export async function writeHomeInteractiveImages(slots: HomeInteractiveImageSlot[]) {
  const nextSlots = validateHomeInteractiveSlots(slots);

  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(configPath, `${JSON.stringify(nextSlots, null, 2)}\n`, 'utf8');

  return nextSlots;
}
