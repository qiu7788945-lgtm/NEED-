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

export type ModuleDiffReport = {
  moduleName: ExportModuleName;
  comparable: boolean;
  sourceJsonRead: boolean;
  mysqlConfigured: boolean;
  mysqlAvailable: boolean;
  exportImplemented: boolean;
  shapeRisk: RiskLevel;
  status: ExportStatus;
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
  diff: ModuleDiffReport;
  warnings: string[];
  blockers: string[];
};

export type ExportRisk = {
  code: string;
  level: 'info' | 'warning' | 'blocker';
  message: string;
};

export type ExportManifest = {
  exportVersion: '22-6-2';
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
  warnings: string[];
  blockers: string[];
};

export type ExportSummary = {
  mode: 'dry-run';
  outputDir: string;
  selectedModules: ExportModuleFilter;
  moduleCount: number;
  skeletonOnlyCount: number;
  skippedEmptySourceCount: number;
  mysqlConfigured: boolean;
  mysqlAvailable: boolean;
  wroteServerData: false;
  wroteMysql: false;
  canRollback: false;
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
