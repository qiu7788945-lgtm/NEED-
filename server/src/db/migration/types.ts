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
  upsertKeys: string[];
  plannedWrites: PlannedTableWrite[];
  warnings: MigrationWarning[];
  schemaCompatibility: SchemaCompatibilityResult;
};

export type MigrationPlan = {
  mode: 'dry-run';
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
