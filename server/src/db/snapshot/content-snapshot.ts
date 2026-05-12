import { execFile } from 'node:child_process';
import { copyFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { hashJsonValue, sha256 } from '../migration/hash.js';
import type { MigrationModuleName, MigrationPlan, SourceManifestEntry } from '../migration/types.js';

const execFileAsync = promisify(execFile);
const snapshotDir = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(snapshotDir, '../../..');
const projectRoot = path.resolve(serverRoot, '..');
const dataDir = path.join(serverRoot, 'data');
const publishLogsDir = path.join(dataDir, 'publish-logs');
const backupRoot = path.join(serverRoot, 'data-backups', 'mysql-migration');
const latestPublishLogCopyLimit = 20;

export type ContentSnapshotResult = {
  batchId: string;
  createdAt: string;
  gitCommit: string | null;
  snapshotDir: string;
  manifestPath: string;
  manifest: SourceManifestEntry[];
};

type PublishLogIndexEntry = {
  file_name: string;
  relative_path: string;
  raw_file_hash: string;
  file_size: number;
  modified_at: string;
};

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}

function createTimestamp(date: Date): string {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
    '-',
    date.getMilliseconds().toString().padStart(3, '0'),
  ].join('');
}

function hasErrorCode(error: unknown, code: string): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as NodeJS.ErrnoException).code === code,
  );
}

async function createUniqueSnapshotDirectory(date: Date): Promise<{
  batchId: string;
  snapshotPath: string;
}> {
  await mkdir(backupRoot, { recursive: true });

  const baseBatchId = createTimestamp(date);

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const suffix = attempt === 0 ? '' : `-${attempt.toString().padStart(2, '0')}`;
    const batchId = `${baseBatchId}${suffix}`;
    const snapshotPath = path.join(backupRoot, batchId);

    try {
      await mkdir(snapshotPath, { recursive: false });
      return { batchId, snapshotPath };
    } catch (error) {
      if (hasErrorCode(error, 'EEXIST')) {
        continue;
      }

      throw error;
    }
  }

  throw new Error(`Unable to create a unique snapshot directory under ${backupRoot}.`);
}

function toProjectRelative(absolutePath: string): string {
  return path.relative(projectRoot, absolutePath).split(path.sep).join('/');
}

function countJsonRecords(data: unknown): number {
  if (Array.isArray(data)) {
    return data.length;
  }

  if (data && typeof data === 'object') {
    return Object.keys(data).length;
  }

  return data === null || data === undefined ? 0 : 1;
}

async function readGitCommit(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: projectRoot });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function listTopLevelJsonFiles(): Promise<string[]> {
  const entries = await readdir(dataDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

async function buildTopLevelJsonManifestEntry(input: {
  batchId: string;
  createdAt: string;
  gitCommit: string | null;
  fileName: string;
  includedModuleNames: Set<MigrationModuleName>;
  plan: MigrationPlan;
}): Promise<SourceManifestEntry> {
  const absolutePath = path.join(dataDir, input.fileName);
  const [rawContent, fileStat] = await Promise.all([readFile(absolutePath, 'utf8'), stat(absolutePath)]);
  const modulePlan = input.plan.modules.find((module) => module.sourceFile === input.fileName);
  const notes: string[] = [];
  let parsed: unknown = null;
  let sourceHash: string | null = null;
  let recordCount = 0;

  try {
    parsed = JSON.parse(rawContent) as unknown;
    sourceHash = modulePlan?.sourceHash ?? hashJsonValue(parsed);
    recordCount = modulePlan?.sourceCount ?? countJsonRecords(parsed);
  } catch (error) {
    sourceHash = sha256(rawContent);
    notes.push(error instanceof Error ? `JSON parse warning: ${error.message}` : 'JSON parse warning.');
  }

  if (!modulePlan) {
    notes.push('Snapshot-only source; no 22-3B-3 migration module is registered for this file.');
  }

  return {
    batch_id: input.batchId,
    created_at: input.createdAt,
    git_commit: input.gitCommit,
    source_file: input.fileName,
    relative_path: toProjectRelative(absolutePath),
    source_hash: sourceHash,
    raw_file_hash: sha256(rawContent),
    file_size: fileStat.size,
    record_count: recordCount,
    included_in_migration: modulePlan ? input.includedModuleNames.has(modulePlan.moduleName) : false,
    notes,
  };
}

async function buildPublishLogIndex(): Promise<PublishLogIndexEntry[]> {
  try {
    const entries = await readdir(publishLogsDir, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
    const index: PublishLogIndexEntry[] = [];

    for (const fileName of files) {
      const absolutePath = path.join(publishLogsDir, fileName);
      const [rawContent, fileStat] = await Promise.all([readFile(absolutePath, 'utf8'), stat(absolutePath)]);
      index.push({
        file_name: fileName,
        relative_path: toProjectRelative(absolutePath),
        raw_file_hash: sha256(rawContent),
        file_size: fileStat.size,
        modified_at: fileStat.mtime.toISOString(),
      });
    }

    return index;
  } catch {
    return [];
  }
}

async function copySnapshotFiles(snapshotPath: string, publishLogIndex: PublishLogIndexEntry[]): Promise<void> {
  const dataSnapshotDir = path.join(snapshotPath, 'server', 'data');
  await mkdir(dataSnapshotDir, { recursive: true });

  for (const fileName of await listTopLevelJsonFiles()) {
    await copyFile(path.join(dataDir, fileName), path.join(dataSnapshotDir, fileName));
  }

  const publishLogsSnapshotDir = path.join(dataSnapshotDir, 'publish-logs');
  await mkdir(publishLogsSnapshotDir, { recursive: true });
  await writeFile(
    path.join(publishLogsSnapshotDir, 'publish-logs-index.json'),
    `${JSON.stringify(publishLogIndex, null, 2)}\n`,
    'utf8',
  );

  const latestLogsDir = path.join(publishLogsSnapshotDir, 'latest');
  await mkdir(latestLogsDir, { recursive: true });

  for (const entry of publishLogIndex.slice(-latestPublishLogCopyLimit)) {
    await copyFile(path.join(publishLogsDir, entry.file_name), path.join(latestLogsDir, entry.file_name));
  }
}

export async function createContentSnapshot(plan: MigrationPlan): Promise<ContentSnapshotResult> {
  const now = new Date();
  const createdAt = now.toISOString();
  const { batchId, snapshotPath } = await createUniqueSnapshotDirectory(now);
  const gitCommit = await readGitCommit();
  const includedModuleNames = new Set(plan.modules.map((module) => module.moduleName));
  const publishLogIndex = await buildPublishLogIndex();
  const manifest: SourceManifestEntry[] = [];

  await copySnapshotFiles(snapshotPath, publishLogIndex);

  for (const fileName of await listTopLevelJsonFiles()) {
    manifest.push(
      await buildTopLevelJsonManifestEntry({
        batchId,
        createdAt,
        gitCommit,
        fileName,
        includedModuleNames,
        plan,
      }),
    );
  }

  const publishLogsModulePlan = plan.modules.find((module) => module.moduleName === 'publish-logs');
  const totalPublishLogSize = publishLogIndex.reduce((sum, entry) => sum + entry.file_size, 0);

  manifest.push({
    batch_id: batchId,
    created_at: createdAt,
    git_commit: gitCommit,
    source_file: 'publish-logs/*.json',
    relative_path: toProjectRelative(publishLogsDir),
    source_hash: publishLogsModulePlan?.sourceHash ?? hashJsonValue(publishLogIndex),
    raw_file_hash: hashJsonValue(publishLogIndex),
    file_size: totalPublishLogSize,
    record_count: publishLogsModulePlan?.sourceCount ?? publishLogIndex.length,
    included_in_migration: includedModuleNames.has('publish-logs'),
    notes: [
      'Snapshot stores publish-logs-index.json for all publish logs and copies the latest logs needed for inspection.',
    ],
  });

  const manifestPath = path.join(snapshotPath, 'source-manifest.json');
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  return {
    batchId,
    createdAt,
    gitCommit,
    snapshotDir: snapshotPath,
    manifestPath,
    manifest,
  };
}
