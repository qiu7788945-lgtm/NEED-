import type {
  ExportFieldDiff,
  ExportModuleDefinition,
  ExportStatus,
  ModuleDiffReport,
  MysqlExportReadResult,
  MysqlReadResult,
  SourceJsonSnapshot,
} from './types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function pathWithSegment(basePath: string, segment: string | number): string {
  if (typeof segment === 'number') {
    return `${basePath}[${segment}]`;
  }

  return basePath ? `${basePath}.${segment}` : segment;
}

function primitiveMatches(sourceValue: unknown, exportedValue: unknown): boolean {
  return sourceValue === exportedValue;
}

function asDiffString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asDiffKey(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return '';
}

function stableContentKey(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  const slug = asDiffString(value.slug);
  if (slug) {
    return `slug:${slug}`;
  }

  const id = asDiffString(value.id);
  return id ? `id:${id}` : null;
}

function stableSolutionSceneKey(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  const slug = asDiffString(value.slug);
  return slug ? `scene:${slug}` : null;
}

function stableSolutionGroupKey(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  const slug = asDiffString(value.slug);
  if (slug) {
    return `group-slug:${slug}`;
  }

  const id = asDiffString(value.id) || asDiffString(value.source_id);
  return id ? `group-id:${id}` : null;
}

function stableSolutionItemKey(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = asDiffString(value.id) || asDiffString(value.source_id);
  if (id) {
    return `item-id:${id}`;
  }

  const mediaUrl = asDiffString(value.mediaUrl) || asDiffString(value.media_url);
  const sortOrder = asDiffKey(value.sortOrder ?? value.sort_order);
  return mediaUrl && sortOrder ? `item-media:${mediaUrl}|sort:${sortOrder}` : null;
}

function stableRecordFieldPath(key: string): string {
  return `$[${key}]`;
}

function buildStableRecordMap(input: {
  moduleLabel: string;
  records: unknown[];
  side: 'source' | 'exported';
  fieldDiffs: ExportFieldDiff[];
}): Map<string, unknown> {
  const map = new Map<string, unknown>();

  input.records.forEach((record, index) => {
    const key = stableContentKey(record);
    if (!key) {
      input.fieldDiffs.push({
        fieldPath: `$[${index}]`,
        sourceValue: input.side === 'source' ? record : undefined,
        exportedValue: input.side === 'exported' ? record : undefined,
        severity: 'error',
        reason: `${input.moduleLabel} ${input.side} record has no stable slug or id key.`,
      });
      return;
    }

    if (map.has(key)) {
      input.fieldDiffs.push({
        fieldPath: stableRecordFieldPath(key),
        sourceValue: input.side === 'source' ? record : undefined,
        exportedValue: input.side === 'exported' ? record : undefined,
        severity: 'error',
        reason: `Duplicate ${input.moduleLabel.toLowerCase()} ${input.side} record stable key.`,
      });
      return;
    }

    map.set(key, record);
  });

  return map;
}

function collectStableRecordFieldDiffs(input: {
  moduleLabel: string;
  sourceValue: unknown;
  exportedValue: unknown;
}): ExportFieldDiff[] {
  const { moduleLabel, sourceValue, exportedValue } = input;
  if (!Array.isArray(sourceValue) || !Array.isArray(exportedValue)) {
    return collectFieldDiffs(sourceValue, exportedValue);
  }

  const fieldDiffs: ExportFieldDiff[] = [];
  if (sourceValue.length !== exportedValue.length) {
    fieldDiffs.push({
      fieldPath: '$.length',
      sourceValue: sourceValue.length,
      exportedValue: exportedValue.length,
      severity: 'warning',
      reason: `${moduleLabel} count differs between source JSON and exported JSON.`,
    });
  }

  const sourceMap = buildStableRecordMap({ moduleLabel, records: sourceValue, side: 'source', fieldDiffs });
  const exportedMap = buildStableRecordMap({ moduleLabel, records: exportedValue, side: 'exported', fieldDiffs });
  const sourceKeys = Array.from(sourceMap.keys());
  const allKeys = Array.from(new Set([...sourceKeys, ...exportedMap.keys()])).sort((left, right) => {
    const leftIndex = sourceKeys.indexOf(left);
    const rightIndex = sourceKeys.indexOf(right);
    if (leftIndex >= 0 && rightIndex >= 0) {
      return leftIndex - rightIndex;
    }
    if (leftIndex >= 0) {
      return -1;
    }
    if (rightIndex >= 0) {
      return 1;
    }
    return left.localeCompare(right);
  });

  for (const key of allKeys) {
    const sourceRecord = sourceMap.get(key);
    const exportedRecord = exportedMap.get(key);

    if (sourceRecord === undefined || exportedRecord === undefined) {
      fieldDiffs.push({
        fieldPath: stableRecordFieldPath(key),
        sourceValue: sourceRecord,
        exportedValue: exportedRecord,
        severity: 'error',
        reason: sourceRecord === undefined
          ? `Exported ${moduleLabel.toLowerCase()} record has no matching source record by slug/id.`
          : `Source ${moduleLabel.toLowerCase()} record has no matching exported record by slug/id.`,
      });
      continue;
    }

    fieldDiffs.push(...collectFieldDiffs(sourceRecord, exportedRecord, stableRecordFieldPath(key)));
  }

  return fieldDiffs;
}

function buildSolutionRecordMap(input: {
  recordLabel: string;
  records: unknown[];
  side: 'source' | 'exported';
  keyForRecord: (record: unknown) => string | null;
  fieldDiffs: ExportFieldDiff[];
  basePath: string;
}): Map<string, unknown> {
  const map = new Map<string, unknown>();

  input.records.forEach((record, index) => {
    const key = input.keyForRecord(record);
    if (!key) {
      input.fieldDiffs.push({
        fieldPath: `${input.basePath}[${index}]`,
        sourceValue: input.side === 'source' ? record : undefined,
        exportedValue: input.side === 'exported' ? record : undefined,
        severity: 'error',
        reason: `${input.recordLabel} ${input.side} record has no stable key.`,
      });
      return;
    }

    if (map.has(key)) {
      input.fieldDiffs.push({
        fieldPath: `${input.basePath}[${key}]`,
        sourceValue: input.side === 'source' ? record : undefined,
        exportedValue: input.side === 'exported' ? record : undefined,
        severity: 'error',
        reason: `Duplicate ${input.recordLabel.toLowerCase()} ${input.side} record stable key.`,
      });
      return;
    }

    map.set(key, record);
  });

  return map;
}

function orderedStableKeys(sourceMap: Map<string, unknown>, exportedMap: Map<string, unknown>): string[] {
  const sourceKeys = Array.from(sourceMap.keys());
  return Array.from(new Set([...sourceKeys, ...exportedMap.keys()])).sort((left, right) => {
    const leftIndex = sourceKeys.indexOf(left);
    const rightIndex = sourceKeys.indexOf(right);
    if (leftIndex >= 0 && rightIndex >= 0) {
      return leftIndex - rightIndex;
    }
    if (leftIndex >= 0) {
      return -1;
    }
    if (rightIndex >= 0) {
      return 1;
    }
    return left.localeCompare(right);
  });
}

function collectRecordFieldDiffsExcept(input: {
  sourceRecord: Record<string, unknown>;
  exportedRecord: Record<string, unknown>;
  basePath: string;
  excludedKeys: Set<string>;
}): ExportFieldDiff[] {
  const fieldDiffs: ExportFieldDiff[] = [];
  const keys = Array.from(new Set([
    ...Object.keys(input.sourceRecord),
    ...Object.keys(input.exportedRecord),
  ])).sort();

  for (const key of keys) {
    if (input.excludedKeys.has(key)) {
      continue;
    }

    const sourceHasKey = Object.prototype.hasOwnProperty.call(input.sourceRecord, key);
    const exportedHasKey = Object.prototype.hasOwnProperty.call(input.exportedRecord, key);
    const fieldPath = pathWithSegment(input.basePath, key);

    if (!sourceHasKey || !exportedHasKey) {
      fieldDiffs.push({
        fieldPath,
        sourceValue: sourceHasKey ? input.sourceRecord[key] : undefined,
        exportedValue: exportedHasKey ? input.exportedRecord[key] : undefined,
        severity: 'error',
        reason: sourceHasKey
          ? 'Field exists in source JSON but is missing from exported JSON.'
          : 'Field exists in exported JSON but is missing from source JSON.',
      });
      continue;
    }

    fieldDiffs.push(...collectFieldDiffs(input.sourceRecord[key], input.exportedRecord[key], fieldPath));
  }

  return fieldDiffs;
}

function collectSolutionItemDiffs(input: {
  sourceItems: unknown[];
  exportedItems: unknown[];
  basePath: string;
}): ExportFieldDiff[] {
  const fieldDiffs: ExportFieldDiff[] = [];
  if (input.sourceItems.length !== input.exportedItems.length) {
    fieldDiffs.push({
      fieldPath: `${input.basePath}.length`,
      sourceValue: input.sourceItems.length,
      exportedValue: input.exportedItems.length,
      severity: 'warning',
      reason: 'Solution item count differs between source JSON and exported JSON.',
    });
  }

  const sourceMap = buildSolutionRecordMap({
    recordLabel: 'Solution item',
    records: input.sourceItems,
    side: 'source',
    keyForRecord: stableSolutionItemKey,
    fieldDiffs,
    basePath: input.basePath,
  });
  const exportedMap = buildSolutionRecordMap({
    recordLabel: 'Solution item',
    records: input.exportedItems,
    side: 'exported',
    keyForRecord: stableSolutionItemKey,
    fieldDiffs,
    basePath: input.basePath,
  });

  for (const key of orderedStableKeys(sourceMap, exportedMap)) {
    const sourceRecord = sourceMap.get(key);
    const exportedRecord = exportedMap.get(key);
    const itemPath = `${input.basePath}[${key}]`;

    if (sourceRecord === undefined || exportedRecord === undefined) {
      fieldDiffs.push({
        fieldPath: itemPath,
        sourceValue: sourceRecord,
        exportedValue: exportedRecord,
        severity: 'error',
        reason: sourceRecord === undefined
          ? 'Exported solution item has no matching source item by id/mediaUrl+sortOrder.'
          : 'Source solution item has no matching exported item by id/mediaUrl+sortOrder.',
      });
      continue;
    }

    fieldDiffs.push(...collectFieldDiffs(sourceRecord, exportedRecord, itemPath));
  }

  return fieldDiffs;
}

function collectSolutionGroupDiffs(input: {
  sourceGroups: unknown[];
  exportedGroups: unknown[];
  basePath: string;
}): ExportFieldDiff[] {
  const fieldDiffs: ExportFieldDiff[] = [];
  if (input.sourceGroups.length !== input.exportedGroups.length) {
    fieldDiffs.push({
      fieldPath: `${input.basePath}.length`,
      sourceValue: input.sourceGroups.length,
      exportedValue: input.exportedGroups.length,
      severity: 'warning',
      reason: 'Solution group count differs between source JSON and exported JSON.',
    });
  }

  const sourceMap = buildSolutionRecordMap({
    recordLabel: 'Solution group',
    records: input.sourceGroups,
    side: 'source',
    keyForRecord: stableSolutionGroupKey,
    fieldDiffs,
    basePath: input.basePath,
  });
  const exportedMap = buildSolutionRecordMap({
    recordLabel: 'Solution group',
    records: input.exportedGroups,
    side: 'exported',
    keyForRecord: stableSolutionGroupKey,
    fieldDiffs,
    basePath: input.basePath,
  });

  for (const key of orderedStableKeys(sourceMap, exportedMap)) {
    const sourceRecord = sourceMap.get(key);
    const exportedRecord = exportedMap.get(key);
    const groupPath = `${input.basePath}[${key}]`;

    if (sourceRecord === undefined || exportedRecord === undefined) {
      fieldDiffs.push({
        fieldPath: groupPath,
        sourceValue: sourceRecord,
        exportedValue: exportedRecord,
        severity: 'error',
        reason: sourceRecord === undefined
          ? 'Exported solution group has no matching source group by slug/id.'
          : 'Source solution group has no matching exported group by slug/id.',
      });
      continue;
    }

    if (!isRecord(sourceRecord) || !isRecord(exportedRecord)) {
      fieldDiffs.push(...collectFieldDiffs(sourceRecord, exportedRecord, groupPath));
      continue;
    }

    fieldDiffs.push(...collectRecordFieldDiffsExcept({
      sourceRecord,
      exportedRecord,
      basePath: groupPath,
      excludedKeys: new Set(['items']),
    }));

    const sourceItems = sourceRecord.items;
    const exportedItems = exportedRecord.items;
    if (!Array.isArray(sourceItems) || !Array.isArray(exportedItems)) {
      fieldDiffs.push(...collectFieldDiffs(sourceItems, exportedItems, pathWithSegment(groupPath, 'items')));
      continue;
    }

    fieldDiffs.push(...collectSolutionItemDiffs({
      sourceItems,
      exportedItems,
      basePath: pathWithSegment(groupPath, 'items'),
    }));
  }

  return fieldDiffs;
}

function collectSolutionFieldDiffs(sourceValue: unknown, exportedValue: unknown): ExportFieldDiff[] {
  if (!Array.isArray(sourceValue) || !Array.isArray(exportedValue)) {
    return collectFieldDiffs(sourceValue, exportedValue);
  }

  const fieldDiffs: ExportFieldDiff[] = [];
  if (sourceValue.length !== exportedValue.length) {
    fieldDiffs.push({
      fieldPath: '$.length',
      sourceValue: sourceValue.length,
      exportedValue: exportedValue.length,
      severity: 'warning',
      reason: 'Solution scene count differs between source JSON and exported JSON.',
    });
  }

  const sourceMap = buildSolutionRecordMap({
    recordLabel: 'Solution scene',
    records: sourceValue,
    side: 'source',
    keyForRecord: stableSolutionSceneKey,
    fieldDiffs,
    basePath: '$',
  });
  const exportedMap = buildSolutionRecordMap({
    recordLabel: 'Solution scene',
    records: exportedValue,
    side: 'exported',
    keyForRecord: stableSolutionSceneKey,
    fieldDiffs,
    basePath: '$',
  });

  for (const key of orderedStableKeys(sourceMap, exportedMap)) {
    const sourceRecord = sourceMap.get(key);
    const exportedRecord = exportedMap.get(key);
    const scenePath = stableRecordFieldPath(key);

    if (sourceRecord === undefined || exportedRecord === undefined) {
      fieldDiffs.push({
        fieldPath: scenePath,
        sourceValue: sourceRecord,
        exportedValue: exportedRecord,
        severity: 'error',
        reason: sourceRecord === undefined
          ? 'Exported solution scene has no matching source scene by slug.'
          : 'Source solution scene has no matching exported scene by slug.',
      });
      continue;
    }

    if (!isRecord(sourceRecord) || !isRecord(exportedRecord)) {
      fieldDiffs.push(...collectFieldDiffs(sourceRecord, exportedRecord, scenePath));
      continue;
    }

    fieldDiffs.push(...collectRecordFieldDiffsExcept({
      sourceRecord,
      exportedRecord,
      basePath: scenePath,
      excludedKeys: new Set(['groups']),
    }));

    const sourceGroups = sourceRecord.groups;
    const exportedGroups = exportedRecord.groups;
    if (!Array.isArray(sourceGroups) || !Array.isArray(exportedGroups)) {
      fieldDiffs.push(...collectFieldDiffs(sourceGroups, exportedGroups, pathWithSegment(scenePath, 'groups')));
      continue;
    }

    fieldDiffs.push(...collectSolutionGroupDiffs({
      sourceGroups,
      exportedGroups,
      basePath: pathWithSegment(scenePath, 'groups'),
    }));
  }

  return fieldDiffs;
}

function collectFieldDiffs(sourceValue: unknown, exportedValue: unknown, basePath = ''): ExportFieldDiff[] {
  if (Array.isArray(sourceValue) || Array.isArray(exportedValue)) {
    if (!Array.isArray(sourceValue) || !Array.isArray(exportedValue)) {
      return [{
        fieldPath: basePath || '$',
        sourceValue,
        exportedValue,
        severity: 'error',
        reason: 'Source and exported values do not have the same JSON shape.',
      }];
    }

    const fieldDiffs: ExportFieldDiff[] = [];
    if (sourceValue.length !== exportedValue.length) {
      fieldDiffs.push({
        fieldPath: `${basePath || '$'}.length`,
        sourceValue: sourceValue.length,
        exportedValue: exportedValue.length,
        severity: 'warning',
        reason: 'Array length differs between source JSON and exported JSON.',
      });
    }

    for (let index = 0; index < Math.max(sourceValue.length, exportedValue.length); index += 1) {
      fieldDiffs.push(...collectFieldDiffs(sourceValue[index], exportedValue[index], pathWithSegment(basePath, index)));
    }

    return fieldDiffs;
  }

  if (isRecord(sourceValue) || isRecord(exportedValue)) {
    if (!isRecord(sourceValue) || !isRecord(exportedValue)) {
      return [{
        fieldPath: basePath || '$',
        sourceValue,
        exportedValue,
        severity: 'error',
        reason: 'Source and exported values do not have the same JSON shape.',
      }];
    }

    const fieldDiffs: ExportFieldDiff[] = [];
    const keys = Array.from(new Set([...Object.keys(sourceValue), ...Object.keys(exportedValue)])).sort();

    for (const key of keys) {
      const sourceHasKey = Object.prototype.hasOwnProperty.call(sourceValue, key);
      const exportedHasKey = Object.prototype.hasOwnProperty.call(exportedValue, key);
      const fieldPath = pathWithSegment(basePath, key);

      if (!sourceHasKey || !exportedHasKey) {
        fieldDiffs.push({
          fieldPath,
          sourceValue: sourceHasKey ? sourceValue[key] : undefined,
          exportedValue: exportedHasKey ? exportedValue[key] : undefined,
          severity: 'error',
          reason: sourceHasKey
            ? 'Field exists in source JSON but is missing from exported JSON.'
            : 'Field exists in exported JSON but is missing from source JSON.',
        });
        continue;
      }

      fieldDiffs.push(...collectFieldDiffs(sourceValue[key], exportedValue[key], fieldPath));
    }

    return fieldDiffs;
  }

  if (primitiveMatches(sourceValue, exportedValue)) {
    return [];
  }

  return [{
    fieldPath: basePath || '$',
    sourceValue,
    exportedValue,
    severity: 'warning',
    reason: 'Exported value differs from source JSON.',
  }];
}

function diffStatusFromFieldDiffs(input: {
  fieldDiffs: ExportFieldDiff[];
  warnings: string[];
  blockers: string[];
}): ModuleDiffReport['diffStatus'] {
  if (input.blockers.length > 0 || input.fieldDiffs.some((diff) => diff.severity === 'error')) {
    return 'error';
  }

  if (input.warnings.length > 0 || input.fieldDiffs.some((diff) => diff.severity === 'warning')) {
    return 'warning';
  }

  return 'matched';
}

function sourceRecordCountForModule(input: {
  definition: ExportModuleDefinition;
  source: SourceJsonSnapshot;
}): number {
  if (!input.source.readOk) {
    return input.source.recordCount;
  }

  if (input.definition.moduleName === 'contact-info' || input.definition.moduleName === 'home-video') {
    return input.source.data === null || input.source.data === undefined ? 0 : 1;
  }

  if (Array.isArray(input.source.data)) {
    return input.source.data.length;
  }

  return input.source.recordCount;
}

export function buildModuleDiffReport(input: {
  definition: ExportModuleDefinition;
  source: SourceJsonSnapshot;
  mysql: MysqlReadResult;
  mysqlExport: MysqlExportReadResult;
  exportStatus: ExportStatus;
}): ModuleDiffReport {
  const { definition, source, mysql, mysqlExport, exportStatus } = input;
  const exportImplemented = exportStatus === 'implemented' && mysqlExport.implemented;
  const sourceRecordCount = sourceRecordCountForModule({ definition, source });

  if (!source.readOk) {
    return {
      moduleName: definition.moduleName,
      comparable: false,
      matched: false,
      diffStatus: 'error',
      sourceJsonRead: false,
      mysqlConfigured: mysql.configured,
      mysqlAvailable: mysql.available,
      exportImplemented,
      shapeRisk: definition.riskLevel,
      status: exportStatus,
      sourceRecordCount,
      exportedRecordCount: mysqlExport.recordCount,
      fieldDiffs: [],
      warnings: mysqlExport.warnings,
      blockers: [source.error ?? 'Source JSON could not be read.', ...mysqlExport.blockers],
      metrics: mysqlExport.metrics,
      reason: source.error ?? 'Source JSON could not be read.',
    };
  }

  if (mysqlExport.status === 'mysql_unavailable') {
    return {
      moduleName: definition.moduleName,
      comparable: false,
      matched: false,
      diffStatus: 'mysql_unavailable',
      sourceJsonRead: true,
      mysqlConfigured: mysql.configured,
      mysqlAvailable: false,
      exportImplemented,
      shapeRisk: definition.riskLevel,
      status: exportStatus,
      sourceRecordCount,
      exportedRecordCount: mysqlExport.recordCount,
      fieldDiffs: [],
      warnings: mysqlExport.warnings,
      blockers: mysqlExport.blockers,
      metrics: mysqlExport.metrics,
      reason: mysql.configured
        ? (mysqlExport.blockers[0] ?? mysql.error ?? 'MySQL export read did not complete.')
        : `MySQL is not configured. Missing: ${mysql.missing.join(', ')}`,
    };
  }

  if (!exportImplemented) {
    return {
      moduleName: definition.moduleName,
      comparable: false,
      matched: false,
      diffStatus: exportStatus === 'skipped_empty_source' ? 'skipped_empty_source' : 'not_implemented',
      sourceJsonRead: true,
      mysqlConfigured: true,
      mysqlAvailable: mysql.available,
      exportImplemented,
      shapeRisk: definition.riskLevel,
      status: exportStatus,
      sourceRecordCount,
      exportedRecordCount: mysqlExport.recordCount,
      fieldDiffs: [],
      warnings: mysqlExport.warnings,
      blockers: mysqlExport.blockers,
      metrics: mysqlExport.metrics,
      reason: exportStatus === 'skipped_empty_source'
        ? 'Current source is empty or intentionally skipped in the 22-6-8 dry-run export.'
        : 'MySQL-to-JSON export is not implemented for this module in 22-6-8.',
    };
  }

  const fieldDiffs = mysqlExport.status === 'exported' || mysqlExport.status === 'shape_risk'
    ? (definition.moduleName === 'solutions'
        ? collectSolutionFieldDiffs(source.data, mysqlExport.data)
        : definition.moduleName === 'articles' || definition.moduleName === 'cases'
        ? collectStableRecordFieldDiffs({
            moduleLabel: definition.moduleName === 'articles' ? 'Article' : 'Case',
            sourceValue: source.data,
            exportedValue: mysqlExport.data,
          })
        : collectFieldDiffs(source.data, mysqlExport.data))
    : [];
  const diffStatus = mysqlExport.status === 'shape_risk'
    ? 'error'
    : diffStatusFromFieldDiffs({
        fieldDiffs,
        warnings: mysqlExport.warnings,
        blockers: mysqlExport.blockers,
      });
  const matched = diffStatus === 'matched';

  return {
    moduleName: definition.moduleName,
    comparable: mysqlExport.status === 'exported',
    matched,
    diffStatus,
    sourceJsonRead: true,
    mysqlConfigured: mysql.configured,
    mysqlAvailable: mysql.available,
    exportImplemented,
    shapeRisk: definition.riskLevel,
    status: exportStatus,
    sourceRecordCount,
    exportedRecordCount: mysqlExport.recordCount,
    fieldDiffs,
    warnings: mysqlExport.warnings,
    blockers: mysqlExport.blockers,
    metrics: mysqlExport.metrics,
    reason: matched
      ? 'Exported JSON matches source JSON.'
      : 'Exported JSON differs from source JSON; see fieldDiffs, warnings, and blockers.',
  };
}
