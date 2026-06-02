import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ExportModuleDefinition, SourceJsonSnapshot } from './types.js';

function hashContent(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function countJsonRecords(value: unknown): number {
  if (Array.isArray(value)) {
    return value.length;
  }

  if (value && typeof value === 'object') {
    return Object.keys(value).length;
  }

  return value === null || value === undefined ? 0 : 1;
}

export async function readSourceJson(
  projectRoot: string,
  definition: ExportModuleDefinition,
): Promise<SourceJsonSnapshot> {
  const absolutePath = path.resolve(projectRoot, definition.jsonPath);

  try {
    const raw = await fs.readFile(absolutePath, 'utf8');
    const data = JSON.parse(raw) as unknown;

    return {
      moduleName: definition.moduleName,
      jsonPath: definition.jsonPath,
      absolutePath,
      exists: true,
      readOk: true,
      sourceHash: hashContent(raw),
      recordCount: countJsonRecords(data),
      data,
    };
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;

    return {
      moduleName: definition.moduleName,
      jsonPath: definition.jsonPath,
      absolutePath,
      exists: nodeError.code !== 'ENOENT',
      readOk: false,
      sourceHash: null,
      recordCount: 0,
      data: null,
      error: error instanceof Error ? error.message : 'Unable to read source JSON.',
    };
  }
}
