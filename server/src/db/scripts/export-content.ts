import 'dotenv/config';
import { closeDbPool } from '../client.js';
import { runExportDryRun } from '../export/export-runner.js';
import { exportModuleNames, type ExportCliOptions, type ExportModuleName } from '../export/types.js';

function printUsage(): void {
  console.log(`Usage:
  npm.cmd run export:content:dry-run
  npm.cmd run export:content
  npm.cmd run export:content -- --module contact-info
  npm.cmd run export:content -- --module all --output-dir server/data-exports/mysql-json-export/manual
  npm.cmd run export:content -- --plan-backup
  npm.cmd run export:content -- --create-backup
  npm.cmd run export:content -- --write
  npm.cmd run export:content -- --rollback server/data-backups/mysql-json-export/<timestamp>/rollback-manifest.json

Options:
  --dry-run            Default. Generate reports under server/data-exports only.
  --module <name>      Export one module skeleton, or "all".
                       Supported: all, ${exportModuleNames.join(', ')}
  --output-dir <path>  Optional output directory. Must not be inside server/data or server/uploads.
  --format json        JSON output only.
  --plan-backup        Add a backup plan to the dry-run report only; no backup directory is created.
  --create-backup      Create a real JSON backup under server/data-backups without writing server/data.
  --rollback <path>    Rejected in 22-6-8; rollback restore is not implemented.
  --write              Rejected in 22-6-8; server/data is never overwritten.`);
}

function isExportModuleName(value: string): value is ExportModuleName {
  return exportModuleNames.includes(value as ExportModuleName);
}

function parseCliOptions(args: string[]): ExportCliOptions {
  const options: ExportCliOptions = {
    moduleName: 'all',
    format: 'json',
    dryRun: true,
    writeRequested: false,
    planBackupRequested: false,
    createBackupRequested: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--dry-run') {
      continue;
    }

    if (arg === '--module') {
      const moduleName = args[index + 1];
      if (!moduleName) {
        throw new Error('--module requires a module name.');
      }

      if (moduleName !== 'all' && !isExportModuleName(moduleName)) {
        throw new Error(`Unknown module "${moduleName}". Expected one of: all, ${exportModuleNames.join(', ')}`);
      }

      options.moduleName = moduleName;
      index += 1;
      continue;
    }

    if (arg === '--output-dir') {
      const outputDir = args[index + 1];
      if (!outputDir) {
        throw new Error('--output-dir requires a path.');
      }

      options.outputDir = outputDir;
      index += 1;
      continue;
    }

    if (arg === '--format') {
      const format = args[index + 1];
      if (format !== 'json') {
        throw new Error('Only --format json is supported in 22-6-8.');
      }

      options.format = 'json';
      index += 1;
      continue;
    }

    if (arg === '--write') {
      options.writeRequested = true;
      continue;
    }

    if (arg === '--plan-backup') {
      options.planBackupRequested = true;
      continue;
    }

    if (arg === '--create-backup') {
      options.createBackupRequested = true;
      continue;
    }

    if (arg === '--rollback') {
      const rollbackManifestPath = args[index + 1];
      if (!rollbackManifestPath) {
        throw new Error('--rollback requires a rollback manifest path.');
      }

      options.rollbackManifestPath = rollbackManifestPath;
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

async function main(): Promise<void> {
  let options: ExportCliOptions;

  try {
    options = parseCliOptions(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    printUsage();
    process.exitCode = 1;
    return;
  }

  try {
    const result = await runExportDryRun(options);
    console.log(JSON.stringify({
      mode: result.summary.mode,
      status: 'completed',
      outputDir: result.summary.outputDir,
      selectedModules: result.summary.selectedModules,
      moduleCount: result.summary.moduleCount,
      implementedCount: result.summary.implementedCount,
      skeletonOnlyCount: result.summary.skeletonOnlyCount,
      skippedEmptySourceCount: result.summary.skippedEmptySourceCount,
      matchedCount: result.summary.matchedCount,
      warningCount: result.summary.warningCount,
      errorCount: result.summary.errorCount,
      mysqlUnavailableCount: result.summary.mysqlUnavailableCount,
      mysqlConfigured: result.summary.mysqlConfigured,
      mysqlAvailable: result.summary.mysqlAvailable,
      wroteServerData: result.summary.wroteServerData,
      wroteMysql: result.summary.wroteMysql,
      canRollback: result.summary.canRollback,
      writeModeEnabled: result.summary.writeModeEnabled,
      backupCreated: result.summary.backupCreated,
      backupRoot: result.summary.backupRoot,
      backupManifestPath: result.summary.backupManifestPath,
      backupValidationStatus: result.summary.backupValidationStatus,
      rollbackAvailable: result.summary.rollbackAvailable,
      rollbackModeEnabled: result.summary.rollbackModeEnabled,
      backupRequiredBeforeWrite: result.summary.backupRequiredBeforeWrite,
    }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({
      mode: 'dry-run',
      status: 'failed',
      error: error instanceof Error ? error.message : 'Content export dry-run failed.',
      wroteServerData: false,
      wroteMysql: false,
      canRollback: false,
      writeModeEnabled: false,
      backupCreated: false,
      rollbackAvailable: false,
      rollbackModeEnabled: false,
      backupRequiredBeforeWrite: true,
    }, null, 2));
    process.exitCode = 1;
  } finally {
    await closeDbPool();
  }
}

void main();
