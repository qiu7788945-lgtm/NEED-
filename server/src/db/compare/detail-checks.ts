import type { RowDataPacket } from 'mysql2/promise';
import { getDbPool } from '../client.js';
import type { MigrationModuleName, MigrationWarning } from '../migration/types.js';
import type {
  DetailCompareStatus,
  FieldCheck,
  FieldCheckStatus,
  JsonSourceSnapshot,
  MysqlTargetSnapshot,
} from './types.js';

const detailedModuleNames = [
  'pages',
  'contact-info',
  'company-assets',
  'home-video',
  'home-interactive-images',
] as const satisfies MigrationModuleName[];

type DetailedModuleName = (typeof detailedModuleNames)[number];

type DetailCompareResult = {
  detailStatus?: DetailCompareStatus;
  fieldChecks: FieldCheck[];
  warnings: MigrationWarning[];
  errors: MigrationWarning[];
};

type PageRow = RowDataPacket & {
  id: number;
  source_id: string | null;
  title: string;
  slug: string;
  summary: string | null;
  status: string;
  sort_order: number | string;
  is_system_page: number | boolean;
};

type ContactInfoRow = RowDataPacket & {
  singleton_key: string | null;
  content_json: unknown;
  is_enabled: number | boolean | string;
};

type CompanyAssetRow = RowDataPacket & {
  asset_key: string;
  media_id: number | string | null;
  media_url: string | null;
  alt_text: string | null;
  description: string | null;
  sort_order: number | string;
  is_enabled: number | boolean | string;
  raw_json: unknown;
};

type HomeVideoRow = RowDataPacket & {
  singleton_key: string | null;
  video_media_id: number | string | null;
  poster_media_id: number | string | null;
  video_url: string | null;
  poster_url: string | null;
  title: string | null;
  description: string | null;
  is_enabled: number | boolean | string;
};

type HomeInteractiveImageRow = RowDataPacket & {
  slot_number: number | string;
  media_id: number | string | null;
  image_url: string | null;
  alt_text: string | null;
  sort_order: number | string;
  is_enabled: number | boolean | string;
};

type MediaRow = RowDataPacket & {
  id: number;
  public_url: string | null;
  file_path: string | null;
  metadata_json: unknown;
};

type PathValue = {
  exists: boolean;
  value: unknown;
};

type SqlValue = string | number | boolean | Date | null | SqlValue[] | { [key: string]: SqlValue };
type SqlParams = { [key: string]: SqlValue };

type EnabledSource = {
  fieldName: string | null;
  missing: boolean;
  value: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isDetailedCompareModule(moduleName: MigrationModuleName): moduleName is DetailedModuleName {
  return detailedModuleNames.includes(moduleName as DetailedModuleName);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  const text = asString(value).trim();
  return text ? text : null;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  return fallback;
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numberValue = asNumber(value, Number.NaN);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function booleanFromStatus(value: string, fallback: boolean): boolean {
  const normalized = value.trim().toLowerCase();

  if (['active', 'enabled', 'published', 'visible', 'online'].includes(normalized)) {
    return true;
  }

  if (['disabled', 'inactive', 'draft', 'hidden', 'offline', 'archived'].includes(normalized)) {
    return false;
  }

  return fallback;
}

function asBooleanSemantic(value: unknown, fallback = true): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'bigint') {
    return value !== 0n;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (['1', 'true', 'yes'].includes(normalized)) {
      return true;
    }

    if (['0', 'false', 'no'].includes(normalized)) {
      return false;
    }

    return booleanFromStatus(value, fallback);
  }

  return fallback;
}

function firstPresent(record: Record<string, unknown>, names: string[]): { name: string; value: unknown } | null {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(record, name)) {
      return { name, value: record[name] };
    }
  }

  return null;
}

function sourceNullableString(record: Record<string, unknown>, names: string[]): string | null {
  const value = firstPresent(record, names)?.value;
  return asNullableString(value);
}

function sourceNumber(record: Record<string, unknown>, names: string[], fallback = 0): number {
  const value = firstPresent(record, names)?.value;
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function sourceEnabled(record: Record<string, unknown>, fallback = true): EnabledSource {
  const enabled = firstPresent(record, ['enabled', 'is_enabled', 'isEnabled']);

  if (enabled) {
    return {
      fieldName: enabled.name,
      missing: false,
      value: asBooleanSemantic(enabled.value, fallback),
    };
  }

  const status = firstPresent(record, ['status']);

  if (status) {
    return {
      fieldName: status.name,
      missing: false,
      value: asBooleanSemantic(status.value, fallback),
    };
  }

  return {
    fieldName: null,
    missing: true,
    value: fallback,
  };
}

function normalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeJson);
  }

  if (isRecord(value)) {
    const sorted: Record<string, unknown> = {};

    for (const key of Object.keys(value).sort()) {
      sorted[key] = normalizeJson(value[key]);
    }

    return sorted;
  }

  return value;
}

function jsonEquals(left: unknown, right: unknown): boolean {
  return JSON.stringify(normalizeJson(left)) === JSON.stringify(normalizeJson(right));
}

function jsonContainsCoreFields(container: unknown, core: Record<string, unknown>): boolean {
  if (!isRecord(container)) {
    return false;
  }

  return Object.entries(core).every(([key, value]) => {
    if (!Object.prototype.hasOwnProperty.call(container, key)) {
      return false;
    }

    return jsonEquals(container[key], value);
  });
}

function parseJsonColumn(value: unknown): unknown {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return value;
    }
  }

  if (Buffer.isBuffer(value)) {
    try {
      return JSON.parse(value.toString('utf8')) as unknown;
    } catch {
      return value.toString('utf8');
    }
  }

  return value;
}

function getPath(record: unknown, path: string[]): PathValue {
  let current = record;

  for (const segment of path) {
    if (!isRecord(current) || !Object.prototype.hasOwnProperty.call(current, segment)) {
      return { exists: false, value: undefined };
    }

    current = current[segment];
  }

  return { exists: true, value: current };
}

function comparableMediaUrl(url: string | null, media: MediaRow): boolean {
  if (!url) {
    return false;
  }

  const publicUrl = asNullableString(media.public_url);
  const filePath = asNullableString(media.file_path);

  return [publicUrl, filePath].some((value) => Boolean(value && (value === url || value.includes(url))));
}

function normalizedText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null;
}

function textMatches(value: unknown, expected: string): boolean {
  return normalizedText(value) === expected.toLowerCase();
}

function numberMatches(value: unknown, expected: number): boolean {
  const numberValue = asNullableNumber(value);
  return numberValue === expected;
}

function hasAnyValue(values: unknown[]): boolean {
  return values.some((value) => value !== null && value !== undefined && value !== '');
}

function sourceRecordFromMetadata(metadata: unknown): Record<string, unknown> {
  return isRecord(metadata) && isRecord(metadata.sourceRecord) ? metadata.sourceRecord : {};
}

function homeInteractiveMetadataResult(metadata: unknown, slotNumber: number): {
  status: 'matched' | 'warning' | 'mismatch';
  message: string;
} {
  if (!isRecord(metadata)) {
    return {
      status: 'warning',
      message: 'media_files metadata_json is not structured JSON, but the media URL matched; treating metadata ownership as a warning for the shared table.',
    };
  }

  const sourceRecord = sourceRecordFromMetadata(metadata);
  const moduleName = normalizedText(metadata.moduleName);
  const slotValues = [
    metadata.slotNumber,
    metadata.slotNo,
    metadata.slot_number,
    sourceRecord.slotNumber,
    sourceRecord.slotNo,
    sourceRecord.slot_number,
  ];
  const ownerValues = [metadata.ownerType, sourceRecord.ownerType];
  const groupValues = [metadata.groupKey, sourceRecord.groupKey];
  const categoryValues = [metadata.category, sourceRecord.category];
  const slotMatches = slotValues.some((value) => numberMatches(value, slotNumber));
  const ownerMatches = ownerValues.some((value) => textMatches(value, 'home'));
  const groupMatches = groupValues.some((value) => textMatches(value, 'home-interactive'));
  const categoryMatches = categoryValues.some((value) => textMatches(value, 'home_interactive'));
  const directMatch = moduleName === 'home-interactive-images' && slotMatches;
  const sharedMatch = moduleName === 'media-library' && slotMatches && ownerMatches && (groupMatches || categoryMatches);

  if (directMatch) {
    return {
      status: 'matched',
      message: 'media_files metadata_json keeps direct home-interactive-images ownership metadata.',
    };
  }

  if (sharedMatch) {
    return {
      status: 'matched',
      message: 'media_files metadata_json is owned by shared media-library record but keeps home-interactive ownership metadata.',
    };
  }

  const moduleConflicts = moduleName !== null && !['home-interactive-images', 'media-library'].includes(moduleName);
  const slotConflicts = hasAnyValue(slotValues) && !slotMatches;
  const ownerConflicts = hasAnyValue(ownerValues) && !ownerMatches;
  const groupOrCategoryPresent = hasAnyValue(groupValues) || hasAnyValue(categoryValues);
  const groupCategoryConflicts = groupOrCategoryPresent && !groupMatches && !categoryMatches;
  const hasExplicitConflict = moduleConflicts || slotConflicts || ownerConflicts || groupCategoryConflicts;

  if (hasExplicitConflict) {
    return {
      status: 'mismatch',
      message: 'media_files metadata_json has conflicting home-interactive ownership metadata.',
    };
  }

  return {
    status: 'warning',
    message: 'media_files metadata_json is incomplete for home-interactive ownership, but the media URL matched; treating metadata ownership as a warning for the shared table.',
  };
}

function checkStatusFromValues(jsonValue: unknown, mysqlValue: unknown): FieldCheckStatus {
  return jsonEquals(jsonValue, mysqlValue) ? 'matched' : 'mismatch';
}

function addFieldCheck(
  checks: FieldCheck[],
  fieldName: string,
  jsonValue: unknown,
  mysqlValue: unknown,
  stableKey?: string,
): void {
  const status = checkStatusFromValues(jsonValue, mysqlValue);
  checks.push({
    fieldName,
    stableKey,
    jsonValue,
    mysqlValue,
    status,
    message: status === 'matched' ? `${fieldName} matches.` : `${fieldName} differs.`,
  });
}

function addCustomCheck(input: {
  checks: FieldCheck[];
  fieldName: string;
  jsonValue?: unknown;
  mysqlValue?: unknown;
  stableKey?: string;
  status: FieldCheckStatus;
  message: string;
}): void {
  input.checks.push({
    fieldName: input.fieldName,
    stableKey: input.stableKey,
    jsonValue: input.jsonValue,
    mysqlValue: input.mysqlValue,
    status: input.status,
    message: input.message,
  });
}

function addWarning(input: {
  checks: FieldCheck[];
  warnings: MigrationWarning[];
  fieldName: string;
  message: string;
  stableKey?: string;
  jsonValue?: unknown;
  mysqlValue?: unknown;
  code?: string;
}): void {
  addCustomCheck({
    checks: input.checks,
    fieldName: input.fieldName,
    stableKey: input.stableKey,
    jsonValue: input.jsonValue,
    mysqlValue: input.mysqlValue,
    status: 'warning',
    message: input.message,
  });
  input.warnings.push({
    code: input.code ?? 'compare_missing_field',
    level: 'warning',
    message: input.stableKey ? `${input.stableKey}: ${input.message}` : input.message,
  });
}

function warnIfMissingSourceField(input: {
  checks: FieldCheck[];
  warnings: MigrationWarning[];
  record: Record<string, unknown>;
  names: string[];
  fieldName: string;
  stableKey?: string;
}): void {
  if (firstPresent(input.record, input.names)) {
    return;
  }

  addWarning({
    checks: input.checks,
    warnings: input.warnings,
    fieldName: input.fieldName,
    stableKey: input.stableKey,
    message: `JSON source is missing ${input.fieldName}; compare used the migration fallback where possible.`,
  });
}

function detailStatusFromChecks(
  checks: FieldCheck[],
  jsonCount: number,
  mysqlCount: number,
): DetailCompareStatus {
  if (jsonCount === 0 && mysqlCount === 0) {
    return 'skipped_empty_source';
  }

  if (checks.some((check) => check.status === 'failed')) {
    return 'failed';
  }

  if (checks.some((check) => ['mismatch', 'missing_in_mysql', 'missing_in_json'].includes(check.status))) {
    return 'field_mismatch';
  }

  if (checks.some((check) => check.status === 'warning')) {
    return 'warning';
  }

  return 'matched';
}

function sourceRecords(data: unknown): Record<string, unknown>[] {
  return Array.isArray(data) ? data.filter(isRecord) : [];
}

function sourceAssetKey(record: Record<string, unknown>): string | null {
  return asNullableString(record.assetKey ?? record.asset_key ?? record.id);
}

function sourcePageKey(record: Record<string, unknown>, index: number): string {
  const sourceId = asNullableString(record.sourceId ?? record.source_id ?? record.id);
  const slug = asNullableString(record.slug);
  return sourceId ? `source_id:${sourceId}` : slug ? `slug:${slug}` : `index:${index + 1}`;
}

function sourceSlotNumber(record: Record<string, unknown>, index: number): number {
  return sourceNumber(record, ['slotNo', 'slotNumber', 'slot_number'], index + 1);
}

async function readRows<T extends RowDataPacket[]>(
  sql: string,
  params: SqlParams = {},
): Promise<T> {
  const [rows] = await getDbPool().execute<T>(sql, params);
  return rows;
}

async function readMediaByIdOrUrl(mediaId: number | null, url: string | null): Promise<MediaRow | null> {
  if (mediaId !== null) {
    const rows = await readRows<MediaRow[]>(
      `SELECT id, public_url, file_path, metadata_json
       FROM media_files
       WHERE id = :mediaId
       LIMIT 1`,
      { mediaId },
    );

    if (rows[0]) {
      return rows[0];
    }
  }

  if (!url) {
    return null;
  }

  const rows = await readRows<MediaRow[]>(
    `SELECT id, public_url, file_path, metadata_json
     FROM media_files
     WHERE public_url = :url OR file_path = :url
     LIMIT 1`,
    { url },
  );

  return rows[0] ?? null;
}

async function addMediaChecks(input: {
  checks: FieldCheck[];
  warnings: MigrationWarning[];
  stableKey: string;
  fieldPrefix: string;
  mediaId: number | null;
  url: string | null;
  metadata: Record<string, unknown>;
  missingMediaStatus?: Extract<FieldCheckStatus, 'missing_in_mysql' | 'warning'>;
  homeInteractiveSlotNumber?: number;
}): Promise<void> {
  if (!input.url) {
    addCustomCheck({
      checks: input.checks,
      fieldName: `${input.fieldPrefix}.media_files`,
      stableKey: input.stableKey,
      jsonValue: input.url,
      mysqlValue: null,
      status: 'skipped',
      message: `${input.fieldPrefix} has no URL in JSON, so media_files lookup was skipped.`,
    });
    return;
  }

  const media = await readMediaByIdOrUrl(input.mediaId, input.url);

  if (!media) {
    const missingStatus = input.missingMediaStatus ?? 'warning';
    addCustomCheck({
      checks: input.checks,
      fieldName: `${input.fieldPrefix}.media_files`,
      stableKey: input.stableKey,
      jsonValue: input.url,
      mysqlValue: null,
      status: missingStatus,
      message: `No related media_files row was found for ${input.url}.`,
    });

    if (missingStatus === 'warning') {
      input.warnings.push({
        code: 'compare_media_file_missing',
        level: 'warning',
        message: `${input.stableKey}: No related media_files row was found for ${input.url}.`,
      });
    }

    return;
  }

  const mediaValue = {
    public_url: media.public_url,
    file_path: media.file_path,
  };
  const urlMatches = comparableMediaUrl(input.url, media);

  addCustomCheck({
    checks: input.checks,
    fieldName: `${input.fieldPrefix}.media_files.url`,
    stableKey: input.stableKey,
    jsonValue: input.url,
    mysqlValue: mediaValue,
    status: urlMatches ? 'matched' : 'mismatch',
    message: urlMatches
      ? `${input.fieldPrefix} media_files public_url/file_path contains the JSON URL.`
      : `${input.fieldPrefix} media_files public_url/file_path does not contain the JSON URL.`,
  });

  const metadataJson = parseJsonColumn(media.metadata_json);
  const homeInteractiveMetadata = input.homeInteractiveSlotNumber === undefined
    ? null
    : homeInteractiveMetadataResult(metadataJson, input.homeInteractiveSlotNumber);
  const metadataMatches = homeInteractiveMetadata
    ? homeInteractiveMetadata.status === 'matched'
    : jsonContainsCoreFields(metadataJson, input.metadata);
  const metadataStatus = homeInteractiveMetadata?.status
    ?? (metadataMatches ? 'matched' : 'mismatch');
  const metadataMessage = homeInteractiveMetadata?.message
    ?? (metadataMatches
      ? `${input.fieldPrefix} media_files metadata_json keeps the expected ownership metadata.`
      : `${input.fieldPrefix} media_files metadata_json is missing expected ownership metadata.`);

  addCustomCheck({
    checks: input.checks,
    fieldName: `${input.fieldPrefix}.media_files.metadata_json`,
    stableKey: input.stableKey,
    jsonValue: input.metadata,
    mysqlValue: metadataJson,
    status: metadataStatus,
    message: metadataMessage,
  });

  if (metadataStatus === 'warning') {
    input.warnings.push({
      code: 'compare_media_metadata_ownership_incomplete',
      level: 'warning',
      message: `${input.stableKey}: ${metadataMessage}`,
    });
  }
}

function compareJsonPath(input: {
  checks: FieldCheck[];
  warnings: MigrationWarning[];
  fieldName: string;
  path: string[];
  jsonObject: Record<string, unknown>;
  mysqlObject: unknown;
}): void {
  const jsonPath = getPath(input.jsonObject, input.path);

  if (!jsonPath.exists) {
    addWarning({
      checks: input.checks,
      warnings: input.warnings,
      fieldName: input.fieldName,
      message: `JSON source is missing ${input.fieldName}.`,
    });
    return;
  }

  const mysqlPath = getPath(input.mysqlObject, input.path);

  if (!mysqlPath.exists) {
    addCustomCheck({
      checks: input.checks,
      fieldName: input.fieldName,
      jsonValue: jsonPath.value,
      mysqlValue: undefined,
      status: 'missing_in_mysql',
      message: `MySQL content_json is missing ${input.fieldName}.`,
    });
    return;
  }

  addFieldCheck(input.checks, input.fieldName, jsonPath.value, mysqlPath.value);
}

function socialSearchText(record: Record<string, unknown>): string {
  return [
    record.id,
    record.label,
    record.displayName,
    record.display_name,
    record.value,
  ]
    .map((value) => asString(value).toLowerCase())
    .join(' ');
}

function pickSocials(value: unknown, matcher: (text: string) => boolean): unknown[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isRecord)
    .filter((item) => matcher(socialSearchText(item)))
    .sort((left, right) => socialSearchText(left).localeCompare(socialSearchText(right)));
}

function compareContactSocials(input: {
  checks: FieldCheck[];
  warnings: MigrationWarning[];
  fieldName: string;
  jsonObject: Record<string, unknown>;
  mysqlObject: unknown;
  matcher: (text: string) => boolean;
}): void {
  const jsonSocials = pickSocials(input.jsonObject.socials, input.matcher);
  const mysqlSocials = isRecord(input.mysqlObject)
    ? pickSocials(input.mysqlObject.socials, input.matcher)
    : [];

  if (jsonSocials.length === 0) {
    addWarning({
      checks: input.checks,
      warnings: input.warnings,
      fieldName: input.fieldName,
      message: `JSON source does not include ${input.fieldName}.`,
    });
    return;
  }

  addFieldCheck(input.checks, input.fieldName, jsonSocials, mysqlSocials);
}

async function comparePages(
  jsonSource: JsonSourceSnapshot,
  mysqlTarget: MysqlTargetSnapshot,
): Promise<DetailCompareResult> {
  const checks: FieldCheck[] = [];
  const warnings: MigrationWarning[] = [];
  const sourcePages = sourceRecords(jsonSource.data);
  const rows = await readRows<PageRow[]>(
    `SELECT id, source_id, title, slug, summary, status, sort_order, is_system_page
     FROM pages
     ORDER BY sort_order, id`,
  );

  if (jsonSource.sourceCount === 0 && mysqlTarget.rowCount === 0) {
    addCustomCheck({
      checks,
      fieldName: 'pages.empty_source',
      jsonValue: jsonSource.sourceCount,
      mysqlValue: mysqlTarget.rowCount,
      status: 'skipped',
      message: 'pages.json is empty and the MySQL pages table is empty.',
    });
    return {
      detailStatus: 'skipped_empty_source',
      fieldChecks: checks,
      warnings,
      errors: [],
    };
  }

  if (jsonSource.sourceCount === 0 && mysqlTarget.rowCount > 0) {
    for (const row of rows) {
      addCustomCheck({
        checks,
        fieldName: 'pages.record',
        stableKey: row.source_id ? `source_id:${row.source_id}` : `slug:${row.slug}`,
        jsonValue: null,
        mysqlValue: {
          source_id: row.source_id,
          slug: row.slug,
          title: row.title,
        },
        status: 'missing_in_json',
        message: 'MySQL pages has a record while pages.json is empty.',
      });
    }

    return {
      detailStatus: detailStatusFromChecks(checks, jsonSource.sourceCount, mysqlTarget.rowCount),
      fieldChecks: checks,
      warnings,
      errors: [],
    };
  }

  const usedRowIds = new Set<number>();

  for (const [index, page] of sourcePages.entries()) {
    const stableKey = sourcePageKey(page, index);
    const sourceId = asNullableString(page.sourceId ?? page.source_id ?? page.id);
    const slug = asNullableString(page.slug);
    const row = rows.find((candidate) => {
      if (usedRowIds.has(candidate.id)) {
        return false;
      }

      return sourceId ? candidate.source_id === sourceId || candidate.slug === slug : candidate.slug === slug;
    });

    warnIfMissingSourceField({ checks, warnings, record: page, names: ['title'], fieldName: 'title', stableKey });
    warnIfMissingSourceField({ checks, warnings, record: page, names: ['slug'], fieldName: 'slug', stableKey });

    if (!row) {
      addCustomCheck({
        checks,
        fieldName: 'pages.record',
        stableKey,
        jsonValue: page,
        mysqlValue: null,
        status: 'missing_in_mysql',
        message: 'JSON page record is missing in MySQL pages.',
      });
      continue;
    }

    usedRowIds.add(row.id);
    addFieldCheck(checks, 'source_id', sourceId, row.source_id, stableKey);
    addFieldCheck(checks, 'title', asString(page.title).trim(), row.title, stableKey);
    addFieldCheck(checks, 'slug', slug, row.slug, stableKey);
    addFieldCheck(checks, 'summary', asNullableString(page.summary), row.summary, stableKey);
    addFieldCheck(checks, 'status', asString(page.status, 'draft'), row.status, stableKey);
    addFieldCheck(checks, 'sort_order', sourceNumber(page, ['sortOrder', 'sort_order'], 0), asNumber(row.sort_order), stableKey);
    addFieldCheck(
      checks,
      'is_system_page',
      asBooleanSemantic(page.isSystemPage ?? page.is_system_page, false),
      asBooleanSemantic(row.is_system_page, false),
      stableKey,
    );
  }

  for (const row of rows.filter((candidate) => !usedRowIds.has(candidate.id))) {
    addCustomCheck({
      checks,
      fieldName: 'pages.record',
      stableKey: row.source_id ? `source_id:${row.source_id}` : `slug:${row.slug}`,
      jsonValue: null,
      mysqlValue: {
        source_id: row.source_id,
        slug: row.slug,
        title: row.title,
      },
      status: 'missing_in_json',
      message: 'MySQL pages record is missing in pages.json.',
    });
  }

  return {
    detailStatus: detailStatusFromChecks(checks, jsonSource.sourceCount, mysqlTarget.rowCount),
    fieldChecks: checks,
    warnings,
    errors: [],
  };
}

async function compareContactInfo(
  jsonSource: JsonSourceSnapshot,
  mysqlTarget: MysqlTargetSnapshot,
): Promise<DetailCompareResult> {
  const checks: FieldCheck[] = [];
  const warnings: MigrationWarning[] = [];
  const sourceData = isRecord(jsonSource.data) ? jsonSource.data : {};
  const rows = await readRows<ContactInfoRow[]>(
    `SELECT singleton_key, content_json, is_enabled
     FROM contact_info
     ORDER BY id`,
  );
  const row = rows[0];

  if (!row) {
    addCustomCheck({
      checks,
      fieldName: 'contact_info.record',
      stableKey: 'singleton:contact_info',
      jsonValue: sourceData,
      mysqlValue: null,
      status: 'missing_in_mysql',
      message: 'JSON contact-info singleton is missing in MySQL contact_info.',
    });

    return {
      detailStatus: detailStatusFromChecks(checks, jsonSource.sourceCount, mysqlTarget.rowCount),
      fieldChecks: checks,
      warnings,
      errors: [],
    };
  }

  const contentJson = parseJsonColumn(row.content_json);
  const enabled = sourceEnabled(sourceData, true);

  addFieldCheck(checks, 'singleton_key', 'contact_info', row.singleton_key, 'singleton:contact_info');
  addFieldCheck(checks, 'content_json', sourceData, contentJson, 'singleton:contact_info');
  addFieldCheck(
    checks,
    'is_enabled',
    enabled.value,
    asBooleanSemantic(row.is_enabled, true),
    'singleton:contact_info',
  );

  if (enabled.missing) {
    addWarning({
      checks,
      warnings,
      fieldName: 'enabled/is_enabled/status',
      stableKey: 'singleton:contact_info',
      message: 'JSON contact-info source has no top-level enabled/is_enabled/status; MySQL is_enabled was compared with fallback true.',
    });
  }

  for (const path of ['companyName', 'brandName', 'address', 'email', 'phone', 'socials']) {
    compareJsonPath({
      checks,
      warnings,
      fieldName: `content_json.${path}`,
      path: [path],
      jsonObject: sourceData,
      mysqlObject: contentJson,
    });
  }

  compareJsonPath({
    checks,
    warnings,
    fieldName: 'content_json.address.value',
    path: ['address', 'value'],
    jsonObject: sourceData,
    mysqlObject: contentJson,
  });
  compareJsonPath({
    checks,
    warnings,
    fieldName: 'content_json.email.value',
    path: ['email', 'value'],
    jsonObject: sourceData,
    mysqlObject: contentJson,
  });
  compareJsonPath({
    checks,
    warnings,
    fieldName: 'content_json.phone.value',
    path: ['phone', 'value'],
    jsonObject: sourceData,
    mysqlObject: contentJson,
  });
  compareContactSocials({
    checks,
    warnings,
    fieldName: 'content_json.socials.wechat',
    jsonObject: sourceData,
    mysqlObject: contentJson,
    matcher: (text) => text.includes('wechat'),
  });
  compareContactSocials({
    checks,
    warnings,
    fieldName: 'content_json.socials.xiaohongshu',
    jsonObject: sourceData,
    mysqlObject: contentJson,
    matcher: (text) => text.includes('xiaohongshu') || text.includes('xhs'),
  });

  return {
    detailStatus: detailStatusFromChecks(checks, jsonSource.sourceCount, mysqlTarget.rowCount),
    fieldChecks: checks,
    warnings,
    errors: [],
  };
}

async function compareCompanyAssets(
  jsonSource: JsonSourceSnapshot,
  mysqlTarget: MysqlTargetSnapshot,
): Promise<DetailCompareResult> {
  const checks: FieldCheck[] = [];
  const warnings: MigrationWarning[] = [];
  const assets = sourceRecords(jsonSource.data);
  const rows = await readRows<CompanyAssetRow[]>(
    `SELECT asset_key, media_id, media_url, alt_text, description, sort_order, is_enabled, raw_json
     FROM company_assets
     ORDER BY sort_order, asset_key`,
  );
  const rowMap = new Map(rows.map((row) => [row.asset_key, row]));
  const seenKeys = new Set<string>();

  for (const [index, asset] of assets.entries()) {
    const assetKey = sourceAssetKey(asset);
    const stableKey = assetKey ? `asset_key:${assetKey}` : `index:${index + 1}`;

    warnIfMissingSourceField({ checks, warnings, record: asset, names: ['assetKey', 'asset_key', 'id'], fieldName: 'asset_key', stableKey });
    warnIfMissingSourceField({ checks, warnings, record: asset, names: ['mediaUrl', 'media_url', 'imageUrl', 'image_url'], fieldName: 'media_url', stableKey });
    warnIfMissingSourceField({ checks, warnings, record: asset, names: ['altText', 'imageAlt'], fieldName: 'alt_text', stableKey });
    warnIfMissingSourceField({ checks, warnings, record: asset, names: ['description', 'summary'], fieldName: 'description', stableKey });
    warnIfMissingSourceField({ checks, warnings, record: asset, names: ['sortOrder', 'sort_order'], fieldName: 'sort_order', stableKey });
    warnIfMissingSourceField({ checks, warnings, record: asset, names: ['enabled', 'is_enabled', 'isEnabled', 'status'], fieldName: 'is_enabled', stableKey });

    if (!assetKey) {
      continue;
    }

    const row = rowMap.get(assetKey);

    if (!row) {
      addCustomCheck({
        checks,
        fieldName: 'company_assets.record',
        stableKey,
        jsonValue: asset,
        mysqlValue: null,
        status: 'missing_in_mysql',
        message: 'JSON company asset is missing in MySQL company_assets.',
      });
      continue;
    }

    seenKeys.add(assetKey);
    const enabled = sourceEnabled(asset, true);
    const rawJson = parseJsonColumn(row.raw_json);
    const rawJsonMatches = jsonContainsCoreFields(rawJson, asset);

    addFieldCheck(checks, 'asset_key', assetKey, row.asset_key, stableKey);
    addFieldCheck(checks, 'media_url', sourceNullableString(asset, ['mediaUrl', 'media_url', 'imageUrl', 'image_url']), row.media_url, stableKey);
    addFieldCheck(checks, 'alt_text', sourceNullableString(asset, ['altText', 'imageAlt']), row.alt_text, stableKey);
    addFieldCheck(checks, 'description', sourceNullableString(asset, ['description', 'summary']), row.description, stableKey);
    addFieldCheck(checks, 'sort_order', sourceNumber(asset, ['sortOrder', 'sort_order'], 0), asNumber(row.sort_order), stableKey);
    addFieldCheck(checks, 'is_enabled', enabled.value, asBooleanSemantic(row.is_enabled, true), stableKey);
    addCustomCheck({
      checks,
      fieldName: 'raw_json',
      stableKey,
      jsonValue: asset,
      mysqlValue: rawJson,
      status: rawJsonMatches ? 'matched' : 'mismatch',
      message: rawJsonMatches
        ? 'raw_json preserves the JSON source object core fields.'
        : 'raw_json is missing one or more JSON source object core fields.',
    });
  }

  for (const row of rows.filter((item) => !seenKeys.has(item.asset_key))) {
    addCustomCheck({
      checks,
      fieldName: 'company_assets.record',
      stableKey: `asset_key:${row.asset_key}`,
      jsonValue: null,
      mysqlValue: {
        asset_key: row.asset_key,
        media_url: row.media_url,
        sort_order: row.sort_order,
      },
      status: 'missing_in_json',
      message: 'MySQL company_assets record is missing in company-assets.json.',
    });
  }

  return {
    detailStatus: detailStatusFromChecks(checks, jsonSource.sourceCount, mysqlTarget.rowCount),
    fieldChecks: checks,
    warnings,
    errors: [],
  };
}

async function compareHomeVideo(
  jsonSource: JsonSourceSnapshot,
  mysqlTarget: MysqlTargetSnapshot,
): Promise<DetailCompareResult> {
  const checks: FieldCheck[] = [];
  const warnings: MigrationWarning[] = [];
  const sourceData = isRecord(jsonSource.data) ? jsonSource.data : {};
  const rows = await readRows<HomeVideoRow[]>(
    `SELECT singleton_key, video_media_id, poster_media_id, video_url, poster_url, title, description, is_enabled
     FROM home_video
     ORDER BY id`,
  );
  const row = rows[0];
  const stableKey = 'singleton:home_video';

  if (!row) {
    addCustomCheck({
      checks,
      fieldName: 'home_video.record',
      stableKey,
      jsonValue: sourceData,
      mysqlValue: null,
      status: 'missing_in_mysql',
      message: 'JSON home-video singleton is missing in MySQL home_video.',
    });

    return {
      detailStatus: detailStatusFromChecks(checks, jsonSource.sourceCount, mysqlTarget.rowCount),
      fieldChecks: checks,
      warnings,
      errors: [],
    };
  }

  warnIfMissingSourceField({ checks, warnings, record: sourceData, names: ['videoUrl', 'video_url'], fieldName: 'video_url', stableKey });
  warnIfMissingSourceField({ checks, warnings, record: sourceData, names: ['posterUrl', 'poster_url'], fieldName: 'poster_url', stableKey });
  warnIfMissingSourceField({ checks, warnings, record: sourceData, names: ['title'], fieldName: 'title', stableKey });
  warnIfMissingSourceField({ checks, warnings, record: sourceData, names: ['description'], fieldName: 'description', stableKey });
  warnIfMissingSourceField({ checks, warnings, record: sourceData, names: ['enabled', 'is_enabled', 'isEnabled', 'status'], fieldName: 'is_enabled', stableKey });

  const videoUrl = sourceNullableString(sourceData, ['videoUrl', 'video_url']);
  const posterUrl = sourceNullableString(sourceData, ['posterUrl', 'poster_url']);
  const enabled = sourceEnabled(sourceData, true);

  addFieldCheck(checks, 'singleton_key', 'home_video', row.singleton_key, stableKey);
  addFieldCheck(checks, 'video_url', videoUrl, row.video_url, stableKey);
  addFieldCheck(checks, 'poster_url', posterUrl, row.poster_url, stableKey);
  addFieldCheck(checks, 'title', asNullableString(sourceData.title), row.title, stableKey);
  addFieldCheck(checks, 'description', asNullableString(sourceData.description), row.description, stableKey);
  addFieldCheck(checks, 'is_enabled', enabled.value, asBooleanSemantic(row.is_enabled, true), stableKey);

  await addMediaChecks({
    checks,
    warnings,
    stableKey,
    fieldPrefix: 'video_url',
    mediaId: asNullableNumber(row.video_media_id),
    url: videoUrl,
    metadata: { moduleName: 'home-video', mediaRole: 'video' },
  });
  await addMediaChecks({
    checks,
    warnings,
    stableKey,
    fieldPrefix: 'poster_url',
    mediaId: asNullableNumber(row.poster_media_id),
    url: posterUrl,
    metadata: { moduleName: 'home-video', mediaRole: 'poster' },
  });

  return {
    detailStatus: detailStatusFromChecks(checks, jsonSource.sourceCount, mysqlTarget.rowCount),
    fieldChecks: checks,
    warnings,
    errors: [],
  };
}

async function compareHomeInteractiveImages(
  jsonSource: JsonSourceSnapshot,
  mysqlTarget: MysqlTargetSnapshot,
): Promise<DetailCompareResult> {
  const checks: FieldCheck[] = [];
  const warnings: MigrationWarning[] = [];
  const images = sourceRecords(jsonSource.data);
  const rows = await readRows<HomeInteractiveImageRow[]>(
    `SELECT slot_number, media_id, image_url, alt_text, sort_order, is_enabled
     FROM home_interactive_images
     ORDER BY slot_number`,
  );
  const rowMap = new Map(rows.map((row) => [asNumber(row.slot_number), row]));
  const seenSlots = new Set<number>();

  for (const [index, image] of images.entries()) {
    const slotNumber = sourceSlotNumber(image, index);
    const stableKey = `slot:${slotNumber}`;

    warnIfMissingSourceField({ checks, warnings, record: image, names: ['slotNo', 'slotNumber', 'slot_number'], fieldName: 'slot_number', stableKey });
    warnIfMissingSourceField({ checks, warnings, record: image, names: ['mediaUrl', 'imageUrl', 'image_url'], fieldName: 'image_url', stableKey });
    warnIfMissingSourceField({ checks, warnings, record: image, names: ['alt', 'altText'], fieldName: 'alt_text', stableKey });
    warnIfMissingSourceField({ checks, warnings, record: image, names: ['sortOrder', 'sort_order'], fieldName: 'sort_order', stableKey });
    warnIfMissingSourceField({ checks, warnings, record: image, names: ['enabled', 'is_enabled', 'isEnabled', 'status'], fieldName: 'is_enabled', stableKey });

    const row = rowMap.get(slotNumber);

    if (!row) {
      addCustomCheck({
        checks,
        fieldName: 'home_interactive_images.record',
        stableKey,
        jsonValue: image,
        mysqlValue: null,
        status: 'missing_in_mysql',
        message: 'JSON home interactive image slot is missing in MySQL home_interactive_images.',
      });
      continue;
    }

    seenSlots.add(slotNumber);
    const imageUrl = sourceNullableString(image, ['mediaUrl', 'imageUrl', 'image_url']);
    const enabled = sourceEnabled(image, true);

    addFieldCheck(checks, 'slot_number', slotNumber, asNumber(row.slot_number), stableKey);
    addFieldCheck(checks, 'image_url', imageUrl, row.image_url, stableKey);
    addFieldCheck(checks, 'alt_text', sourceNullableString(image, ['alt', 'altText']), row.alt_text, stableKey);
    addFieldCheck(checks, 'sort_order', sourceNumber(image, ['sortOrder', 'sort_order'], slotNumber), asNumber(row.sort_order), stableKey);
    addFieldCheck(checks, 'is_enabled', enabled.value, asBooleanSemantic(row.is_enabled, true), stableKey);

    await addMediaChecks({
      checks,
      warnings,
      stableKey,
      fieldPrefix: 'image_url',
      mediaId: asNullableNumber(row.media_id),
      url: imageUrl,
      metadata: { moduleName: 'home-interactive-images', slotNumber },
      missingMediaStatus: 'missing_in_mysql',
      homeInteractiveSlotNumber: slotNumber,
    });
  }

  for (const row of rows.filter((item) => !seenSlots.has(asNumber(item.slot_number)))) {
    const slotNumber = asNumber(row.slot_number);
    addCustomCheck({
      checks,
      fieldName: 'home_interactive_images.record',
      stableKey: `slot:${slotNumber}`,
      jsonValue: null,
      mysqlValue: {
        slot_number: slotNumber,
        image_url: row.image_url,
        sort_order: row.sort_order,
      },
      status: 'missing_in_json',
      message: 'MySQL home_interactive_images record is missing in home-interactive-images.json.',
    });
  }

  return {
    detailStatus: detailStatusFromChecks(checks, jsonSource.sourceCount, mysqlTarget.rowCount),
    fieldChecks: checks,
    warnings,
    errors: [],
  };
}

export async function runDetailCompare(input: {
  moduleName: MigrationModuleName;
  jsonSource: JsonSourceSnapshot;
  mysqlTarget: MysqlTargetSnapshot;
}): Promise<DetailCompareResult> {
  if (!isDetailedCompareModule(input.moduleName)) {
    return {
      fieldChecks: [],
      warnings: [],
      errors: [],
    };
  }

  switch (input.moduleName) {
    case 'pages':
      return comparePages(input.jsonSource, input.mysqlTarget);
    case 'contact-info':
      return compareContactInfo(input.jsonSource, input.mysqlTarget);
    case 'company-assets':
      return compareCompanyAssets(input.jsonSource, input.mysqlTarget);
    case 'home-video':
      return compareHomeVideo(input.jsonSource, input.mysqlTarget);
    case 'home-interactive-images':
      return compareHomeInteractiveImages(input.jsonSource, input.mysqlTarget);
    default:
      return {
        fieldChecks: [],
        warnings: [],
        errors: [],
      };
  }
}
