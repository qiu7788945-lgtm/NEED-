import 'dotenv/config';
import { loadSchemaTables, checkPlannedWritesAgainstSchema } from '../migration/schema-compatibility.js';
import { loadSource } from '../migration/source-loader.js';
import {
  migrationModuleNames,
  type CliOptions,
  type MigrationModuleName,
  type MigrationPlan,
  type ModulePlan,
} from '../migration/types.js';
import { reportMigrationPlan } from '../migration/plan-reporter.js';
import { moduleDefinitions } from '../migrators/registry.js';

function printUsage(): void {
  console.log(`Usage:
  npm.cmd run migrate:content
  npm.cmd run migrate:content:dry-run
  npm.cmd run migrate:content -- --module articles
  npm.cmd run migrate:content -- --module all --fail-fast

Options:
  --dry-run        Default. Read JSON and print a plan only.
  --module <name> Run one module plan, or "all".
  --fail-fast      Stop plan generation after the first module error.
  --write          Recognized but intentionally disabled in 22-3B-1.`);
}

function isMigrationModuleName(value: string): value is MigrationModuleName {
  return migrationModuleNames.includes(value as MigrationModuleName);
}

function parseCliOptions(args: string[]): CliOptions {
  const options: CliOptions = {
    moduleName: 'all',
    failFast: false,
    writeRequested: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--dry-run') {
      continue;
    }

    if (arg === '--fail-fast') {
      options.failFast = true;
      continue;
    }

    if (arg === '--write') {
      options.writeRequested = true;
      continue;
    }

    if (arg === '--module') {
      const moduleName = args[index + 1];

      if (!moduleName) {
        throw new Error('--module requires a module name.');
      }

      if (moduleName !== 'all' && !isMigrationModuleName(moduleName)) {
        throw new Error(
          `Unknown module "${moduleName}". Expected one of: all, ${migrationModuleNames.join(', ')}`,
        );
      }

      options.moduleName = moduleName;
      index += 1;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

async function buildModulePlan(
  definition: (typeof moduleDefinitions)[number],
  schemaTables: Awaited<ReturnType<typeof loadSchemaTables>>,
): Promise<ModulePlan> {
  const source = await loadSource(definition);
  const schemaCompatibility = checkPlannedWritesAgainstSchema(definition.plannedWrites, schemaTables);

  return {
    moduleName: definition.moduleName,
    migrationKey: definition.migrationKey,
    sourceFile: definition.sourceFile,
    sourceCount: source.sourceCount,
    sourceHash: source.sourceHash,
    upsertKeys: definition.upsertKeys,
    plannedWrites: definition.plannedWrites,
    warnings: [
      ...source.warnings,
      ...schemaCompatibility.missingTables.map((issue) => ({
        code: 'schema_missing_table',
        level: 'error' as const,
        message: issue.message,
      })),
      ...schemaCompatibility.missingFields.map((issue) => ({
        code: 'schema_missing_field',
        level: 'error' as const,
        message: issue.message,
      })),
    ],
    schemaCompatibility,
  };
}

async function buildMigrationPlan(options: CliOptions): Promise<MigrationPlan> {
  const schemaTables = await loadSchemaTables();
  const selectedDefinitions =
    options.moduleName === 'all'
      ? moduleDefinitions
      : moduleDefinitions.filter((definition) => definition.moduleName === options.moduleName);
  const modules: ModulePlan[] = [];

  for (const definition of selectedDefinitions) {
    const modulePlan = await buildModulePlan(definition, schemaTables);
    modules.push(modulePlan);

    if (
      options.failFast &&
      modulePlan.warnings.some((warning) => warning.level === 'error')
    ) {
      break;
    }
  }

  const warningCount = modules.reduce((count, modulePlan) => count + modulePlan.warnings.length, 0);

  return {
    mode: 'dry-run',
    writeRequested: options.writeRequested,
    moduleFilter: options.moduleName,
    failFast: options.failFast,
    generatedAt: new Date().toISOString(),
    summary: {
      moduleCount: modules.length,
      sourceCountTotal: modules.reduce((count, modulePlan) => count + modulePlan.sourceCount, 0),
      warningCount,
      schemaCompatible: modules.every((modulePlan) => modulePlan.schemaCompatibility.ok),
    },
    modules,
  };
}

async function main(): Promise<void> {
  let options: CliOptions;

  try {
    options = parseCliOptions(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (options.writeRequested) {
    console.error(
      '第22-3B-1暂不开放写入：--write 已被识别，但本阶段不会写 MySQL 业务表、不会写 migration_logs、不会生成真实快照。',
    );
    process.exitCode = 1;
    return;
  }

  const plan = await buildMigrationPlan(options);
  reportMigrationPlan(plan);

  if (!plan.summary.schemaCompatible || plan.modules.some((modulePlan) => modulePlan.warnings.some((warning) => warning.level === 'error'))) {
    process.exitCode = 1;
  }
}

void main();
