export const migrationModuleNames = [
  'articles',
  'cases',
  'solutions',
  'scenario-detail-pages',
  'pages',
  'home-video',
  'home-interactive-images',
  'contact-info',
  'company-assets',
  'media-library',
  'publish-logs',
] as const;

export type MigrationModuleName = (typeof migrationModuleNames)[number];

export type SourceCountStrategy = 'array' | 'singleton' | 'publish-logs';

export type WarningLevel = 'info' | 'warning' | 'error';

export type MigrationWarning = {
  code: string;
  level: WarningLevel;
  message: string;
};

export type PlannedTableWrite = {
  table: string;
  fields: string[];
  purpose: string;
};

export type ModuleDefinition = {
  moduleName: MigrationModuleName;
  migrationKey: string;
  sourceFile: string;
  sourceRequired: boolean;
  countStrategy: SourceCountStrategy;
  upsertKeys: string[];
  plannedWrites: PlannedTableWrite[];
};

export type LoadedSource = {
  moduleName: MigrationModuleName;
  sourceFile: string;
  absolutePath: string;
  exists: boolean;
  sourceCount: number;
  sourceHash: string | null;
  data: unknown;
  warnings: MigrationWarning[];
};

export type SourceManifestEntry = {
  batch_id: string;
  created_at: string;
  git_commit: string | null;
  source_file: string;
  relative_path: string;
  source_hash: string | null;
  raw_file_hash: string | null;
  file_size: number;
  record_count: number;
  included_in_migration: boolean;
  notes: string[];
};

export type SchemaTable = {
  table: string;
  fields: string[];
};

export type SchemaCompatibilityIssue = {
  table: string;
  field?: string;
  message: string;
};

export type SchemaCompatibilityResult = {
  ok: boolean;
  checkedTables: string[];
  missingTables: SchemaCompatibilityIssue[];
  missingFields: SchemaCompatibilityIssue[];
};

export type ModulePlan = {
  moduleName: MigrationModuleName;
  migrationKey: string;
  sourceFile: string;
  sourceCount: number;
  sourceHash: string | null;
  businessWritesEnabled: boolean;
  skippedReason: string | null;
  upsertKeys: string[];
  plannedWrites: PlannedTableWrite[];
  warnings: MigrationWarning[];
  schemaCompatibility: SchemaCompatibilityResult;
};

export type ActualTableWrite = {
  table: string;
  inserted: number;
  updated: number;
  skipped: number;
};

export type ModuleMigrationResult = {
  moduleName: MigrationModuleName;
  migrationKey: string;
  sourceFile: string;
  sourceHash: string | null;
  status: 'success' | 'skipped' | 'failed' | 'not_implemented';
  sourceCount: number;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  warningCount: number;
  errorMessage: string | null;
  actualWrites: ActualTableWrite[];
  warnings: MigrationWarning[];
  skippedReason: string | null;
  details?: Record<string, unknown>;
  startedAt: Date;
  finishedAt: Date;
};

export type MigrationPlan = {
  mode: 'dry-run' | 'write';
  writeRequested: boolean;
  moduleFilter: MigrationModuleName | 'all';
  failFast: boolean;
  generatedAt: string;
  summary: {
    moduleCount: number;
    sourceCountTotal: number;
    warningCount: number;
    schemaCompatible: boolean;
  };
  modules: ModulePlan[];
};

export type CliOptions = {
  moduleName: MigrationModuleName | 'all';
  failFast: boolean;
  writeRequested: boolean;
};
