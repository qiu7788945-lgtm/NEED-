import { execFileSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { buildModuleDiffReport } from './diff-reporter.js';
import {
  buildModuleResult,
  buildSkeletonExportPayload,
  buildSummary,
  writeModuleArtifacts,
  writeRootReports,
} from './export-writer.js';
import { readMysqlExportedData } from './mysql-exporters.js';
import { readMysqlModuleCounts } from './mysql-readers.js';
import { exportModuleRegistry } from './registry.js';
import { readSourceJson } from './source-json-reader.js';
import type {
  ExportCliOptions,
  ExportManifest,
  ExportModuleDefinition,
  ExportRunResult,
  ExportStatus,
} from './types.js';

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

function isInsidePath(candidate: string, parent: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function defaultOutputDir(projectRoot: string): string {
  return path.join(projectRoot, 'server', 'data-exports', 'mysql-json-export', formatTimestamp(new Date()));
}

function defaultBackupRoot(projectRoot: string): string {
  return path.join(projectRoot, 'server', 'data-backups', 'mysql-json-export');
}

async function prepareOutputDir(projectRoot: string, outputDir?: string): Promise<string> {
  let resolvedOutputDir = path.resolve(projectRoot, outputDir ?? defaultOutputDir(projectRoot));
  const serverDataDir = path.resolve(projectRoot, 'server', 'data');
  const serverUploadsDir = path.resolve(projectRoot, 'server', 'uploads');

  if (isInsidePath(resolvedOutputDir, serverDataDir)) {
    throw new Error('--output-dir must not point inside server/data.');
  }

  if (isInsidePath(resolvedOutputDir, serverUploadsDir)) {
    throw new Error('--output-dir must not point inside server/uploads.');
  }

  if (!outputDir) {
    const baseOutputDir = resolvedOutputDir;
    for (let index = 1; index <= 99; index += 1) {
      try {
        await fs.access(resolvedOutputDir);
        resolvedOutputDir = `${baseOutputDir}-${String(index).padStart(2, '0')}`;
      } catch {
        break;
      }
    }
  }

  await fs.mkdir(resolvedOutputDir, { recursive: true });
  return resolvedOutputDir;
}

function selectDefinitions(options: ExportCliOptions): ExportModuleDefinition[] {
  return options.moduleName === 'all'
    ? exportModuleRegistry
    : exportModuleRegistry.filter((definition) => definition.moduleName === options.moduleName);
}

function moduleExportStatus(definition: ExportModuleDefinition, sourceRecordCount: number): ExportStatus {
  if (sourceRecordCount === 0 && definition.exportStatus !== 'deferred') {
    return 'skipped_empty_source';
  }

  return definition.exportStatus;
}

function buildRollbackScope(): ExportManifest['rollbackScope'] {
  return {
    included: [
      'server/data/*.json main business content JSON files',
    ],
    excluded: [
      'MySQL rows and tombstones',
      'server/uploads physical files',
      'server/data/publish-logs/*.json',
      'media-library physical files',
      'migration_logs',
      'tombstone/deleted_at row restore',
    ],
  };
}

function buildRollbackDeferredItems(): string[] {
  return [
    'media-library / media_files export and upload rollback',
    'scenario-detail-pages export',
    'solution_pages / solution_page_blocks export',
    'publish-logs rollback',
    'migration_logs restore',
    'MySQL primary-write rollback',
    'tombstone row restore',
  ];
}

function buildBackupPlan(input: {
  projectRoot: string;
  generatedAt: Date;
  requested: boolean;
  moduleResults: ExportManifest['moduleResults'];
}): ExportManifest['backupPlan'] {
  const timestamp = formatTimestamp(input.generatedAt);
  const backupRoot = defaultBackupRoot(input.projectRoot);

  return {
    schemaVersion: '22-6-8-backup-plan',
    status: 'planned_only',
    requested: input.requested,
    backupCreated: false,
    writesBackupDirectory: false,
    writesServerData: false,
    writesMysql: false,
    defaultBackupRoot: backupRoot,
    plannedBackupDir: path.join(backupRoot, timestamp),
    directoryNamingRule: 'server/data-backups/mysql-json-export/<YYYYMMDD-HHmmss>/',
    moduleNames: input.moduleResults.map((result) => result.moduleName),
    files: input.moduleResults.map((result) => ({
      moduleName: result.moduleName,
      jsonPath: result.jsonPath,
      absolutePath: result.sourceJson.absolutePath,
      exists: result.sourceJson.exists,
      sourceHash: result.sourceJson.sourceHash,
      recordCount: result.sourceJson.recordCount,
    })),
    notes: [
      'This is a dry-run backup plan only; no server/data-backups directory is created in 22-6-8.',
      'Future write mode must create this backup before any server/data JSON overwrite.',
      'The backup scope is server/data JSON only; MySQL, uploads, publish logs, and tombstones are excluded.',
    ],
  };
}

function buildRollbackPlan(input: {
  requestedManifestPath?: string;
  rollbackScope: ExportManifest['rollbackScope'];
  deferredItems: string[];
}): ExportManifest['rollbackPlan'] {
  return {
    schemaVersion: '22-6-8-rollback-plan',
    status: 'not_implemented',
    requested: Boolean(input.requestedManifestPath),
    rollbackAvailable: false,
    rollbackModeEnabled: false,
    rollbackManifestPath: input.requestedManifestPath ?? null,
    restorePlan: {
      status: 'not_implemented',
      source: 'future_backup_manifest',
      requiredManifest: 'server/data-backups/mysql-json-export/<YYYYMMDD-HHmmss>/rollback-manifest.json',
      willRestoreServerDataJson: false,
      willWriteMysql: false,
      willRestoreUploads: false,
      willRestorePublishLogs: false,
    },
    rollbackScope: input.rollbackScope,
    deferredItems: input.deferredItems,
    notes: [
      'Rollback is a skeleton only in 22-6-8 and cannot restore files.',
      'Future rollback may restore server/data/*.json from a verified backup manifest.',
      'Rollback does not restore MySQL, uploads, publish logs, migration_logs, or tombstone rows.',
    ],
  };
}

function buildRisks(): ExportRunResult['risks'] {
  return [
    {
      code: 'media_library_deferred',
      level: 'warning',
      message: 'media-library/media_files export is deferred because media_files is shared and upload/delete rollback is not defined.',
    },
    {
      code: 'publish_logs_not_blocking',
      level: 'info',
      message: 'publish-logs remain JSON-primary; MySQL publish_logs is a shadow index and does not block content export dry runs.',
    },
    {
      code: 'scenario_detail_pages_deferred',
      level: 'info',
      message: 'scenario-detail-pages are deferred in 22-6-8; current JSON source is empty and outside the main export registry.',
    },
    {
      code: 'solution_pages_deferred',
      level: 'info',
      message: 'solution_pages and solution_page_blocks are deferred and are not part of the main business module export skeleton.',
    },
    {
      code: 'write_mode_disabled',
      level: 'blocker',
      message: '--write is disabled in 22-6-8 and must not overwrite server/data.',
    },
    {
      code: 'rollback_not_implemented',
      level: 'blocker',
      message: 'Rollback is not implemented in 22-6-8; rollbackAvailable=false and rollbackModeEnabled=false.',
    },
    {
      code: 'backup_not_created',
      level: 'blocker',
      message: 'No real backup is created in 22-6-8; backupCreated=false and backup plans are report-only.',
    },
    {
      code: 'backup_required_before_future_write',
      level: 'blocker',
      message: 'Future write mode must create a server/data JSON backup and rollback manifest before overwriting any JSON.',
    },
    {
      code: 'server_data_not_modified',
      level: 'info',
      message: 'The export skeleton writes only to the export output directory, never to server/data.',
    },
    {
      code: 'mysql_not_modified',
      level: 'info',
      message: 'The export skeleton performs read-only MySQL count checks and never writes MySQL.',
    },
    {
      code: 'real_api_tests_not_run',
      level: 'info',
      message: 'No real API write tests are part of the 22-6-8 backup/rollback skeleton.',
    },
    {
      code: 'uploads_not_handled',
      level: 'warning',
      message: 'Uploads backup/restore is not handled by this content JSON export skeleton.',
    },
    {
      code: 'uploads_not_backed_up',
      level: 'blocker',
      message: 'server/uploads is not backed up in 22-6-8 and must not be restored by content rollback.',
    },
    {
      code: 'mysql_rollback_not_supported',
      level: 'blocker',
      message: 'MySQL rollback is not supported; rollback plans exclude MySQL rows and tombstones.',
    },
    {
      code: 'tombstone_restore_not_supported',
      level: 'blocker',
      message: 'Restoring tombstone/deleted_at rows is outside the 22-6 backup/rollback skeleton.',
    },
    {
      code: 'publish_logs_not_content_rollback',
      level: 'warning',
      message: 'publish-logs are not part of content rollback and must not replace future Round 23 operation logs.',
    },
    {
      code: 'json_primary_write_source',
      level: 'info',
      message: 'JSON remains the primary write source; this step does not enable MySQL primary writes.',
    },
    {
      code: 'mysql_primary_write_disabled',
      level: 'blocker',
      message: 'MySQL primary-write mode is not enabled in 22-6-8.',
    },
  ];
}

export async function runExportDryRun(options: ExportCliOptions): Promise<ExportRunResult> {
  if (options.rollbackManifestPath) {
    throw new Error('--rollback is not supported in 22-6-8. This skeleton never restores server/data, MySQL, or uploads.');
  }

  if (options.writeRequested) {
    throw new Error('--write is not supported in 22-6-8. This dry-run export never overwrites server/data or creates real backups.');
  }

  const projectRoot = process.cwd();
  const generatedAt = new Date();
  const outputDir = await prepareOutputDir(projectRoot, options.outputDir);
  const selectedDefinitions = selectDefinitions(options);
  const moduleResults: ExportManifest['moduleResults'] = [];

  for (const definition of selectedDefinitions) {
    const source = await readSourceJson(projectRoot, definition);
    const mysql = await readMysqlModuleCounts(definition);
    const exportStatus = moduleExportStatus(definition, source.recordCount);
    const mysqlExport = await readMysqlExportedData({
      definition,
      exportStatus,
    });
    const diff = buildModuleDiffReport({
      definition,
      source,
      mysql,
      mysqlExport,
      exportStatus,
    });
    const moduleOutputDir = await writeModuleArtifacts({
      outputRoot: outputDir,
      definition,
      source,
      exportedPayload: exportStatus === 'implemented'
        ? mysqlExport.data
        : buildSkeletonExportPayload({ definition, exportStatus }),
      diff,
    });

    moduleResults.push(buildModuleResult({
      definition,
      source,
      mysql,
      mysqlExport,
      diff,
      exportStatus,
      moduleOutputDir,
    }));
  }

  const rollbackScope = buildRollbackScope();
  const rollbackDeferredItems = buildRollbackDeferredItems();
  const backupPlan = buildBackupPlan({
    projectRoot,
    generatedAt,
    requested: options.planBackupRequested,
    moduleResults,
  });
  const rollbackPlan = buildRollbackPlan({
    requestedManifestPath: options.rollbackManifestPath,
    rollbackScope,
    deferredItems: rollbackDeferredItems,
  });
  const manifest: ExportManifest = {
    exportVersion: '22-6-8',
    generatedAt: generatedAt.toISOString(),
    gitHead: readGitValue(['rev-parse', 'HEAD'], 'unknown'),
    branch: readGitValue(['rev-parse', '--abbrev-ref', 'HEAD'], 'unknown'),
    mode: 'dry-run',
    outputDir,
    selectedModules: options.moduleName,
    moduleResults,
    wroteServerData: false,
    wroteMysql: false,
    canRollback: false,
    writeModeEnabled: false,
    backupCreated: false,
    rollbackAvailable: false,
    rollbackModeEnabled: false,
    backupRequiredBeforeWrite: true,
    backupPlan,
    rollbackPlan,
    rollbackScope,
    rollbackDeferredItems,
    warnings: [
      '22-6-8 is still dry-run only; implemented module exports are report artifacts, not official server/data writes.',
      'Diff reports compare current source JSON with MySQL-exported JSON and must not overwrite source files.',
      'Backup and rollback are skeleton plans only; no real backup or restore is executed.',
    ],
    blockers: [
      '--write is disabled.',
      'Rollback is not implemented.',
      'A real backup must be created before any future write mode can be enabled.',
    ],
  };
  const summary = buildSummary(manifest);
  const result: ExportRunResult = {
    manifest,
    summary,
    diffReport: {
      generatedAt: manifest.generatedAt,
      moduleResults: moduleResults.map((moduleResult) => moduleResult.diff),
    },
    risks: buildRisks(),
  };

  await writeRootReports(result);
  return result;
}
