import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

type PublishLogObject = Record<string, unknown>;

export interface PublishLogSummary {
  publishId: string;
  fileName: string;
  startedAt: string;
  finishedAt: string;
  status: string;
  totalRoutes: number;
  generatedCount: number;
  failedCount: number;
  skippedCount: number;
  triggeredBy: string;
  error?: string;
}

interface PublishLogEntry {
  fileName: string;
  filePath: string;
  mtimeMs: number;
  sortTime: number;
  log: PublishLogObject | null;
  error?: string;
}

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const publishLogsDir = path.join(serverRoot, 'data', 'publish-logs');

function createPublishError(message: string, statusCode: number, code: string) {
  return Object.assign(new Error(message), {
    statusCode,
    code,
  });
}

function asText(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function arrayLength(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function parseSortTime(log: PublishLogObject | null, mtimeMs: number) {
  const startedAt = asText(log?.startedAt);
  const startedAtMs = Date.parse(startedAt);
  return Number.isFinite(startedAtMs) ? startedAtMs : mtimeMs;
}

async function readPublishLogEntries(): Promise<PublishLogEntry[]> {
  let dirEntries;

  try {
    dirEntries = await fs.readdir(publishLogsDir, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }

    throw error;
  }

  const jsonFiles = dirEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name);

  const entries = await Promise.all(
    jsonFiles.map(async (fileName) => {
      const filePath = path.join(publishLogsDir, fileName);
      const stat = await fs.stat(filePath);

      try {
        const raw = await fs.readFile(filePath, 'utf8');
        const parsed = JSON.parse(raw) as PublishLogObject;
        const log = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
        const error = log ? undefined : 'Publish log JSON root must be an object.';

        return {
          fileName,
          filePath,
          mtimeMs: stat.mtimeMs,
          sortTime: parseSortTime(log, stat.mtimeMs),
          log,
          error,
        };
      } catch (error) {
        return {
          fileName,
          filePath,
          mtimeMs: stat.mtimeMs,
          sortTime: stat.mtimeMs,
          log: null,
          error: error instanceof Error ? error.message : 'Unable to parse publish log JSON.',
        };
      }
    }),
  );

  return entries.sort((a, b) => b.sortTime - a.sortTime || b.mtimeMs - a.mtimeMs);
}

function createInvalidSummary(entry: PublishLogEntry): PublishLogSummary {
  const publishId = path.basename(entry.fileName, '.json');

  return {
    publishId,
    fileName: entry.fileName,
    startedAt: '',
    finishedAt: '',
    status: 'invalid',
    totalRoutes: 0,
    generatedCount: 0,
    failedCount: 0,
    skippedCount: 0,
    triggeredBy: '',
    error: entry.error || 'Invalid publish log JSON.',
  };
}

function createSummary(entry: PublishLogEntry): PublishLogSummary {
  if (!entry.log || entry.error) {
    return createInvalidSummary(entry);
  }

  return {
    publishId: asText(entry.log.publishId, path.basename(entry.fileName, '.json')),
    fileName: entry.fileName,
    startedAt: asText(entry.log.startedAt),
    finishedAt: asText(entry.log.finishedAt),
    status: asText(entry.log.status, 'unknown'),
    totalRoutes: asNumber(entry.log.totalRoutes),
    generatedCount: arrayLength(entry.log.generatedRoutes),
    failedCount: arrayLength(entry.log.failedRoutes),
    skippedCount: arrayLength(entry.log.skippedRoutes),
    triggeredBy: asText(entry.log.triggeredBy),
  };
}

function createInvalidLog(entry: PublishLogEntry) {
  return {
    publishId: path.basename(entry.fileName, '.json'),
    fileName: entry.fileName,
    status: 'invalid',
    error: entry.error || 'Invalid publish log JSON.',
  };
}

function normalizeLogId(id: string) {
  return id.trim().replace(/\\/g, '/').split('/').pop() || '';
}

function matchesLogId(entry: PublishLogEntry, requestedId: string) {
  const normalizedId = normalizeLogId(requestedId);
  const idWithoutExtension = normalizedId.endsWith('.json') ? normalizedId.slice(0, -5) : normalizedId;
  const fileName = normalizedId.endsWith('.json') ? normalizedId : `${normalizedId}.json`;
  const publishId = entry.log ? asText(entry.log.publishId) : '';

  return entry.fileName === fileName || path.basename(entry.fileName, '.json') === idWithoutExtension || publishId === idWithoutExtension;
}

export async function listPublishLogs() {
  const entries = await readPublishLogEntries();
  return entries.map(createSummary);
}

export async function getLatestPublishLog() {
  const entries = await readPublishLogEntries();
  const latestEntry = entries[0];

  if (!latestEntry) {
    return null;
  }

  return latestEntry.log && !latestEntry.error ? latestEntry.log : createInvalidLog(latestEntry);
}

export async function getPublishLogById(id: string) {
  const entries = await readPublishLogEntries();
  const entry = entries.find((item) => matchesLogId(item, id));

  if (!entry) {
    throw createPublishError('Publish log not found.', 404, 'PUBLISH_LOG_NOT_FOUND');
  }

  return entry.log && !entry.error ? entry.log : createInvalidLog(entry);
}
