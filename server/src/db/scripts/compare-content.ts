import 'dotenv/config';
import { closeDbPool } from '../client.js';
import { runContentCompare } from '../compare/compare-runner.js';
import { writeCompareReport } from '../compare/report-writer.js';
import type { CompareCliOptions } from '../compare/types.js';
import { migrationModuleNames, type MigrationModuleName } from '../migration/types.js';

function printUsage(): void {
  console.log(`Usage:
  npm.cmd run compare:content
  npm.cmd run compare:content -- --module articles
  npm.cmd run compare:content -- --module media-library
  npm.cmd run compare:content -- --module cases
  npm.cmd run compare:content -- --module solutions
  npm.cmd run compare:content -- --module publish-logs
  npm.cmd run compare:content -- --module all
  npm.cmd run compare:content -- --format json
  npm.cmd run compare:content -- --module articles --detail

Options:
  --module <name> Compare one module, or "all". Defaults to all.
  --format json   Output JSON report. JSON is the only format in 22-4.
  --detail        Include 22-4 detail field checks. Enabled by default.`);
}

function isMigrationModuleName(value: string): value is MigrationModuleName {
  return migrationModuleNames.includes(value as MigrationModuleName);
}

function parseCliOptions(args: string[]): CompareCliOptions {
  const options: CompareCliOptions = {
    moduleName: 'all',
    format: 'json',
    detail: true,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

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

    if (arg === '--format') {
      const format = args[index + 1];

      if (format !== 'json') {
        throw new Error('Only --format json is supported in 22-4.');
      }

      options.format = 'json';
      index += 1;
      continue;
    }

    if (arg === '--detail') {
      options.detail = true;
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
  const options = parseCliOptions(process.argv.slice(2));
  const report = await runContentCompare(options);
  writeCompareReport(report);
}

main()
  .catch((error) => {
    console.error(JSON.stringify({
      mode: 'compare',
      status: 'failed',
      error: error instanceof Error ? error.message : 'Content compare failed.',
    }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDbPool();
  });
