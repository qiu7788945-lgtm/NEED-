import path from 'node:path';
import type {
  ExportManifest,
  ExportModuleDefinition,
  ExportModuleResult,
  ExportRunResult,
  ExportSummary,
  MysqlExportReadResult,
  ModuleDiffReport,
  SourceJsonSnapshot,
} from './types.js';
import { writeJsonFile } from './manifest-writer.js';

function stripSourceData(source: SourceJsonSnapshot): Omit<SourceJsonSnapshot, 'data'> {
  const { data: _data, ...rest } = source;
  return rest;
}

export function buildSkeletonExportPayload(input: {
  definition: ExportModuleDefinition;
  exportStatus: ExportModuleResult['exportStatus'];
}) {
  return {
    moduleName: input.definition.moduleName,
    exportStatus: input.exportStatus,
    implemented: false,
    exportedData: null,
    note: input.exportStatus === 'skipped_empty_source'
      ? 'This module is treated as empty-source/skipped in the 22-6-5 dry-run export.'
      : 'MySQL-to-JSON export is not implemented for this module in the 22-6-5 dry-run export.',
  };
}

function stripMysqlExportData(mysqlExport: MysqlExportReadResult): Omit<MysqlExportReadResult, 'data'> {
  const { data: _data, ...rest } = mysqlExport;
  return rest;
}

export async function writeModuleArtifacts(input: {
  outputRoot: string;
  definition: ExportModuleDefinition;
  source: SourceJsonSnapshot;
  exportedPayload: unknown;
  diff: ModuleDiffReport;
}): Promise<string> {
  const moduleOutputDir = path.join(input.outputRoot, 'modules', input.definition.moduleName);
  await writeJsonFile(path.join(moduleOutputDir, 'source.json'), input.source.readOk ? input.source.data : null);
  await writeJsonFile(path.join(moduleOutputDir, 'exported.json'), input.exportedPayload);
  await writeJsonFile(path.join(moduleOutputDir, 'diff.json'), input.diff);
  return moduleOutputDir;
}

export function buildModuleResult(input: {
  definition: ExportModuleDefinition;
  source: SourceJsonSnapshot;
  mysql: ExportModuleResult['mysql'];
  mysqlExport: MysqlExportReadResult;
  diff: ModuleDiffReport;
  exportStatus: ExportModuleResult['exportStatus'];
  moduleOutputDir: string;
}): ExportModuleResult {
  const warnings = Array.from(new Set([
    ...input.definition.notes,
    ...(input.source.readOk ? [] : [input.source.error ?? 'Source JSON read failed.']),
    ...(input.mysql.available ? [] : [input.mysql.error ?? 'MySQL is unavailable for this dry run.']),
    ...input.mysqlExport.warnings,
    ...input.diff.warnings,
  ]));

  return {
    moduleName: input.definition.moduleName,
    jsonPath: input.definition.jsonPath,
    mysqlTables: input.definition.mysqlTables,
    exportStatus: input.exportStatus,
    riskLevel: input.definition.riskLevel,
    outputDir: input.moduleOutputDir,
    sourceJson: stripSourceData(input.source),
    mysql: input.mysql,
    mysqlExport: stripMysqlExportData(input.mysqlExport),
    diff: input.diff,
    warnings,
    blockers: Array.from(new Set([
      ...input.mysqlExport.blockers,
      ...input.diff.blockers,
    ])),
  };
}

export async function writeRootReports(input: ExportRunResult): Promise<void> {
  await writeJsonFile(path.join(input.manifest.outputDir, 'export-manifest.json'), input.manifest);
  await writeJsonFile(path.join(input.manifest.outputDir, 'export-summary.json'), input.summary);
  await writeJsonFile(path.join(input.manifest.outputDir, 'diff-report.json'), input.diffReport);
  await writeJsonFile(path.join(input.manifest.outputDir, 'risks.json'), input.risks);
}

export function buildSummary(manifest: ExportManifest): ExportSummary {
  return {
    mode: 'dry-run',
    outputDir: manifest.outputDir,
    selectedModules: manifest.selectedModules,
    moduleCount: manifest.moduleResults.length,
    implementedCount: manifest.moduleResults.filter((result) => result.exportStatus === 'implemented').length,
    skeletonOnlyCount: manifest.moduleResults.filter((result) => result.exportStatus === 'skeleton_only').length,
    skippedEmptySourceCount: manifest.moduleResults.filter((result) => result.exportStatus === 'skipped_empty_source').length,
    matchedCount: manifest.moduleResults.filter((result) => result.diff.diffStatus === 'matched').length,
    warningCount: manifest.moduleResults.filter((result) => result.diff.diffStatus === 'warning').length,
    errorCount: manifest.moduleResults.filter((result) => result.diff.diffStatus === 'error').length,
    mysqlUnavailableCount: manifest.moduleResults.filter((result) => (
      result.diff.diffStatus === 'mysql_unavailable'
    )).length,
    mysqlConfigured: manifest.moduleResults.some((result) => result.mysql.configured),
    mysqlAvailable: manifest.moduleResults.every((result) => result.mysql.available),
    wroteServerData: false,
    wroteMysql: false,
    canRollback: false,
  };
}
