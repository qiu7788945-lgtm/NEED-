export const exportModuleNames = [
  'contact-info',
  'company-assets',
  'home-video',
  'home-interactive-images',
  'articles',
  'cases',
  'solutions',
  'pages',
] as const;

export type ExportModuleName = (typeof exportModuleNames)[number];
export type ExportModuleFilter = ExportModuleName | 'all';
export type ExportStatus = 'implemented' | 'skeleton_only' | 'skipped_empty_source' | 'deferred';
export type RiskLevel = 'low' | 'medium' | 'high';
export type MysqlStatus = 'configured' | 'mysql_unavailable';
export type ExportReadStatus = 'exported' | 'mysql_unavailable' | 'shape_risk' | 'not_implemented';
export type ExportDiffStatus =
  | 'matched'
  | 'warning'
  | 'error'
  | 'mysql_unavailable'
  | 'not_implemented'
  | 'skipped_empty_source';
export type ExportFieldDiffSeverity = 'info' | 'warning' | 'error';
export type ExportMetrics = Record<string, string | number | boolean | null>;
export type BackupValidationStatus = 'not_requested' | 'passed' | 'failed';

export type ExportModuleDefinition = {
  moduleName: ExportModuleName;
  jsonPath: string;
  mysqlTables: string[];
  exportStatus: ExportStatus;
  riskLevel: RiskLevel;
  notes: string[];
};

export type ExportCliOptions = {
  moduleName: ExportModuleFilter;
  outputDir?: string;
  format: 'json';
  dryRun: true;
  writeRequested: boolean;
  planBackupRequested: boolean;
  createBackupRequested: boolean;
  rollbackManifestPath?: string;
  rehearseRollbackManifestPath?: string;
  restoreDir?: string;
};

export type SourceJsonSnapshot = {
  moduleName: ExportModuleName;
  jsonPath: string;
  absolutePath: string;
  exists: boolean;
  readOk: boolean;
  sourceHash: string | null;
  recordCount: number;
  data: unknown;
  error?: string;
};

export type MysqlTableCount = {
  tableName: string;
  count: number | null;
  readOk: boolean;
  error?: string;
};

export type MysqlReadResult = {
  configured: boolean;
  available: boolean;
  missing: string[];
  status: MysqlStatus;
  error?: string;
  tableCounts: MysqlTableCount[];
};

export type MysqlExportReadResult = {
  moduleName: ExportModuleName;
  implemented: boolean;
  status: ExportReadStatus;
  data: unknown;
  recordCount: number;
  warnings: string[];
  blockers: string[];
  metrics?: ExportMetrics;
};

export type ExportFieldDiff = {
  fieldPath: string;
  sourceValue: unknown;
  exportedValue: unknown;
  severity: ExportFieldDiffSeverity;
  reason: string;
};

export type ModuleDiffReport = {
  moduleName: ExportModuleName;
  comparable: boolean;
  matched: boolean;
  diffStatus: ExportDiffStatus;
  sourceJsonRead: boolean;
  mysqlConfigured: boolean;
  mysqlAvailable: boolean;
  exportImplemented: boolean;
  shapeRisk: RiskLevel;
  status: ExportStatus;
  sourceRecordCount: number;
  exportedRecordCount: number;
  fieldDiffs: ExportFieldDiff[];
  warnings: string[];
  blockers: string[];
  metrics?: ExportMetrics;
  reason: string;
};

export type ExportModuleResult = {
  moduleName: ExportModuleName;
  jsonPath: string;
  mysqlTables: string[];
  exportStatus: ExportStatus;
  riskLevel: RiskLevel;
  outputDir: string;
  sourceJson: Omit<SourceJsonSnapshot, 'data'>;
  mysql: MysqlReadResult;
  mysqlExport: Omit<MysqlExportReadResult, 'data'>;
  diff: ModuleDiffReport;
  warnings: string[];
  blockers: string[];
};

export type ExportRisk = {
  code: string;
  level: 'info' | 'warning' | 'blocker';
  message: string;
};

export type BackupPlanFile = {
  moduleName: ExportModuleName;
  jsonPath: string;
  absolutePath: string;
  exists: boolean;
  sourceHash: string | null;
  recordCount: number;
  shapeSummary?: unknown;
};

export type BackupManifestPlan = {
  schemaVersion: '22-6-8-backup-plan';
  status: 'planned_only' | 'created' | 'failed';
  requested: boolean;
  createRequested: boolean;
  backupCreated: boolean;
  writesBackupDirectory: boolean;
  writesServerData: false;
  writesMysql: false;
  defaultBackupRoot: string;
  plannedBackupDir: string;
  actualBackupDir: string | null;
  backupManifestPath: string | null;
  backupSummaryPath: string | null;
  backupRisksPath: string | null;
  failureReportPath: string | null;
  validationStatus: BackupValidationStatus;
  directoryNamingRule: string;
  moduleNames: ExportModuleName[];
  files: BackupPlanFile[];
  notes: string[];
};

export type RollbackScope = {
  included: string[];
  excluded: string[];
};

export type RestorePlan = {
  status: 'not_implemented';
  source: 'future_backup_manifest';
  requiredManifest: string;
  willRestoreServerDataJson: false;
  willWriteMysql: false;
  willRestoreUploads: false;
  willRestorePublishLogs: false;
};

export type RollbackManifestPlan = {
  schemaVersion: '22-6-8-rollback-plan';
  status: 'not_implemented';
  requested: boolean;
  rollbackAvailable: false;
  rollbackModeEnabled: false;
  rollbackManifestPath: string | null;
  restorePlan: RestorePlan;
  rollbackScope: RollbackScope;
  deferredItems: string[];
  notes: string[];
};

export type ExportManifest = {
  exportVersion: '22-6-8';
  generatedAt: string;
  gitHead: string;
  branch: string;
  mode: 'dry-run';
  outputDir: string;
  selectedModules: ExportModuleFilter;
  moduleResults: ExportModuleResult[];
  wroteServerData: false;
  wroteMysql: false;
  canRollback: false;
  writeModeEnabled: false;
  backupCreated: boolean;
  backupRoot: string | null;
  backupManifestPath: string | null;
  backupValidationStatus: BackupValidationStatus;
  rollbackAvailable: false;
  rollbackModeEnabled: false;
  backupRequiredBeforeWrite: true;
  backupPlan: BackupManifestPlan;
  rollbackPlan: RollbackManifestPlan;
  rollbackScope: RollbackScope;
  rollbackDeferredItems: string[];
  warnings: string[];
  blockers: string[];
};

export type ExportModuleSummary = {
  moduleName: ExportModuleName;
  exportStatus: ExportStatus;
  diffStatus: ExportDiffStatus;
  sourceRecordCount: number;
  exportedRecordCount: number;
  warningCount: number;
  blockerCount: number;
  metrics?: ExportMetrics;
};

export type ExportSummary = {
  mode: 'dry-run';
  outputDir: string;
  selectedModules: ExportModuleFilter;
  moduleCount: number;
  implementedCount: number;
  skeletonOnlyCount: number;
  skippedEmptySourceCount: number;
  matchedCount: number;
  warningCount: number;
  errorCount: number;
  mysqlUnavailableCount: number;
  mysqlConfigured: boolean;
  mysqlAvailable: boolean;
  wroteServerData: false;
  wroteMysql: false;
  canRollback: false;
  writeModeEnabled: false;
  backupCreated: boolean;
  backupRoot: string | null;
  backupManifestPath: string | null;
  backupValidationStatus: BackupValidationStatus;
  rollbackAvailable: false;
  rollbackModeEnabled: false;
  backupRequiredBeforeWrite: true;
  backupPlan: BackupManifestPlan;
  rollbackPlan: RollbackManifestPlan;
  rollbackScope: RollbackScope;
  rollbackDeferredItems: string[];
  moduleSummaries: ExportModuleSummary[];
};

export type ExportRunResult = {
  manifest: ExportManifest;
  summary: ExportSummary;
  diffReport: {
    generatedAt: string;
    moduleResults: ModuleDiffReport[];
  };
  risks: ExportRisk[];
};
