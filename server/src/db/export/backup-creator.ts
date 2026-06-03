import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { writeJsonFile } from './manifest-writer.js';
import type { BackupValidationStatus, ExportRisk } from './types.js';

type BackupFileSpecialHandling = 'none' | 'metadata_safety_anchor';

type BackupFileEntry = {
  relativePath: string;
  sourcePath: string;
  backupPath: string;
  exists: boolean;
  sha256: string | null;
  sizeBytes: number;
  recordCount: number;
  shapeSummary: Record<string, unknown>;
  rollbackEligible: boolean;
  specialHandling: BackupFileSpecialHandling;
  warnings: string[];
};

type BackupManifest = {
  schemaVersion: '22-7-5C-3-backup-manifest';
  backupId: string;
  createdAt: string;
  gitHead: string;
  branch: string;
  command: string;
  mode: 'create-backup';
  sourceRoot: string;
  backupRoot: string;
  files: BackupFileEntry[];
  excludedItems: string[];
  deferredItems: string[];
  risks: ExportRisk[];
  canRollback: false;
  rollbackManifestPlanned: true;
  validationStatus: BackupValidationStatus;
};

type BackupSummary = {
  backupId: string;
  createdAt: string;
  status: 'passed' | 'failed';
  backupRoot: string;
  requiredFileCount: number;
  copiedFileCount: number;
  rollbackEligibleCount: number;
  metadataAnchorCount: number;
  warningCount: number;
  blockerCount: number;
  canRollback: false;
  writeBlockedOnFailure: true;
};

type BackupFailureReport = {
  failedAt: string;
  backupId: string;
  failedStep: string;
  failedFile: string | null;
  errorMessage: string;
  partialFilesCopied: string[];
  cleanupStatus: 'not_attempted';
  writeBlocked: true;
  manualActionRequired: string;
  risks: ExportRisk[];
};

export type BackupCreationResult = {
  backupId: string;
  backupDir: string;
  manifestPath: string;
  summaryPath: string;
  risksPath: string;
  failureReportPath: string | null;
  validationStatus: BackupValidationStatus;
  backupCreated: boolean;
  risks: ExportRisk[];
};

export class BackupCreationError extends Error {
  failureReportPath: string | null;

  constructor(message: string, failureReportPath: string | null) {
    super(message);
    this.name = 'BackupCreationError';
    this.failureReportPath = failureReportPath;
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

const excludedItems = [
  'server/uploads/**',
  'server/data/publish-logs/**',
  'MySQL database rows',
  'MySQL tombstone rows',
  'migration_logs',
  'dist-prerender',
  'generated export outputs',
  'node_modules',
  'temporary logs',
  'server/data/media-library.corrupt-*',
  'server/data/media-library.broken-backup.json',
] as const;

const deferredItems = [
  'uploads backup and restore strategy',
  'publish logs archive strategy',
  'MySQL rollback',
  'tombstone row restore',
  'media-library physical file rollback',
] as const;

function hashContent(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

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

function baseBackupRisks(): ExportRisk[] {
  return [
    {
      code: 'uploads_not_backed_up',
      level: 'warning',
      message: 'server/uploads is excluded from first-phase JSON backup.',
    },
    {
      code: 'full_rollback_requires_uploads_strategy',
      level: 'warning',
      message: 'Complete rollback still requires a separate uploads backup and restore strategy.',
    },
    {
      code: 'publish_logs_excluded_from_content_backup',
      level: 'warning',
      message: 'server/data/publish-logs is excluded from content backup and rollback.',
    },
    {
      code: 'mysql_not_backed_up',
      level: 'warning',
      message: 'MySQL rows are not backed up by this JSON backup.',
    },
    {
      code: 'tombstone_rows_not_backed_up',
      level: 'warning',
      message: 'MySQL tombstone rows are not backed up by this JSON backup.',
    },
    {
      code: 'media_library_metadata_only',
      level: 'warning',
      message: 'media-library.json is backed up only as metadata_safety_anchor and is not first-phase rollback eligible.',
    },
  ];
}

async function readJsonFileForBackup(input: {
  projectRoot: string;
  relativePath: string;
}): Promise<{
  absolutePath: string;
  raw: string;
  data: unknown;
  sha256: string;
  sizeBytes: number;
}> {
  const absolutePath = path.resolve(input.projectRoot, input.relativePath);
  const raw = await fs.readFile(absolutePath, 'utf8');
  const data = JSON.parse(raw) as unknown;
  const stats = await fs.stat(absolutePath);
  return {
    absolutePath,
    raw,
    data,
    sha256: hashContent(raw),
    sizeBytes: stats.size,
  };
}

async function copyBackupFile(input: {
  projectRoot: string;
  backupDir: string;
  relativePath: string;
  rollbackEligible: boolean;
  specialHandling: BackupFileSpecialHandling;
  warnings: string[];
}): Promise<BackupFileEntry> {
  const source = await readJsonFileForBackup({
    projectRoot: input.projectRoot,
    relativePath: input.relativePath,
  });
  const backupPath = path.join(input.backupDir, 'files', path.basename(input.relativePath));
  await fs.mkdir(path.dirname(backupPath), { recursive: true });
  await fs.copyFile(source.absolutePath, backupPath);

  const backupRaw = await fs.readFile(backupPath, 'utf8');
  const backupHash = hashContent(backupRaw);
  if (backupHash !== source.sha256) {
    throw new Error(`Backup hash mismatch for ${input.relativePath}.`);
  }

  JSON.parse(backupRaw);

  return {
    relativePath: input.relativePath,
    sourcePath: source.absolutePath,
    backupPath,
    exists: true,
    sha256: source.sha256,
    sizeBytes: source.sizeBytes,
    recordCount: countJsonRecords(source.data),
    shapeSummary: summarizeShape(source.data),
    rollbackEligible: input.rollbackEligible,
    specialHandling: input.specialHandling,
    warnings: input.warnings,
  };
}

function validateManifestShape(manifest: BackupManifest): string[] {
  const requiredKeys: Array<keyof BackupManifest> = [
    'schemaVersion',
    'backupId',
    'createdAt',
    'gitHead',
    'branch',
    'command',
    'mode',
    'sourceRoot',
    'backupRoot',
    'files',
    'excludedItems',
    'deferredItems',
    'risks',
    'canRollback',
    'rollbackManifestPlanned',
    'validationStatus',
  ];

  return requiredKeys.filter((key) => manifest[key] === undefined).map((key) => String(key));
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function createFailureReport(input: {
  backupDir: string;
  backupId: string;
  failedStep: string;
  failedFile: string | null;
  error: unknown;
  partialFilesCopied: string[];
  risks: ExportRisk[];
}): Promise<string | null> {
  const failureReportPath = path.join(input.backupDir, 'failure-report.json');
  const report: BackupFailureReport = {
    failedAt: new Date().toISOString(),
    backupId: input.backupId,
    failedStep: input.failedStep,
    failedFile: input.failedFile,
    errorMessage: input.error instanceof Error ? input.error.message : String(input.error),
    partialFilesCopied: input.partialFilesCopied,
    cleanupStatus: 'not_attempted',
    writeBlocked: true,
    manualActionRequired: 'Review the failure report, keep --write disabled, and rerun backup only after the blocker is fixed.',
    risks: input.risks,
  };

  try {
    await writeJsonFile(failureReportPath, report);
    return failureReportPath;
  } catch {
    return null;
  }
}

export async function createMysqlJsonBackup(input: {
  projectRoot: string;
  generatedAt: Date;
  gitHead: string;
  branch: string;
  command: string;
}): Promise<BackupCreationResult> {
  const backupId = formatTimestamp(input.generatedAt);
  const backupRoot = path.join(input.projectRoot, 'server', 'data-backups', 'mysql-json-export');
  const backupDir = path.join(backupRoot, backupId);
  const risks = baseBackupRisks();
  const partialFilesCopied: string[] = [];
  let failedStep = 'initializing-backup';
  let failedFile: string | null = null;

  await fs.mkdir(backupRoot, { recursive: true });
  try {
    await fs.mkdir(backupDir, { recursive: false });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new BackupCreationError(`Backup directory already exists and will not be overwritten: ${backupDir}`, null);
    }
    throw error;
  }

  try {
    const gitStatusBefore = readGitStatus();
    const dataHashesBefore = new Map<string, string>();

    for (const relativePath of requiredRollbackEligibleFiles) {
      const source = await readJsonFileForBackup({
        projectRoot: input.projectRoot,
        relativePath,
      });
      dataHashesBefore.set(relativePath, source.sha256);
    }

    const files: BackupFileEntry[] = [];
    for (const relativePath of requiredRollbackEligibleFiles) {
      failedStep = 'copy-required-file';
      failedFile = relativePath;
      const file = await copyBackupFile({
        projectRoot: input.projectRoot,
        backupDir,
        relativePath,
        rollbackEligible: true,
        specialHandling: 'none',
        warnings: [],
      });
      partialFilesCopied.push(relativePath);
      files.push(file);
    }

    const mediaLibraryPath = 'server/data/media-library.json';
    if (await pathExists(path.resolve(input.projectRoot, mediaLibraryPath))) {
      try {
        failedStep = 'copy-media-library-metadata-anchor';
        failedFile = mediaLibraryPath;
        const mediaFile = await copyBackupFile({
          projectRoot: input.projectRoot,
          backupDir,
          relativePath: mediaLibraryPath,
          rollbackEligible: false,
          specialHandling: 'metadata_safety_anchor',
          warnings: [
            'metadata_safety_anchor only; not first-phase rollback eligible.',
          ],
        });
        partialFilesCopied.push(mediaLibraryPath);
        files.push(mediaFile);
      } catch (error) {
        risks.push({
          code: 'media_library_metadata_backup_failed',
          level: 'warning',
          message: error instanceof Error ? error.message : 'media-library metadata anchor backup failed.',
        });
      }
    } else {
      risks.push({
        code: 'media_library_not_backed_up',
        level: 'warning',
        message: 'server/data/media-library.json was not present and was not backed up.',
      });
    }

    failedStep = 'validate-required-files';
    for (const relativePath of requiredRollbackEligibleFiles) {
      const file = files.find((item) => item.relativePath === relativePath);
      if (!file?.exists || !file.sha256) {
        failedFile = relativePath;
        throw new Error(`Required backup file is missing from manifest: ${relativePath}`);
      }
    }

    failedStep = 'validate-server-data-unchanged';
    failedFile = null;
    for (const relativePath of requiredRollbackEligibleFiles) {
      const source = await readJsonFileForBackup({
        projectRoot: input.projectRoot,
        relativePath,
      });
      if (source.sha256 !== dataHashesBefore.get(relativePath)) {
        failedFile = relativePath;
        throw new Error(`server/data changed during backup: ${relativePath}`);
      }
    }

    failedStep = 'validate-backup-output';
    for (const file of files) {
      const raw = await fs.readFile(file.backupPath, 'utf8');
      JSON.parse(raw);
      if (hashContent(raw) !== file.sha256) {
        failedFile = file.relativePath;
        throw new Error(`Backup hash validation failed for ${file.relativePath}.`);
      }
    }

    failedStep = 'validate-exclusions';
    failedFile = null;
    const copiedRelativePaths = new Set(files.map((file) => file.relativePath));
    if ([...copiedRelativePaths].some((relativePath) => relativePath.startsWith('server/uploads/'))) {
      throw new Error('Backup copied uploads, which is forbidden.');
    }
    if ([...copiedRelativePaths].some((relativePath) => relativePath.startsWith('server/data/publish-logs/'))) {
      throw new Error('Backup copied publish logs, which is forbidden.');
    }

    const manifest: BackupManifest = {
      schemaVersion: '22-7-5C-3-backup-manifest',
      backupId,
      createdAt: input.generatedAt.toISOString(),
      gitHead: input.gitHead,
      branch: input.branch,
      command: input.command,
      mode: 'create-backup',
      sourceRoot: path.join(input.projectRoot, 'server', 'data'),
      backupRoot: backupDir,
      files,
      excludedItems: [...excludedItems],
      deferredItems: [...deferredItems],
      risks,
      canRollback: false,
      rollbackManifestPlanned: true,
      validationStatus: 'passed',
    };

    failedStep = 'validate-manifest';
    const missingManifestKeys = validateManifestShape(manifest);
    if (missingManifestKeys.length > 0) {
      throw new Error(`Backup manifest is missing required fields: ${missingManifestKeys.join(', ')}`);
    }

    failedStep = 'validate-git-status';
    if (readGitStatus() !== gitStatusBefore) {
      throw new Error('Backup output changed git status. Verify server/data-backups is ignored.');
    }

    const backupWarnings = risks.filter((risk) => risk.level === 'warning').length
      + files.reduce((sum, file) => sum + file.warnings.length, 0);
    const backupBlockers = 0;
    const summary: BackupSummary = {
      backupId,
      createdAt: manifest.createdAt,
      status: 'passed',
      backupRoot: backupDir,
      requiredFileCount: requiredRollbackEligibleFiles.length,
      copiedFileCount: files.length,
      rollbackEligibleCount: files.filter((file) => file.rollbackEligible).length,
      metadataAnchorCount: files.filter((file) => file.specialHandling === 'metadata_safety_anchor').length,
      warningCount: backupWarnings,
      blockerCount: backupBlockers,
      canRollback: false,
      writeBlockedOnFailure: true,
    };

    failedStep = 'write-backup-reports';
    const manifestPath = path.join(backupDir, 'backup-manifest.json');
    const summaryPath = path.join(backupDir, 'backup-summary.json');
    const risksPath = path.join(backupDir, 'risks.json');
    await writeJsonFile(manifestPath, manifest);
    await writeJsonFile(summaryPath, summary);
    await writeJsonFile(risksPath, risks);

    return {
      backupId,
      backupDir,
      manifestPath,
      summaryPath,
      risksPath,
      failureReportPath: null,
      validationStatus: 'passed',
      backupCreated: true,
      risks,
    };
  } catch (error) {
    const failureReportPath = await createFailureReport({
      backupDir,
      backupId,
      failedStep,
      failedFile,
      error,
      partialFilesCopied,
      risks,
    });
    throw new BackupCreationError(
      `Backup creation failed at ${failedStep}: ${error instanceof Error ? error.message : String(error)}`
        + (failureReportPath ? ` Failure report: ${failureReportPath}` : ''),
      failureReportPath,
    );
  }
}
