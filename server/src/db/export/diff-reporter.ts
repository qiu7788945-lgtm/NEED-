import type {
  ExportModuleDefinition,
  ExportStatus,
  ModuleDiffReport,
  MysqlReadResult,
  SourceJsonSnapshot,
} from './types.js';

export function buildModuleDiffReport(input: {
  definition: ExportModuleDefinition;
  source: SourceJsonSnapshot;
  mysql: MysqlReadResult;
  exportStatus: ExportStatus;
}): ModuleDiffReport {
  const { definition, source, mysql, exportStatus } = input;
  const exportImplemented = exportStatus === 'implemented';

  if (!source.readOk) {
    return {
      moduleName: definition.moduleName,
      comparable: false,
      sourceJsonRead: false,
      mysqlConfigured: mysql.configured,
      mysqlAvailable: mysql.available,
      exportImplemented,
      shapeRisk: definition.riskLevel,
      status: exportStatus,
      reason: source.error ?? 'Source JSON could not be read.',
    };
  }

  if (!mysql.available) {
    return {
      moduleName: definition.moduleName,
      comparable: false,
      sourceJsonRead: true,
      mysqlConfigured: mysql.configured,
      mysqlAvailable: false,
      exportImplemented,
      shapeRisk: definition.riskLevel,
      status: exportStatus,
      reason: mysql.configured
        ? (mysql.error ?? 'MySQL count checks did not complete.')
        : `MySQL is not configured. Missing: ${mysql.missing.join(', ')}`,
    };
  }

  if (!exportImplemented) {
    return {
      moduleName: definition.moduleName,
      comparable: false,
      sourceJsonRead: true,
      mysqlConfigured: true,
      mysqlAvailable: true,
      exportImplemented,
      shapeRisk: definition.riskLevel,
      status: exportStatus,
      reason: exportStatus === 'skipped_empty_source'
        ? 'Current source is empty or intentionally skipped in the 22-6-2 skeleton.'
        : 'MySQL-to-JSON export is not implemented for this module in 22-6-2.',
    };
  }

  return {
    moduleName: definition.moduleName,
    comparable: true,
    sourceJsonRead: true,
    mysqlConfigured: true,
    mysqlAvailable: true,
    exportImplemented,
    shapeRisk: definition.riskLevel,
    status: exportStatus,
    reason: 'Export implementation is available for comparison.',
  };
}
