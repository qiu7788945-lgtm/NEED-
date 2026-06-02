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
      message: 'scenario-detail-pages are deferred in 22-6-2; current JSON source is empty and outside the main export registry.',
    },
    {
      code: 'solution_pages_deferred',
      level: 'info',
      message: 'solution_pages and solution_page_blocks are deferred and are not part of the main business module export skeleton.',
    },
    {
      code: 'write_mode_disabled',
      level: 'blocker',
      message: '--write is disabled in 22-6-2 and must not overwrite server/data.',
    },
    {
      code: 'rollback_not_implemented',
      level: 'blocker',
      message: 'Rollback is not implemented; canRollback=false until backup and rollback manifest steps exist.',
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
      message: 'No real API write tests are part of the 22-6-2 skeleton.',
    },
    {
      code: 'uploads_not_handled',
      level: 'warning',
      message: 'Uploads backup/restore is not handled by this content JSON export skeleton.',
    },
  ];
}

export async function runExportDryRun(options: ExportCliOptions): Promise<ExportRunResult> {
  if (options.writeRequested) {
    throw new Error('--write is not supported in 22-6-2. This dry-run skeleton never overwrites server/data.');
  }

  const projectRoot = process.cwd();
  const outputDir = await prepareOutputDir(projectRoot, options.outputDir);
  const selectedDefinitions = selectDefinitions(options);
  const moduleResults: ExportManifest['moduleResults'] = [];

  for (const definition of selectedDefinitions) {
    const source = await readSourceJson(projectRoot, definition);
    const mysql = await readMysqlModuleCounts(definition);
    const exportStatus = moduleExportStatus(definition, source.recordCount);
    const diff = buildModuleDiffReport({
      definition,
      source,
      mysql,
      exportStatus,
    });
    const moduleOutputDir = await writeModuleArtifacts({
      outputRoot: outputDir,
      definition,
      source,
      exportedPayload: buildSkeletonExportPayload({ definition, exportStatus }),
      diff,
    });

    moduleResults.push(buildModuleResult({
      definition,
      source,
      mysql,
      diff,
      exportStatus,
      moduleOutputDir,
    }));
  }

  const manifest: ExportManifest = {
    exportVersion: '22-6-2',
    generatedAt: new Date().toISOString(),
    gitHead: readGitValue(['rev-parse', 'HEAD'], 'unknown'),
    branch: readGitValue(['rev-parse', '--abbrev-ref', 'HEAD'], 'unknown'),
    mode: 'dry-run',
    outputDir,
    selectedModules: options.moduleName,
    moduleResults,
    wroteServerData: false,
    wroteMysql: false,
    canRollback: false,
    warnings: [
      '22-6-2 is a dry-run skeleton only; module exports are not implemented yet.',
      'Diff reports are structural readiness reports and must not be treated as matched content.',
    ],
    blockers: [
      '--write is disabled.',
      'Rollback is not implemented.',
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
