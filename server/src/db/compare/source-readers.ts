import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { loadSource } from '../migration/source-loader.js';
import type { MigrationModuleName, ModuleDefinition, MigrationWarning } from '../migration/types.js';
import type { JsonSourceSnapshot } from './types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function stableValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function fileNameWithoutExt(fileName: string): string {
  return fileName.endsWith('.json') ? fileName.slice(0, -5) : fileName;
}

function keyed(prefix: string, value: string | null): string | null {
  return value ? `${prefix}:${value}` : null;
}

function compactKeys(keys: Array<string | null>): string[] {
  return Array.from(new Set(keys.filter((key): key is string => Boolean(key)))).sort();
}

function arrayRecords(data: unknown): Record<string, unknown>[] {
  return Array.isArray(data) ? data.filter(isRecord) : [];
}

function mediaLibraryRecords(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.filter(isRecord);
  }

  if (!isRecord(data)) {
    return [];
  }

  return Object.values(data).filter(isRecord);
}

function mediaLibraryStableKey(record: Record<string, unknown>): string | null {
  const publicUrl = asString(record.publicUrl ?? record.public_url ?? record.url);

  if (publicUrl) {
    return keyed('public_url', publicUrl);
  }

  const filePath = asString(record.filePath ?? record.file_path ?? record.path);

  if (filePath) {
    return keyed('file_path', filePath);
  }

  const fileName = asString(record.fileName ?? record.file_name ?? record.storageFileName ?? record.storage_file_name ?? record.name);
  const fileSize = stableValue(record.fileSize ?? record.file_size ?? record.size);

  if (fileName && fileSize) {
    return keyed('file_name_size', `${fileName}#${fileSize}`);
  }

  return null;
}

function getPublishVersion(log: Record<string, unknown>, fileName: string): string {
  return (
    stableValue(log.version)
    ?? stableValue(log.publishVersion)
    ?? stableValue(log.publish_version)
    ?? stableValue(log.publishId)
    ?? stableValue(log.publish_id)
    ?? stableValue(log.timestamp)
    ?? stableValue(log.generatedAt)
    ?? stableValue(log.generated_at)
    ?? fileNameWithoutExt(fileName)
  ).slice(0, 120);
}

async function publishLogKeys(sourceData: unknown, absolutePath: string, warnings: MigrationWarning[]): Promise<string[]> {
  if (!Array.isArray(sourceData)) {
    return [];
  }

  const keys: string[] = [];

  for (const item of sourceData) {
    if (!isRecord(item)) {
      continue;
    }

    const fileName = asString(item.fileName);

    if (!fileName) {
      continue;
    }

    try {
      const rawContent = await readFile(path.join(absolutePath, fileName), 'utf8');
      const parsed = JSON.parse(rawContent) as unknown;

      if (isRecord(parsed)) {
        keys.push(`publish_version:${getPublishVersion(parsed, fileName)}`);
      } else {
        keys.push(`publish_version:${fileNameWithoutExt(fileName)}`);
      }
    } catch (error) {
      warnings.push({
        code: 'compare_publish_log_read_failed',
        level: 'warning',
        message: `Could not read publish log ${fileName}: ${error instanceof Error ? error.message : 'unknown error'}.`,
      });
      keys.push(`publish_version:${fileNameWithoutExt(fileName)}`);
    }
  }

  return compactKeys(keys);
}

function stableKeysForModule(moduleName: MigrationModuleName, data: unknown): string[] {
  if (moduleName === 'contact-info') {
    return data === null || data === undefined ? [] : ['singleton:contact_info'];
  }

  if (moduleName === 'home-video') {
    return data === null || data === undefined ? [] : ['singleton:home_video'];
  }

  if (moduleName === 'home-interactive-images') {
    return compactKeys(arrayRecords(data).map((record, index) => keyed('slot', stableValue(record.slotNo ?? record.slotNumber ?? record.slot_number) ?? String(index + 1))));
  }

  if (moduleName === 'company-assets') {
    return compactKeys(arrayRecords(data).map((record) => keyed('asset_key', stableValue(record.assetKey ?? record.asset_key ?? record.id))));
  }

  if (moduleName === 'articles') {
    return compactKeys(arrayRecords(data).flatMap((record) => [
      keyed('slug', asString(record.slug)),
      keyed('source_id', stableValue(record.sourceId ?? record.source_id ?? record.id)),
    ]));
  }

  if (moduleName === 'cases') {
    return compactKeys(arrayRecords(data).flatMap((record) => [
      keyed('slug', asString(record.slug)),
      keyed('source_id', stableValue(record.sourceId ?? record.source_id ?? record.id)),
    ]));
  }

  if (moduleName === 'solutions') {
    return compactKeys(arrayRecords(data).flatMap((record) => [
      keyed('slug', asString(record.slug)),
      keyed('source_id', stableValue(record.sourceId ?? record.source_id ?? record.id)),
    ]));
  }

  if (moduleName === 'scenario-detail-pages') {
    return compactKeys(arrayRecords(data).flatMap((record) => [
      keyed('source_id', stableValue(record.sourceId ?? record.source_id ?? record.id)),
      keyed('route_path', asString(record.routePath ?? record.route_path)),
      keyed('slug', asString(record.slug)),
    ]));
  }

  if (moduleName === 'media-library') {
    return compactKeys(mediaLibraryRecords(data).map(mediaLibraryStableKey));
  }

  if (moduleName === 'pages') {
    return compactKeys(arrayRecords(data).flatMap((record) => [
      keyed('slug', asString(record.slug)),
      keyed('source_id', stableValue(record.sourceId ?? record.source_id ?? record.id)),
    ]));
  }

  return [];
}

export async function readJsonSource(definition: ModuleDefinition): Promise<JsonSourceSnapshot> {
  const source = await loadSource(definition);
  const warnings = [...source.warnings];
  const stableKeys = definition.moduleName === 'publish-logs'
    ? await publishLogKeys(source.data, source.absolutePath, warnings)
    : stableKeysForModule(definition.moduleName, source.data);

  return {
    moduleName: definition.moduleName,
    sourceFile: definition.sourceFile,
    absolutePath: source.absolutePath,
    sourceCount: source.sourceCount,
    sourceHash: source.sourceHash,
    data: source.data,
    stableKeys,
    warnings,
  };
}
