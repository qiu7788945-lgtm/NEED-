import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashJsonValue, sha256 } from './hash.js';
import type { LoadedSource, ModuleDefinition, MigrationWarning } from './types.js';

const migrationDir = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(migrationDir, '../../..');
const dataDir = path.join(serverRoot, 'data');
const publishLogsDir = path.join(dataDir, 'publish-logs');

function countJsonRecords(data: unknown, strategy: ModuleDefinition['countStrategy']): number {
  if (strategy === 'singleton') {
    return data === null || data === undefined ? 0 : 1;
  }

  if (Array.isArray(data)) {
    return data.length;
  }

  if (data && typeof data === 'object') {
    return Object.keys(data).length;
  }

  return 0;
}

async function loadPublishLogsSource(definition: ModuleDefinition): Promise<LoadedSource> {
  const warnings: MigrationWarning[] = [
    {
      code: 'publish_logs_plan_only',
      level: 'info',
      message:
        'publish-logs is snapshot/log metadata only in 22-3B-7; existing JSON publish log generation remains unchanged.',
    },
  ];

  try {
    const entries = await readdir(publishLogsDir, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));

    const manifestEntries = [];

    for (const fileName of files) {
      const absolutePath = path.join(publishLogsDir, fileName);
      const [fileStat, rawContent] = await Promise.all([stat(absolutePath), readFile(absolutePath)]);
      manifestEntries.push({
        fileName,
        size: fileStat.size,
        rawHash: sha256(rawContent.toString('utf8')),
      });
    }

    return {
      moduleName: definition.moduleName,
      sourceFile: definition.sourceFile,
      absolutePath: publishLogsDir,
      exists: true,
      sourceCount: manifestEntries.length,
      sourceHash: hashJsonValue(manifestEntries),
      data: manifestEntries,
      warnings,
    };
  } catch (error) {
    return {
      moduleName: definition.moduleName,
      sourceFile: definition.sourceFile,
      absolutePath: publishLogsDir,
      exists: false,
      sourceCount: 0,
      sourceHash: null,
      data: null,
      warnings: [
        ...warnings,
        {
          code: 'source_read_failed',
          level: definition.sourceRequired ? 'error' : 'warning',
          message: error instanceof Error ? error.message : 'Unable to read publish logs source.',
        },
      ],
    };
  }
}

export async function loadSource(definition: ModuleDefinition): Promise<LoadedSource> {
  if (definition.countStrategy === 'publish-logs') {
    return loadPublishLogsSource(definition);
  }

  const absolutePath = path.join(dataDir, definition.sourceFile);

  try {
    const rawContent = await readFile(absolutePath, 'utf8');
    const data = JSON.parse(rawContent) as unknown;
    const warnings: MigrationWarning[] = [];
    const sourceCount = countJsonRecords(data, definition.countStrategy);

    if (sourceCount === 0) {
      warnings.push({
        code: 'empty_source',
        level: 'info',
        message: `${definition.sourceFile} exists but contains no records for ${definition.moduleName}.`,
      });
    }

    return {
      moduleName: definition.moduleName,
      sourceFile: definition.sourceFile,
      absolutePath,
      exists: true,
      sourceCount,
      sourceHash: hashJsonValue(data),
      data,
      warnings,
    };
  } catch (error) {
    const isMissing = error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT';

    return {
      moduleName: definition.moduleName,
      sourceFile: definition.sourceFile,
      absolutePath,
      exists: false,
      sourceCount: 0,
      sourceHash: null,
      data: null,
      warnings: [
        {
          code: isMissing ? 'source_missing' : 'source_read_failed',
          level: definition.sourceRequired ? 'error' : 'warning',
          message: isMissing
            ? `${definition.sourceFile} was not found.`
            : error instanceof Error
              ? error.message
              : `Unable to read ${definition.sourceFile}.`,
        },
      ],
    };
  }
}
