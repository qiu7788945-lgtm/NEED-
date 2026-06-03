import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { writeJsonFile } from './manifest-writer.js';
import type { ExportRisk } from './types.js';

type BackupFileEntry = {
  relativePath: string;
  backupPath: string;
  sha256: string | null;
  rollbackEligible: boolean;
  warnings: string[];
  specialHandling: string | null;
};

type BackupManifest = {
  schemaVersion: '22-7-5C-3-backup-manifest';
  backupId: string;
  backupRoot: string;
  files: BackupFileEntry[];
};

type RestoredFileEntry = {
  relativePath: string;
  backupPath: string;
  restorePath: string;
  rollbackEligible: true;
  backupSha256: string;
  restoredSha256: string;
  hashMatched: boolean;
  sizeBytes: number;
  recordCount: number;
  shapeSummary: Record<string, unknown>;
  warnings: string[];
};

type SkippedFileEntry = {
  relativePath: string;
  backupPath: string | null;
  rollbackEligible: boolean;
  reason: string;
};

type ExcludedItemEntry = {
  item: string;
  reason: string;
};

type RestoreManifest = {
  schemaVersion: '22-7-5D-3-restore-manifest';
  rehearsalId: string;
  createdAt: string;
  sourceBackupId: string;
  sourceBackupManifestPath: string;
  sourceBackupManifestSha256: string;
  sourceBackupRoot: string;
  restoreRoot: string;
  mode: 'temp-only';
  overwroteServerData: false;
  wroteMysql: false;
  restoredFiles: RestoredFileEntry[];
  skippedFiles: SkippedFileEntry[];
  excludedItems: ExcludedItemEntry[];
  validationStatus: 'passed' | 'failed';
  risks: ExportRisk[];
  failureReportPath: string | null;
};

type RestoreSummary = {
  rehearsalId: string;
  createdAt: string;
  status: 'passed' | 'failed';
  sourceBackupId: string;
  restoreRoot: string;
  requiredRestoreCount: number;
  restoredFileCount: number;
  skippedFileCount: number;
  excludedItemCount: number;
  warningCount: number;
  blockerCount: number;
  overwroteServerData: false;
  wroteMysql: false;
};

type RestoreFailureReport = {
  failedAt: string;
  rehearsalId: string;
  sourceBackupId: string;
  failedStep: string;
  failedFile: string | null;
  errorMessage: string;
  partialFilesRestored: string[];
  cleanupStatus: 'not_attempted';
  serverDataTouched: false;
  mysqlTouched: false;
  uploadsTouched: false;
  manualActionRequired: string;
  risks: ExportRisk[];
};

export type RollbackRehearsalResult = {
  mode: 'rollback-rehearsal-temp-only';
  status: 'passed';
  rehearsalId: string;
  restoreRoot: string;
  restoreManifestPath: string;
  restoreSummaryPath: string;
  risksPath: string;
  failureReportPath: null;
  sourceBackupId: string;
  sourceBackupManifestPath: string;
  requiredRestoreCount: number;
  restoredFileCount: number;
  skippedFileCount: number;
  excludedItemCount: number;
  overwroteServerData: false;
  wroteMysql: false;
};

export class RollbackRehearsalError extends Error {
  failureReportPath: string | null;
  restoreRoot: string | null;

  constructor(message: string, input: {
    failureReportPath: string | null;
    restoreRoot: string | null;
  }) {
    super(message);
    this.name = 'RollbackRehearsalError';
    this.failureReportPath = input.failureReportPath;
    this.restoreRoot = input.restoreRoot;
  }
}

const requiredRollbackEligibleFiles = [
  'server/data/contact-info.json',
  'server/data/company-assets.json',
  'server/data/home-video.json',
  'server/data/home-interactive-images.json',
  'server/data/articles.json',
  'server/data/cases.json',
  'server/data/solutions.json',
  'server/data/pages.json',
  'server/data/scenario-detail-pages.json',
] as const;

const requiredRollbackEligibleSet = new Set<string>(requiredRollbackEligibleFiles);

const excludedItems: ExcludedItemEntry[] = [
  {
    item: 'media-library.json',
    reason: 'metadata safety anchor only; not first-phase rollback eligible.',
  },
  {
    item: 'server/data/publish-logs/**',
    reason: 'publish logs are audit records, not content rollback input.',
  },
  {
    item: 'server/uploads/**',
    reason: 'uploads need a separate physical/object-storage restore strategy.',
  },
  {
    item: 'MySQL',
    reason: 'temp-only rehearsal does not restore or write MySQL.',
  },
  {
    item: 'tombstone rows',
    reason: 'tombstone/deleted_at row restore is outside first-phase scope.',
  },
  {
    item: 'migration_logs',
    reason: 'migration logs are not content rollback input.',
  },
  {
    item: 'dist-prerender',
    reason: 'generated prerender output is not content rollback input.',
  },
  {
    item: 'export outputs',
    reason: 'dry-run export artifacts are not rollback input.',
  },
  {
    item: 'backup directory itself',
    reason: 'rehearsal must read from backup and must not modify backup output.',
  },
];

function formatTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

function hashContent(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeRelativePath(value: string): string {
  return value.replace(/\\/g, '/');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asNonEmptyString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Backup manifest field ${fieldName} must be a non-empty string.`);
  }

  return value;
}

function isInsidePath(candidate: string, parent: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function readGitValue(args: string[], fallback: string): string {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim() || fallback;
  } catch {
    return fallback;
  }
}

function readGitStatus(): string {
  return readGitValue(['status', '--short', '-uall'], '');
}

function countJsonRecords(value: unknown): number {
  if (Array.isArray(value)) {
    return value.length;
  }

  if (value && typeof value === 'object') {
    return Object.keys(value).length;
  }

  return value === null || value === undefined ? 0 : 1;
}

function summarizeShape(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) {
    const firstRecord = value.find((item) => item && typeof item === 'object' && !Array.isArray(item));
    return {
      type: 'array',
      length: value.length,
      firstRecordKeys: firstRecord && typeof firstRecord === 'object'
        ? Object.keys(firstRecord as Record<string, unknown>).sort()
        : [],
    };
  }

  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return {
      type: 'object',
      keyCount: keys.length,
      keys,
    };
  }

  return {
    type: value === null ? 'null' : typeof value,
  };
}

function buildRehearsalRisks(): ExportRisk[] {
  return [
    {
      code: 'temp_only_rehearsal',
      level: 'info',
      message: 'Rollback rehearsal restores only to a temporary rehearsal directory.',
    },
    {
      code: 'server_data_not_overwritten',
      level: 'info',
      message: 'server/data is not overwritten by --rehearse-rollback.',
    },
    {
      code: 'mysql_not_restored',
      level: 'warning',
      message: 'MySQL rows are not restored by temp-only rollback rehearsal.',
    },
    {
      code: 'uploads_not_restored',
      level: 'warning',
      message: 'server/uploads is not restored by temp-only rollback rehearsal.',
    },
    {
      code: 'publish_logs_not_restored',
      level: 'warning',
      message: 'server/data/publish-logs is not restored by temp-only rollback rehearsal.',
    },
    {
      code: 'media_library_not_restored',
      level: 'warning',
      message: 'media-library.json is skipped because it is not first-phase rollback eligible.',
    },
    {
      code: 'rollback_command_still_disabled',
      level: 'blocker',
      message: '--rollback remains disabled; formal rollback is not implemented.',
    },
    {
      code: 'write_mode_still_disabled',
      level: 'blocker',
      message: '--write remains disabled and must not overwrite server/data.',
    },
    {
      code: 'formal_rollback_not_implemented',
      level: 'blocker',
      message: 'This rehearsal does not implement formal rollback.',
    },
    {
      code: 'fallback_still_required',
      level: 'blocker',
      message: 'JSON fallback remains required after temp-only rehearsal.',
    },
  ];
}

function resolveDefaultRestoreRoot(projectRoot: string, generatedAt: Date): string {
  return path.join(
    projectRoot,
    'server',
    'data-restore-rehearsals',
    'mysql-json-export',
    formatTimestamp(generatedAt),
  );
}

function resolveRestoreRoot(input: {
  projectRoot: string;
  generatedAt: Date;
  restoreDir?: string;
}): string {
  const restoreRoot = path.resolve(
    input.projectRoot,
    input.restoreDir ?? resolveDefaultRestoreRoot(input.projectRoot, input.generatedAt),
  );
  const serverDataDir = path.resolve(input.projectRoot, 'server', 'data');
  const serverUploadsDir = path.resolve(input.projectRoot, 'server', 'uploads');
  const backupStorageDir = path.resolve(input.projectRoot, 'server', 'data-backups');

  if (isInsidePath(restoreRoot, serverDataDir)) {
    throw new RollbackRehearsalError('--restore-dir must not point inside server/data.', {
      failureReportPath: null,
      restoreRoot,
    });
  }

  if (isInsidePath(restoreRoot, serverUploadsDir)) {
    throw new RollbackRehearsalError('--restore-dir must not point inside server/uploads.', {
      failureReportPath: null,
      restoreRoot,
    });
  }

  if (isInsidePath(restoreRoot, backupStorageDir)) {
    throw new RollbackRehearsalError('--restore-dir must not point inside server/data-backups.', {
      failureReportPath: null,
      restoreRoot,
    });
  }

  return restoreRoot;
}

async function createRestoreRoot(restoreRoot: string): Promise<void> {
  await fs.mkdir(path.dirname(restoreRoot), { recursive: true });

  try {
    await fs.mkdir(restoreRoot, { recursive: false });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new RollbackRehearsalError(`Restore rehearsal directory already exists and will not be overwritten: ${restoreRoot}`, {
        failureReportPath: null,
        restoreRoot,
      });
    }

    throw error;
  }
}

async function readJsonFile(input: {
  filePath: string;
}): Promise<{
  raw: string;
  data: unknown;
  sha256: string;
  sizeBytes: number;
}> {
  const raw = await fs.readFile(input.filePath, 'utf8');
  const data = JSON.parse(raw) as unknown;
  const stats = await fs.stat(input.filePath);
  return {
    raw,
    data,
    sha256: hashContent(raw),
    sizeBytes: stats.size,
  };
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function parseBackupManifest(value: unknown): BackupManifest {
  if (!isRecord(value)) {
    throw new Error('backup-manifest.json must contain a JSON object.');
  }

  if (value.schemaVersion !== '22-7-5C-3-backup-manifest') {
    throw new Error('Unsupported backup manifest schemaVersion.');
  }

  const backupId = asNonEmptyString(value.backupId, 'backupId');
  const backupRoot = asNonEmptyString(value.backupRoot, 'backupRoot');

  if (!Array.isArray(value.files)) {
    throw new Error('Backup manifest field files must be an array.');
  }

  const files = value.files.map((file, index): BackupFileEntry => {
    if (!isRecord(file)) {
      throw new Error(`Backup manifest files[${index}] must be an object.`);
    }

    const relativePath = normalizeRelativePath(asNonEmptyString(file.relativePath, `files[${index}].relativePath`));
    const backupPath = asNonEmptyString(file.backupPath, `files[${index}].backupPath`);

    if (typeof file.rollbackEligible !== 'boolean') {
      throw new Error(`Backup manifest files[${index}].rollbackEligible must be a boolean.`);
    }

    if (file.sha256 !== null && file.sha256 !== undefined && typeof file.sha256 !== 'string') {
      throw new Error(`Backup manifest files[${index}].sha256 must be a string or null.`);
    }

    return {
      relativePath,
      backupPath,
      sha256: typeof file.sha256 === 'string' ? file.sha256 : null,
      rollbackEligible: file.rollbackEligible,
      warnings: Array.isArray(file.warnings)
        ? file.warnings.filter((warning): warning is string => typeof warning === 'string')
        : [],
      specialHandling: typeof file.specialHandling === 'string' ? file.specialHandling : null,
    };
  });

  return {
    schemaVersion: '22-7-5C-3-backup-manifest',
    backupId,
    backupRoot,
    files,
  };
}

function isPublishLog(relativePath: string): boolean {
  return relativePath.startsWith('server/data/publish-logs/');
}

function isUploadPath(relativePath: string): boolean {
  return relativePath.startsWith('server/uploads/');
}

function isMediaLibrary(relativePath: string): boolean {
  return relativePath === 'server/data/media-library.json' || path.basename(relativePath) === 'media-library.json';
}

function skipReason(file: BackupFileEntry): string | null {
  if (!file.rollbackEligible) {
    return 'rollbackEligible=false';
  }

  if (isMediaLibrary(file.relativePath)) {
    return 'media-library is excluded from first-phase rollback rehearsal';
  }

  if (isPublishLog(file.relativePath)) {
    return 'publish logs are excluded from first-phase rollback rehearsal';
  }

  if (isUploadPath(file.relativePath)) {
    return 'uploads are excluded from first-phase rollback rehearsal';
  }

  if (!requiredRollbackEligibleSet.has(file.relativePath)) {
    return 'outside first-phase rollbackEligible JSON scope';
  }

  return null;
}

function selectRequiredFiles(files: BackupFileEntry[]): {
  selected: BackupFileEntry[];
  skipped: SkippedFileEntry[];
} {
  const selectedByPath = new Map<string, BackupFileEntry>();
  const skipped: SkippedFileEntry[] = [];

  for (const file of files) {
    const reason = skipReason(file);
    if (reason) {
      skipped.push({
        relativePath: file.relativePath,
        backupPath: file.backupPath || null,
        rollbackEligible: file.rollbackEligible,
        reason,
      });
      continue;
    }

    if (selectedByPath.has(file.relativePath)) {
      throw new Error(`Duplicate rollbackEligible file in backup manifest: ${file.relativePath}`);
    }

    selectedByPath.set(file.relativePath, file);
  }

  for (const requiredPath of requiredRollbackEligibleFiles) {
    if (!selectedByPath.has(requiredPath)) {
      throw new Error(`Required rollbackEligible file is missing from backup manifest: ${requiredPath}`);
    }
  }

  return {
    selected: requiredRollbackEligibleFiles.map((requiredPath) => selectedByPath.get(requiredPath) as BackupFileEntry),
    skipped,
  };
}

async function hashRequiredServerData(projectRoot: string): Promise<Map<string, string>> {
  const hashes = new Map<string, string>();

  for (const relativePath of requiredRollbackEligibleFiles) {
    const file = await readJsonFile({
      filePath: path.resolve(projectRoot, relativePath),
    });
    hashes.set(relativePath, file.sha256);
  }

  return hashes;
}

async function validateRequiredServerDataUnchanged(input: {
  projectRoot: string;
  before: Map<string, string>;
}): Promise<void> {
  for (const relativePath of requiredRollbackEligibleFiles) {
    const file = await readJsonFile({
      filePath: path.resolve(input.projectRoot, relativePath),
    });

    if (file.sha256 !== input.before.get(relativePath)) {
      throw new Error(`server/data changed during rollback rehearsal: ${relativePath}`);
    }
  }
}

async function hashBackupInputs(input: {
  manifestPath: string;
  files: BackupFileEntry[];
}): Promise<Map<string, string>> {
  const hashes = new Map<string, string>();
  const manifestRaw = await fs.readFile(input.manifestPath, 'utf8');
  hashes.set(input.manifestPath, hashContent(manifestRaw));

  for (const file of input.files) {
    const raw = await fs.readFile(file.backupPath, 'utf8');
    hashes.set(file.backupPath, hashContent(raw));
  }

  return hashes;
}

async function validateBackupInputsUnchanged(input: {
  before: Map<string, string>;
}): Promise<void> {
  for (const [filePath, beforeHash] of input.before) {
    const raw = await fs.readFile(filePath, 'utf8');
    if (hashContent(raw) !== beforeHash) {
      throw new Error(`Backup input changed during rollback rehearsal: ${filePath}`);
    }
  }
}

function validateBackupPaths(input: {
  manifestPath: string;
  manifest: BackupManifest;
  selectedFiles: BackupFileEntry[];
  restoreRoot: string;
  projectRoot: string;
}): void {
  const backupRoot = path.resolve(input.projectRoot, input.manifest.backupRoot);

  if (!isInsidePath(input.manifestPath, backupRoot)) {
    throw new Error('backup-manifest.json must be inside its backupRoot.');
  }

  if (isInsidePath(input.restoreRoot, backupRoot) || isInsidePath(backupRoot, input.restoreRoot)) {
    throw new Error('restoreRoot must not point to or contain the backup source directory.');
  }

  for (const file of input.selectedFiles) {
    file.backupPath = path.resolve(input.projectRoot, file.backupPath);

    if (!isInsidePath(file.backupPath, backupRoot)) {
      throw new Error(`Backup file is outside backupRoot: ${file.relativePath}`);
    }
  }
}

async function createFailureReport(input: {
  restoreRoot: string;
  rehearsalId: string;
  sourceBackupId: string;
  failedStep: string;
  failedFile: string | null;
  error: unknown;
  partialFilesRestored: string[];
  risks: ExportRisk[];
}): Promise<string | null> {
  const failureReportPath = path.join(input.restoreRoot, 'failure-report.json');
  const report: RestoreFailureReport = {
    failedAt: new Date().toISOString(),
    rehearsalId: input.rehearsalId,
    sourceBackupId: input.sourceBackupId,
    failedStep: input.failedStep,
    failedFile: input.failedFile,
    errorMessage: input.error instanceof Error ? input.error.message : String(input.error),
    partialFilesRestored: input.partialFilesRestored,
    cleanupStatus: 'not_attempted',
    serverDataTouched: false,
    mysqlTouched: false,
    uploadsTouched: false,
    manualActionRequired: 'Keep --rollback and --write disabled. Review the failure report and rerun rehearsal only after the blocker is fixed.',
    risks: input.risks,
  };

  try {
    await writeJsonFile(failureReportPath, report);
    return failureReportPath;
  } catch {
    return null;
  }
}

function buildSummary(input: {
  rehearsalId: string;
  createdAt: string;
  status: 'passed' | 'failed';
  sourceBackupId: string;
  restoreRoot: string;
  restoredFiles: RestoredFileEntry[];
  skippedFiles: SkippedFileEntry[];
  risks: ExportRisk[];
}): RestoreSummary {
  return {
    rehearsalId: input.rehearsalId,
    createdAt: input.createdAt,
    status: input.status,
    sourceBackupId: input.sourceBackupId,
    restoreRoot: input.restoreRoot,
    requiredRestoreCount: requiredRollbackEligibleFiles.length,
    restoredFileCount: input.restoredFiles.length,
    skippedFileCount: input.skippedFiles.length,
    excludedItemCount: excludedItems.length,
    warningCount: input.risks.filter((risk) => risk.level === 'warning').length
      + input.restoredFiles.reduce((sum, file) => sum + file.warnings.length, 0),
    blockerCount: input.risks.filter((risk) => risk.level === 'blocker').length,
    overwroteServerData: false,
    wroteMysql: false,
  };
}

async function writeFailureArtifacts(input: {
  restoreRoot: string;
  rehearsalId: string;
  createdAt: string;
  sourceBackupId: string;
  sourceBackupManifestPath: string;
  sourceBackupManifestSha256: string;
  sourceBackupRoot: string;
  restoredFiles: RestoredFileEntry[];
  skippedFiles: SkippedFileEntry[];
  risks: ExportRisk[];
  failedStep: string;
  failedFile: string | null;
  error: unknown;
  partialFilesRestored: string[];
}): Promise<string | null> {
  const failureReportPath = await createFailureReport({
    restoreRoot: input.restoreRoot,
    rehearsalId: input.rehearsalId,
    sourceBackupId: input.sourceBackupId,
    failedStep: input.failedStep,
    failedFile: input.failedFile,
    error: input.error,
    partialFilesRestored: input.partialFilesRestored,
    risks: input.risks,
  });
  const manifest: RestoreManifest = {
    schemaVersion: '22-7-5D-3-restore-manifest',
    rehearsalId: input.rehearsalId,
    createdAt: input.createdAt,
    sourceBackupId: input.sourceBackupId,
    sourceBackupManifestPath: input.sourceBackupManifestPath,
    sourceBackupManifestSha256: input.sourceBackupManifestSha256,
    sourceBackupRoot: input.sourceBackupRoot,
    restoreRoot: input.restoreRoot,
    mode: 'temp-only',
    overwroteServerData: false,
    wroteMysql: false,
    restoredFiles: input.restoredFiles,
    skippedFiles: input.skippedFiles,
    excludedItems,
    validationStatus: 'failed',
    risks: input.risks,
    failureReportPath,
  };
  const summary = buildSummary({
    rehearsalId: input.rehearsalId,
    createdAt: input.createdAt,
    status: 'failed',
    sourceBackupId: input.sourceBackupId,
    restoreRoot: input.restoreRoot,
    restoredFiles: input.restoredFiles,
    skippedFiles: input.skippedFiles,
    risks: input.risks,
  });

  await writeJsonFile(path.join(input.restoreRoot, 'restore-manifest.json'), manifest);
  await writeJsonFile(path.join(input.restoreRoot, 'restore-summary.json'), summary);
  await writeJsonFile(path.join(input.restoreRoot, 'risks.json'), input.risks);

  return failureReportPath;
}

export async function runRollbackRehearsal(input: {
  projectRoot: string;
  backupManifestPath: string;
  restoreDir?: string;
}): Promise<RollbackRehearsalResult> {
  const generatedAt = new Date();
  const createdAt = generatedAt.toISOString();
  const rehearsalId = formatTimestamp(generatedAt);
  const restoreRoot = resolveRestoreRoot({
    projectRoot: input.projectRoot,
    generatedAt,
    restoreDir: input.restoreDir,
  });
  const sourceBackupManifestPath = path.resolve(input.projectRoot, input.backupManifestPath);
  const risks = buildRehearsalRisks();
  const restoredFiles: RestoredFileEntry[] = [];
  const partialFilesRestored: string[] = [];
  let skippedFiles: SkippedFileEntry[] = [];
  let sourceBackupId = 'unknown';
  let sourceBackupRoot = 'unknown';
  let sourceBackupManifestSha256 = '';
  let failedStep = 'initialize-rehearsal';
  let failedFile: string | null = null;

  const gitStatusBefore = readGitStatus();
  await createRestoreRoot(restoreRoot);

  try {
    failedStep = 'read-backup-manifest';
    if (!(await pathExists(sourceBackupManifestPath))) {
      throw new Error(`Backup manifest does not exist: ${sourceBackupManifestPath}`);
    }

    const manifestFile = await readJsonFile({
      filePath: sourceBackupManifestPath,
    });
    sourceBackupManifestSha256 = manifestFile.sha256;
    const manifest = parseBackupManifest(manifestFile.data);
    sourceBackupId = manifest.backupId;
    sourceBackupRoot = path.resolve(input.projectRoot, manifest.backupRoot);

    failedStep = 'select-rollback-eligible-files';
    const selectedResult = selectRequiredFiles(manifest.files);
    skippedFiles = selectedResult.skipped;

    failedStep = 'validate-backup-paths';
    validateBackupPaths({
      manifestPath: sourceBackupManifestPath,
      manifest,
      selectedFiles: selectedResult.selected,
      restoreRoot,
      projectRoot: input.projectRoot,
    });

    failedStep = 'validate-backup-files-exist';
    for (const file of selectedResult.selected) {
      failedFile = file.relativePath;
      if (!(await pathExists(file.backupPath))) {
        throw new Error(`Backup file does not exist: ${file.backupPath}`);
      }
      if (!file.sha256) {
        throw new Error(`Backup manifest is missing sha256 for ${file.relativePath}.`);
      }
    }

    failedStep = 'snapshot-safety-state';
    failedFile = null;
    const serverDataHashesBefore = await hashRequiredServerData(input.projectRoot);
    const backupHashesBefore = await hashBackupInputs({
      manifestPath: sourceBackupManifestPath,
      files: selectedResult.selected,
    });

    failedStep = 'restore-files-temp-only';
    const filesDir = path.join(restoreRoot, 'files');
    await fs.mkdir(filesDir, { recursive: true });

    for (const file of selectedResult.selected) {
      failedFile = file.relativePath;
      const backupFile = await readJsonFile({
        filePath: file.backupPath,
      });

      if (backupFile.sha256 !== file.sha256) {
        throw new Error(`Backup file hash does not match manifest sha256: ${file.relativePath}`);
      }

      const restorePath = path.join(filesDir, path.basename(file.relativePath));
      await fs.copyFile(file.backupPath, restorePath);
      const restoredFile = await readJsonFile({
        filePath: restorePath,
      });
      const hashMatched = restoredFile.sha256 === backupFile.sha256;

      if (!hashMatched) {
        throw new Error(`Restored file hash does not match backup file hash: ${file.relativePath}`);
      }

      partialFilesRestored.push(file.relativePath);
      restoredFiles.push({
        relativePath: file.relativePath,
        backupPath: file.backupPath,
        restorePath,
        rollbackEligible: true,
        backupSha256: backupFile.sha256,
        restoredSha256: restoredFile.sha256,
        hashMatched,
        sizeBytes: restoredFile.sizeBytes,
        recordCount: countJsonRecords(restoredFile.data),
        shapeSummary: summarizeShape(restoredFile.data),
        warnings: file.warnings,
      });
    }

    failedStep = 'validate-restore-output';
    failedFile = null;
    if (restoredFiles.length !== requiredRollbackEligibleFiles.length) {
      throw new Error(`Expected ${requiredRollbackEligibleFiles.length} restored files, got ${restoredFiles.length}.`);
    }

    for (const file of restoredFiles) {
      failedFile = file.relativePath;
      if (!file.hashMatched) {
        throw new Error(`Restored file hash validation failed: ${file.relativePath}`);
      }
      await readJsonFile({
        filePath: file.restorePath,
      });
    }

    failedStep = 'validate-server-data-unchanged';
    failedFile = null;
    await validateRequiredServerDataUnchanged({
      projectRoot: input.projectRoot,
      before: serverDataHashesBefore,
    });

    failedStep = 'validate-backup-unchanged';
    await validateBackupInputsUnchanged({
      before: backupHashesBefore,
    });

    failedStep = 'validate-git-status';
    if (readGitStatus() !== gitStatusBefore) {
      throw new Error('Rollback rehearsal output changed git status. Verify server/data-restore-rehearsals is ignored or choose an ignored --restore-dir.');
    }

    const restoreManifest: RestoreManifest = {
      schemaVersion: '22-7-5D-3-restore-manifest',
      rehearsalId,
      createdAt,
      sourceBackupId,
      sourceBackupManifestPath,
      sourceBackupManifestSha256,
      sourceBackupRoot,
      restoreRoot,
      mode: 'temp-only',
      overwroteServerData: false,
      wroteMysql: false,
      restoredFiles,
      skippedFiles,
      excludedItems,
      validationStatus: 'passed',
      risks,
      failureReportPath: null,
    };
    const summary = buildSummary({
      rehearsalId,
      createdAt,
      status: 'passed',
      sourceBackupId,
      restoreRoot,
      restoredFiles,
      skippedFiles,
      risks,
    });
    const restoreManifestPath = path.join(restoreRoot, 'restore-manifest.json');
    const restoreSummaryPath = path.join(restoreRoot, 'restore-summary.json');
    const risksPath = path.join(restoreRoot, 'risks.json');

    failedStep = 'write-restore-reports';
    await writeJsonFile(restoreManifestPath, restoreManifest);
    await writeJsonFile(restoreSummaryPath, summary);
    await writeJsonFile(risksPath, risks);

    return {
      mode: 'rollback-rehearsal-temp-only',
      status: 'passed',
      rehearsalId,
      restoreRoot,
      restoreManifestPath,
      restoreSummaryPath,
      risksPath,
      failureReportPath: null,
      sourceBackupId,
      sourceBackupManifestPath,
      requiredRestoreCount: requiredRollbackEligibleFiles.length,
      restoredFileCount: restoredFiles.length,
      skippedFileCount: skippedFiles.length,
      excludedItemCount: excludedItems.length,
      overwroteServerData: false,
      wroteMysql: false,
    };
  } catch (error) {
    const failureReportPath = await writeFailureArtifacts({
      restoreRoot,
      rehearsalId,
      createdAt,
      sourceBackupId,
      sourceBackupManifestPath,
      sourceBackupManifestSha256,
      sourceBackupRoot,
      restoredFiles,
      skippedFiles,
      risks,
      failedStep,
      failedFile,
      error,
      partialFilesRestored,
    });

    throw new RollbackRehearsalError(
      `Rollback rehearsal failed at ${failedStep}: ${error instanceof Error ? error.message : String(error)}`
        + (failureReportPath ? ` Failure report: ${failureReportPath}` : ''),
      {
        failureReportPath,
        restoreRoot,
      },
    );
  }
}
