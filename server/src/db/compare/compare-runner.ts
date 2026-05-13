import { getSafeDatabaseConfig } from '../client.js';
import { migrationModuleNames, type MigrationModuleName } from '../migration/types.js';
import { moduleDefinitions } from '../migrators/registry.js';
import { runDetailCompare } from './detail-checks.js';
import { isCountEqualityInformational, readMysqlTarget } from './mysql-readers.js';
import { readJsonSource } from './source-readers.js';
import type {
  CompareCliOptions,
  DetailCompareStatus,
  CompareReport,
  CompareStatus,
  ModuleCompareResult,
  StableKeyCheck,
} from './types.js';

function stableKeyCheck(jsonKeys: string[], mysqlKeys: string[]): StableKeyCheck {
  const jsonKeySet = new Set(jsonKeys);
  const mysqlKeySet = new Set(mysqlKeys);
  const missingInMysql = jsonKeys.filter((key) => !mysqlKeySet.has(key));
  const missingInJson = mysqlKeys.filter((key) => !jsonKeySet.has(key));
  const status = missingInMysql.length > 0
    ? 'missing_in_mysql'
    : missingInJson.length > 0
      ? 'missing_in_json'
      : 'matched';

  return {
    keyName: 'stable_keys',
    jsonCount: jsonKeys.length,
    mysqlCount: mysqlKeys.length,
    missingInMysql,
    missingInJson,
    status,
  };
}

function getModuleStatus(input: {
  moduleName: MigrationModuleName;
  jsonCount: number;
  mysqlCount: number;
  keyCheck: StableKeyCheck;
  errorCount: number;
  detailStatus?: DetailCompareStatus;
}): CompareStatus {
  if (input.errorCount > 0) {
    return 'failed';
  }

  if (input.jsonCount === 0 && input.mysqlCount === 0) {
    return 'skipped_empty_source';
  }

  if (input.keyCheck.missingInMysql.length > 0) {
    return 'missing_in_mysql';
  }

  if (!isCountEqualityInformational(input.moduleName) && input.keyCheck.missingInJson.length > 0) {
    return 'missing_in_json';
  }

  if (input.jsonCount > 0 && input.mysqlCount === 0) {
    return 'missing_in_mysql';
  }

  if (!isCountEqualityInformational(input.moduleName) && input.jsonCount === 0 && input.mysqlCount > 0) {
    return 'missing_in_json';
  }

  if (!isCountEqualityInformational(input.moduleName) && input.jsonCount !== input.mysqlCount) {
    return 'count_mismatch';
  }

  if (input.detailStatus === 'failed') {
    return 'failed';
  }

  if (input.detailStatus === 'field_mismatch') {
    return 'field_mismatch';
  }

  if (input.detailStatus === 'warning') {
    return 'warning';
  }

  return 'matched';
}

async function compareModule(moduleName: MigrationModuleName, options: CompareCliOptions): Promise<ModuleCompareResult> {
  const definition = moduleDefinitions.find((item) => item.moduleName === moduleName);

  if (!definition) {
    return {
      moduleName,
      jsonSource: {
        sourceFile: '',
        absolutePath: '',
        sourceHash: null,
      },
      mysqlTarget: {
        tableName: '',
        extraCounts: {},
      },
      jsonCount: 0,
      mysqlCount: 0,
      status: 'compare_not_implemented',
      detailStatus: 'failed',
      stableKeyChecks: [],
      fieldChecks: [],
      warnings: [],
      errors: [
        {
          code: 'compare_definition_missing',
          level: 'error',
          message: `No module definition exists for ${moduleName}.`,
        },
      ],
    };
  }

  try {
    const [jsonSource, mysqlTarget] = await Promise.all([
      readJsonSource(definition),
      readMysqlTarget(moduleName),
    ]);
    const keyCheck = stableKeyCheck(jsonSource.stableKeys, mysqlTarget.stableKeys);
    const detail = options.detail
      ? await runDetailCompare({ moduleName, jsonSource, mysqlTarget })
      : { fieldChecks: [], warnings: [], errors: [] };
    const warnings = [...jsonSource.warnings, ...mysqlTarget.warnings, ...detail.warnings];
    const errors = warnings.filter((warning) => warning.level === 'error');
    const allErrors = [...errors, ...detail.errors];

    return {
      moduleName,
      jsonSource: {
        sourceFile: jsonSource.sourceFile,
        absolutePath: jsonSource.absolutePath,
        sourceHash: jsonSource.sourceHash,
      },
      mysqlTarget: {
        tableName: mysqlTarget.tableName,
        extraCounts: mysqlTarget.extraCounts,
      },
      jsonCount: jsonSource.sourceCount,
      mysqlCount: mysqlTarget.rowCount,
      status: getModuleStatus({
        moduleName,
        jsonCount: jsonSource.sourceCount,
        mysqlCount: mysqlTarget.rowCount,
        keyCheck,
        errorCount: allErrors.length,
        detailStatus: detail.detailStatus,
      }),
      detailStatus: detail.detailStatus,
      stableKeyChecks: [keyCheck],
      fieldChecks: detail.fieldChecks,
      warnings,
      errors: allErrors,
    };
  } catch (error) {
    return {
      moduleName,
      jsonSource: {
        sourceFile: definition.sourceFile,
        absolutePath: '',
        sourceHash: null,
      },
      mysqlTarget: {
        tableName: '',
        extraCounts: {},
      },
      jsonCount: 0,
      mysqlCount: 0,
      status: 'failed',
      stableKeyChecks: [],
      fieldChecks: [],
      warnings: [],
      errors: [
        {
          code: 'compare_module_failed',
          level: 'error',
          message: error instanceof Error ? error.message : `Compare failed for ${moduleName}.`,
        },
      ],
    };
  }
}

function assertMySqlConfigured(): void {
  const safeConfig = getSafeDatabaseConfig();

  if (!safeConfig.configured) {
    throw new Error(`compare:content requires MySQL configuration. Missing: ${safeConfig.missing.join(', ')}`);
  }
}

function buildSummary(modules: ModuleCompareResult[]): CompareReport['summary'] {
  const matchedCount = modules.filter((module) => module.status === 'matched' || module.status === 'skipped_empty_source').length;
  const warningCount = modules.reduce((sum, module) => sum + module.warnings.length, 0);
  const errorCount = modules.reduce((sum, module) => sum + module.errors.length, 0);

  return {
    moduleCount: modules.length,
    matchedCount,
    mismatchCount: modules.length - matchedCount,
    warningCount,
    errorCount,
  };
}

export async function runContentCompare(options: CompareCliOptions): Promise<CompareReport> {
  assertMySqlConfigured();

  const selectedModules = options.moduleName === 'all'
    ? migrationModuleNames
    : [options.moduleName];
  const modules = [];

  for (const moduleName of selectedModules) {
    modules.push(await compareModule(moduleName, options));
  }

  return {
    mode: 'compare',
    generatedAt: new Date().toISOString(),
    moduleFilter: options.moduleName,
    summary: buildSummary(modules),
    modules,
  };
}
