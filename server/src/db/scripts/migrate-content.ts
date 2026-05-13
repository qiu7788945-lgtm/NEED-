import 'dotenv/config';
import { closeDbPool, getSafeDatabaseConfig } from '../client.js';
import { prepareContentWrite, runContentWrite } from '../migration/content-write-runner.js';
import { reportMigrationPlan } from '../migration/plan-reporter.js';
import { loadSchemaTables, checkPlannedWritesAgainstSchema } from '../migration/schema-compatibility.js';
import { loadSource } from '../migration/source-loader.js';
import {
  migrationModuleNames,
  type CliOptions,
  type MigrationModuleName,
  type MigrationPlan,
  type ModulePlan,
} from '../migration/types.js';
import { isWritableContentModule } from '../migrators/low-risk-content.js';
import { moduleDefinitions } from '../migrators/registry.js';
import { createContentSnapshot } from '../snapshot/content-snapshot.js';

function printUsage(): void {
  console.log(`Usage:
  npm.cmd run migrate:content
  npm.cmd run migrate:content:dry-run
  npm.cmd run migrate:content -- --module articles
  npm.cmd run migrate:content -- --module all --fail-fast
  npm.cmd run migrate:content -- --write

Options:
  --dry-run        Default. Read JSON and print a plan only.
  --module <name> Run one module plan, or "all".
  --fail-fast      Stop plan generation after the first module error.
  --write          Create a JSON snapshot, write enabled shadow modules, and log all modules.
                   Does not switch any service or write unreleased modules in 22-3B-8.`);
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

function assertMySqlConfiguredForWrite(): void {
  const safeConfig = getSafeDatabaseConfig();

  if (!safeConfig.configured) {
    throw new Error(
      `--write requires MySQL configuration before any snapshot is created. Missing: ${safeConfig.missing.join(', ')}`,
    );
  }
}

async function buildModulePlan(
  definition: (typeof moduleDefinitions)[number],
  schemaTables: Awaited<ReturnType<typeof loadSchemaTables>>,
): Promise<ModulePlan> {
  const source = await loadSource(definition);
  const schemaCompatibility = checkPlannedWritesAgainstSchema(definition.plannedWrites, schemaTables);
  const businessWritesEnabled = isWritableContentModule(definition.moduleName);

  return {
    moduleName: definition.moduleName,
    migrationKey: definition.migrationKey,
    sourceFile: definition.sourceFile,
    sourceCount: source.sourceCount,
    sourceHash: source.sourceHash,
    businessWritesEnabled,
    skippedReason: businessWritesEnabled ? null : 'not_implemented_in_22_3B_8',
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
    mode: options.writeRequested ? 'write' : 'dry-run',
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

async function runWriteMode(plan: MigrationPlan): Promise<Awaited<ReturnType<typeof runContentWrite>>> {
  await prepareContentWrite(plan);
  const snapshot = await createContentSnapshot(plan);
  const writeResult = await runContentWrite(plan, snapshot);

  console.log(
    JSON.stringify(
      {
        mode: 'write',
        businessWritesEnabled: true,
        snapshotDir: snapshot.snapshotDir,
        sourceManifest: snapshot.manifestPath,
        summary: writeResult.summary,
        results: writeResult.results,
        migrationLogs: writeResult.migrationLogs,
      },
      null,
      2,
    ),
  );

  return writeResult;
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

  try {
    if (options.writeRequested) {
      assertMySqlConfiguredForWrite();
    }

    const plan = await buildMigrationPlan(options);
    reportMigrationPlan(plan);
    let failedWriteCount = 0;

    if (options.writeRequested) {
      const writeResult = await runWriteMode(plan);
      failedWriteCount = writeResult.summary.failedCount;
    }

    if (
      failedWriteCount > 0 ||
      !plan.summary.schemaCompatible ||
      plan.modules.some((modulePlan) => modulePlan.warnings.some((warning) => warning.level === 'error'))
    ) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await closeDbPool();
  }
}

void main();
