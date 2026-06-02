import type {
  ExportFieldDiff,
  ExportModuleDefinition,
  ExportStatus,
  ModuleDiffReport,
  MysqlExportReadResult,
  MysqlReadResult,
  SourceJsonSnapshot,
} from './types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function pathWithSegment(basePath: string, segment: string | number): string {
  if (typeof segment === 'number') {
    return `${basePath}[${segment}]`;
  }

  return basePath ? `${basePath}.${segment}` : segment;
}

function primitiveMatches(sourceValue: unknown, exportedValue: unknown): boolean {
  return sourceValue === exportedValue;
}

function collectFieldDiffs(sourceValue: unknown, exportedValue: unknown, basePath = ''): ExportFieldDiff[] {
  if (Array.isArray(sourceValue) || Array.isArray(exportedValue)) {
    if (!Array.isArray(sourceValue) || !Array.isArray(exportedValue)) {
      return [{
        fieldPath: basePath || '$',
        sourceValue,
        exportedValue,
        severity: 'error',
        reason: 'Source and exported values do not have the same JSON shape.',
      }];
    }

    const fieldDiffs: ExportFieldDiff[] = [];
    if (sourceValue.length !== exportedValue.length) {
      fieldDiffs.push({
        fieldPath: `${basePath || '$'}.length`,
        sourceValue: sourceValue.length,
        exportedValue: exportedValue.length,
        severity: 'warning',
        reason: 'Array length differs between source JSON and exported JSON.',
      });
    }

    for (let index = 0; index < Math.max(sourceValue.length, exportedValue.length); index += 1) {
      fieldDiffs.push(...collectFieldDiffs(sourceValue[index], exportedValue[index], pathWithSegment(basePath, index)));
    }

    return fieldDiffs;
  }

  if (isRecord(sourceValue) || isRecord(exportedValue)) {
    if (!isRecord(sourceValue) || !isRecord(exportedValue)) {
      return [{
        fieldPath: basePath || '$',
        sourceValue,
        exportedValue,
        severity: 'error',
        reason: 'Source and exported values do not have the same JSON shape.',
      }];
    }

    const fieldDiffs: ExportFieldDiff[] = [];
    const keys = Array.from(new Set([...Object.keys(sourceValue), ...Object.keys(exportedValue)])).sort();

    for (const key of keys) {
      const sourceHasKey = Object.prototype.hasOwnProperty.call(sourceValue, key);
      const exportedHasKey = Object.prototype.hasOwnProperty.call(exportedValue, key);
      const fieldPath = pathWithSegment(basePath, key);

      if (!sourceHasKey || !exportedHasKey) {
        fieldDiffs.push({
          fieldPath,
          sourceValue: sourceHasKey ? sourceValue[key] : undefined,
          exportedValue: exportedHasKey ? exportedValue[key] : undefined,
          severity: 'error',
          reason: sourceHasKey
            ? 'Field exists in source JSON but is missing from exported JSON.'
            : 'Field exists in exported JSON but is missing from source JSON.',
        });
        continue;
      }

      fieldDiffs.push(...collectFieldDiffs(sourceValue[key], exportedValue[key], fieldPath));
    }

    return fieldDiffs;
  }

  if (primitiveMatches(sourceValue, exportedValue)) {
    return [];
  }

  return [{
    fieldPath: basePath || '$',
    sourceValue,
    exportedValue,
    severity: 'warning',
    reason: 'Exported value differs from source JSON.',
  }];
}

function diffStatusFromFieldDiffs(input: {
  fieldDiffs: ExportFieldDiff[];
  warnings: string[];
  blockers: string[];
}): ModuleDiffReport['diffStatus'] {
  if (input.blockers.length > 0 || input.fieldDiffs.some((diff) => diff.severity === 'error')) {
    return 'error';
  }

  if (input.warnings.length > 0 || input.fieldDiffs.some((diff) => diff.severity === 'warning')) {
    return 'warning';
  }

  return 'matched';
}

function sourceRecordCountForModule(input: {
  definition: ExportModuleDefinition;
  source: SourceJsonSnapshot;
}): number {
  if (!input.source.readOk) {
    return input.source.recordCount;
  }

  if (input.definition.moduleName === 'contact-info' || input.definition.moduleName === 'home-video') {
    return input.source.data === null || input.source.data === undefined ? 0 : 1;
  }

  if (Array.isArray(input.source.data)) {
    return input.source.data.length;
  }

  return input.source.recordCount;
}

export function buildModuleDiffReport(input: {
  definition: ExportModuleDefinition;
  source: SourceJsonSnapshot;
  mysql: MysqlReadResult;
  mysqlExport: MysqlExportReadResult;
  exportStatus: ExportStatus;
}): ModuleDiffReport {
  const { definition, source, mysql, mysqlExport, exportStatus } = input;
  const exportImplemented = exportStatus === 'implemented' && mysqlExport.implemented;
  const sourceRecordCount = sourceRecordCountForModule({ definition, source });

  if (!source.readOk) {
    return {
      moduleName: definition.moduleName,
      comparable: false,
      matched: false,
      diffStatus: 'error',
      sourceJsonRead: false,
      mysqlConfigured: mysql.configured,
      mysqlAvailable: mysql.available,
      exportImplemented,
      shapeRisk: definition.riskLevel,
      status: exportStatus,
      sourceRecordCount,
      exportedRecordCount: mysqlExport.recordCount,
      fieldDiffs: [],
      warnings: mysqlExport.warnings,
      blockers: [source.error ?? 'Source JSON could not be read.', ...mysqlExport.blockers],
      reason: source.error ?? 'Source JSON could not be read.',
    };
  }

  if (mysqlExport.status === 'mysql_unavailable') {
    return {
      moduleName: definition.moduleName,
      comparable: false,
      matched: false,
      diffStatus: 'mysql_unavailable',
      sourceJsonRead: true,
      mysqlConfigured: mysql.configured,
      mysqlAvailable: false,
      exportImplemented,
      shapeRisk: definition.riskLevel,
      status: exportStatus,
      sourceRecordCount,
      exportedRecordCount: mysqlExport.recordCount,
      fieldDiffs: [],
      warnings: mysqlExport.warnings,
      blockers: mysqlExport.blockers,
      reason: mysql.configured
        ? (mysqlExport.blockers[0] ?? mysql.error ?? 'MySQL export read did not complete.')
        : `MySQL is not configured. Missing: ${mysql.missing.join(', ')}`,
    };
  }

  if (!exportImplemented) {
    return {
      moduleName: definition.moduleName,
      comparable: false,
      matched: false,
      diffStatus: exportStatus === 'skipped_empty_source' ? 'skipped_empty_source' : 'not_implemented',
      sourceJsonRead: true,
      mysqlConfigured: true,
      mysqlAvailable: mysql.available,
      exportImplemented,
      shapeRisk: definition.riskLevel,
      status: exportStatus,
      sourceRecordCount,
      exportedRecordCount: mysqlExport.recordCount,
      fieldDiffs: [],
      warnings: mysqlExport.warnings,
      blockers: mysqlExport.blockers,
      reason: exportStatus === 'skipped_empty_source'
        ? 'Current source is empty or intentionally skipped in the 22-6-3 dry-run export.'
        : 'MySQL-to-JSON export is not implemented for this module in 22-6-3.',
    };
  }

  const fieldDiffs = mysqlExport.status === 'exported' || mysqlExport.status === 'shape_risk'
    ? collectFieldDiffs(source.data, mysqlExport.data)
    : [];
  const diffStatus = mysqlExport.status === 'shape_risk'
    ? 'error'
    : diffStatusFromFieldDiffs({
        fieldDiffs,
        warnings: mysqlExport.warnings,
        blockers: mysqlExport.blockers,
      });
  const matched = diffStatus === 'matched';

  return {
    moduleName: definition.moduleName,
    comparable: mysqlExport.status === 'exported',
    matched,
    diffStatus,
    sourceJsonRead: true,
    mysqlConfigured: mysql.configured,
    mysqlAvailable: mysql.available,
    exportImplemented,
    shapeRisk: definition.riskLevel,
    status: exportStatus,
    sourceRecordCount,
    exportedRecordCount: mysqlExport.recordCount,
    fieldDiffs,
    warnings: mysqlExport.warnings,
    blockers: mysqlExport.blockers,
    reason: matched
      ? 'Exported JSON matches source JSON.'
      : 'Exported JSON differs from source JSON; see fieldDiffs, warnings, and blockers.',
  };
}
