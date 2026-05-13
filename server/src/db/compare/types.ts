import type { MigrationModuleName, MigrationWarning } from '../migration/types.js';

export type CompareStatus =
  | 'matched'
  | 'count_mismatch'
  | 'missing_in_mysql'
  | 'missing_in_json'
  | 'skipped_empty_source'
  | 'compare_not_implemented'
  | 'failed';

export type CompareCliOptions = {
  moduleName: MigrationModuleName | 'all';
  format: 'json';
};

export type StableKeyCheck = {
  keyName: string;
  jsonCount: number;
  mysqlCount: number;
  missingInMysql: string[];
  missingInJson: string[];
  status: 'matched' | 'missing_in_mysql' | 'missing_in_json';
};

export type JsonSourceSnapshot = {
  moduleName: MigrationModuleName;
  sourceFile: string;
  absolutePath: string;
  sourceCount: number;
  sourceHash: string | null;
  stableKeys: string[];
  warnings: MigrationWarning[];
};

export type MysqlTargetSnapshot = {
  moduleName: MigrationModuleName;
  tableName: string;
  rowCount: number;
  stableKeys: string[];
  extraCounts: Record<string, number>;
  warnings: MigrationWarning[];
};

export type ModuleCompareResult = {
  moduleName: MigrationModuleName;
  jsonSource: {
    sourceFile: string;
    absolutePath: string;
    sourceHash: string | null;
  };
  mysqlTarget: {
    tableName: string;
    extraCounts: Record<string, number>;
  };
  jsonCount: number;
  mysqlCount: number;
  status: CompareStatus;
  stableKeyChecks: StableKeyCheck[];
  warnings: MigrationWarning[];
  errors: MigrationWarning[];
};

export type CompareReport = {
  mode: 'compare';
  generatedAt: string;
  moduleFilter: MigrationModuleName | 'all';
  summary: {
    moduleCount: number;
    matchedCount: number;
    mismatchCount: number;
    warningCount: number;
    errorCount: number;
  };
  modules: ModuleCompareResult[];
};
