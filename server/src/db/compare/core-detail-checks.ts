import { readFile } from 'node:fs/promises';
import path from 'node:path';
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

const coreDetailModuleNames = [
  'articles',
  'media-library',
  'cases',
  'solutions',
  'publish-logs',
] as const satisfies MigrationModuleName[];

type CoreDetailModuleName = (typeof coreDetailModuleNames)[number];

type DetailCompareResult = {
  detailStatus?: DetailCompareStatus;
  fieldChecks: FieldCheck[];
  warnings: MigrationWarning[];
  errors: MigrationWarning[];
};

type SqlValue = string | number | boolean | Date | null | SqlValue[] | { [key: string]: SqlValue };
type SqlParams = { [key: string]: SqlValue };

type MediaStableKey =
  | {
      type: 'public_url';
      value: string;
    }
  | {
      type: 'file_path';
      value: string;
    }
  | {
      type: 'file_name_size';
      value: string;
      fileName: string;
      fileSize: number;
    };

type PreparedMediaFile = {
  sourceKey: string;
  sourceRecord: Record<string, unknown>;
  fileName: string | null;
  originalName: string | null;
  displayName: string | null;
  publicUrl: string | null;
  sourceFilePath: string | null;
  filePathForWrite: string | null;
  publicUrlForWrite: string | null;
  mimeType: string | null;
  fileExt: string | null;
  fileSize: number;
  category: string;
  altText: string | null;
  description: string | null;
  status: string;
  stableKey: MediaStableKey | null;
};

type ArticleRow = RowDataPacket & {
  id: number;
  source_id: string | null;
  category_slug: string | null;
  title: string;
  slug: string;
  summary: string | null;
  content: string | null;
  cover_url: string | null;
  tags_json: unknown;
  status: string;
  sort_order: number | string;
  is_home_featured: number | boolean | string;
  published_at: Date | string | null;
};

type ArticleCategoryRow = RowDataPacket & {
  slug: string;
  name: string;
  sort_order: number | string;
  status: string;
};

type SeoRow = RowDataPacket & {
  owner_type: string;
  owner_source_id: string | null;
  owner_id: number | string | null;
  title: string | null;
  description: string | null;
  keywords: string | null;
  published_at: Date | string | null;
};

type FaqRow = RowDataPacket & {
  owner_type: string;
  owner_source_id: string | null;
  owner_id: number | string | null;
  question: string;
  answer: string;
  sort_order: number | string;
  status: string;
};

type MediaRow = RowDataPacket & {
  id: number;
  file_name: string | null;
  original_name: string | null;
  file_path: string | null;
  public_url: string | null;
  mime_type: string | null;
  file_ext: string | null;
  file_size: number | string;
  category: string | null;
  alt_text: string | null;
  description: string | null;
  metadata_json: unknown;
  status: string | null;
};

type CaseRow = RowDataPacket & {
  id: number;
  source_id: string | null;
  title: string;
  slug: string;
  summary: string | null;
  client_type: string | null;
  event_type: string | null;
  event_date: string | null;
  location: string | null;
  cover_media_id: number | string | null;
  cover_url: string | null;
  cover_file_name: string | null;
  cover_display_name: string | null;
  word_file_name: string | null;
  word_original_name: string | null;
  raw_json: unknown;
  status: string;
  sort_order: number | string;
  is_home_featured: number | boolean | string;
  published_at: Date | string | null;
};

type CaseImageRow = RowDataPacket & {
  id: number;
  case_id: number | string;
  media_id: number | string | null;
  image_url: string | null;
  alt_text: string | null;
  caption: string | null;
  sort_order: number | string;
  is_enabled: number | boolean | string;
};

type SolutionRow = RowDataPacket & {
  id: number;
  source_id: string | null;
  title: string;
  slug: string;
  summary: string | null;
  cover_media_id: number | string | null;
  cover_url: string | null;
  raw_json: unknown;
  status: string;
  sort_order: number | string;
  published_at: Date | string | null;
};

type SolutionGroupRow = RowDataPacket & {
  id: number;
  solution_id: number | string;
  source_id: string | null;
  title: string;
  slug: string;
  summary: string | null;
  scene_slug: string | null;
  sort_order: number | string;
  is_enabled: number | boolean | string;
};

type SolutionMediaItemRow = RowDataPacket & {
  id: number;
  group_id: number | string;
  source_id: string | null;
  media_id: number | string | null;
  file_type: string;
  media_url: string;
  media_file_name: string | null;
  media_display_name: string | null;
  alt_text: string | null;
  caption: string | null;
  sort_order: number | string;
  is_enabled: number | boolean | string;
};

type PublishLogRow = RowDataPacket & {
  publish_version: string;
  publish_type: string;
  target_type: string | null;
  target_id: number | string | null;
  status: string;
  release_dir: string | null;
  previous_version: string | null;
  rollback_to_version: string | null;
  summary: string | null;
  error_message: string | null;
  source_stats_json: unknown;
  failed_routes_json: unknown;
  routes_json: unknown;
  raw_log_json: unknown;
  started_at: Date | string | null;
  finished_at: Date | string | null;
};

type PublishLogManifestEntry = {
  fileName: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isCoreDetailCompareModule(moduleName: MigrationModuleName): moduleName is CoreDetailModuleName {
  return coreDetailModuleNames.includes(moduleName as CoreDetailModuleName);
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

function asOptionalUnsignedInteger(value: unknown): number | null {
  const numberValue = asNullableNumber(value);

  if (numberValue === null || numberValue < 0) {
    return null;
  }

  return Math.trunc(numberValue);
}

function asBoolean(value: unknown, fallback = true): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asBooleanSemantic(value: unknown, fallback = true): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (['1', 'true', 'yes', 'active', 'enabled', 'published', 'visible'].includes(normalized)) {
      return true;
    }

    if (['0', 'false', 'no', 'inactive', 'disabled', 'draft', 'hidden', 'archived'].includes(normalized)) {
      return false;
    }
  }

  return fallback;
}

function firstString(record: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = asNullableString(record[key]);

    if (value) {
      return value;
    }
  }

  return null;
}

function sourceNullableString(record: Record<string, unknown>, names: string[]): string | null {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(record, name)) {
      return asNullableString(record[name]);
    }
  }

  return null;
}

function sourceNumber(record: Record<string, unknown>, names: string[], fallback = 0): number {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(record, name)) {
      return asNumber(record[name], fallback);
    }
  }

  return fallback;
}

function normalizeFileName(publicUrl: string | null, fallback: string | null): string | null {
  if (fallback) {
    return fallback;
  }

  if (!publicUrl) {
    return null;
  }

  const parts = publicUrl.split('/').filter(Boolean);
  return parts.at(-1) ?? null;
}

function extFromFileName(fileName: string): string | null {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex >= 0 ? fileName.slice(dotIndex + 1).toLowerCase() : null;
}

function mimeFromFileName(fileName: string): string | null {
  const ext = extFromFileName(fileName);

  if (!ext) {
    return null;
  }

  if (['jpg', 'jpeg'].includes(ext)) {
    return 'image/jpeg';
  }

  if (ext === 'png') {
    return 'image/png';
  }

  if (ext === 'webp') {
    return 'image/webp';
  }

  if (ext === 'mp4') {
    return 'video/mp4';
  }

  return null;
}

function normalizeMediaPath(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/\\/g, '/');

  if (!normalized) {
    return null;
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(normalized) || normalized.startsWith('/')) {
    return normalized;
  }

  return normalized.startsWith('uploads/') ? `/${normalized}` : normalized;
}

function normalizeMediaCategory(category: string | null): string {
  const fallback = 'general';
  const normalized = category ?? fallback;
  return normalized.length > 80 ? normalized.slice(0, 80) : normalized;
}

function sourceRecords(data: unknown): Record<string, unknown>[] {
  return Array.isArray(data) ? data.filter(isRecord) : [];
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

function jsonArrayValue(value: unknown): unknown[] | null {
  const parsed = parseJsonColumn(value);
  return Array.isArray(parsed) ? parsed : null;
}

function dateValue(value: unknown): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
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

function addDateFieldCheck(
  checks: FieldCheck[],
  fieldName: string,
  jsonValue: unknown,
  mysqlValue: unknown,
  stableKey?: string,
): void {
  addFieldCheck(checks, fieldName, dateValue(jsonValue), dateValue(mysqlValue), stableKey);
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
  if (input.names.some((name) => Object.prototype.hasOwnProperty.call(input.record, name))) {
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

async function readRows<T extends RowDataPacket[]>(
  sql: string,
  params: SqlParams = {},
): Promise<T> {
  const [rows] = await getDbPool().execute<T>(sql, params);
  return rows;
}

function ownerSourceId(sourceId: string | null, slug: string): string {
  return sourceId ?? slug;
}

function findSeoRow(rows: SeoRow[], ownerId: number, ownerSourceIdValue: string): SeoRow | null {
  return rows.find((row) => asNumber(row.owner_id, -1) === ownerId || row.owner_source_id === ownerSourceIdValue) ?? null;
}

function faqRowsForOwner(rows: FaqRow[], ownerId: number, ownerSourceIdValue: string): FaqRow[] {
  return rows
    .filter((row) => asNumber(row.owner_id, -1) === ownerId || row.owner_source_id === ownerSourceIdValue)
    .sort((left, right) => asNumber(left.sort_order) - asNumber(right.sort_order));
}

function sourceFaqItems(record: Record<string, unknown>): Record<string, unknown>[] {
  const rawFaqItems = record.faqItems ?? record.faq_items;
  return Array.isArray(rawFaqItems) ? rawFaqItems.filter(isRecord) : [];
}

function keywordsValue(record: Record<string, unknown>): string | null {
  const rawKeywords = record.keywords ?? record.seoKeywords ?? record.seo_keywords;

  if (Array.isArray(rawKeywords)) {
    const keywords = rawKeywords
      .map((keyword) => asNullableString(keyword))
      .filter((keyword): keyword is string => Boolean(keyword));

    return keywords.length > 0 ? keywords.join(',') : null;
  }

  return asNullableString(rawKeywords);
}

function addSeoChecks(input: {
  checks: FieldCheck[];
  warnings: MigrationWarning[];
  ownerType: string;
  stableKey: string;
  sourceRecord: Record<string, unknown>;
  seoRow: SeoRow | null;
  publishedAt: unknown;
}): void {
  const seoTitle = asNullableString(input.sourceRecord.seoTitle ?? input.sourceRecord.seo_title);
  const seoDescription = asNullableString(input.sourceRecord.seoDescription ?? input.sourceRecord.seo_description);
  const keywords = keywordsValue(input.sourceRecord);
  const hasSourceSeo = Boolean(seoTitle || seoDescription || keywords);

  if (!hasSourceSeo) {
    if (input.seoRow) {
      addCustomCheck({
        checks: input.checks,
        fieldName: `${input.ownerType}.seo_settings`,
        stableKey: input.stableKey,
        jsonValue: null,
        mysqlValue: {
          title: input.seoRow.title,
          description: input.seoRow.description,
          keywords: input.seoRow.keywords,
        },
        status: 'missing_in_json',
        message: 'MySQL SEO row exists while the JSON source has no SEO fields.',
      });
    } else {
      addCustomCheck({
        checks: input.checks,
        fieldName: `${input.ownerType}.seo_settings`,
        stableKey: input.stableKey,
        jsonValue: null,
        mysqlValue: null,
        status: 'skipped',
        message: 'JSON source has no SEO fields; zero MySQL SEO rows is normal.',
      });
    }
    return;
  }

  if (!input.seoRow) {
    addCustomCheck({
      checks: input.checks,
      fieldName: `${input.ownerType}.seo_settings`,
      stableKey: input.stableKey,
      jsonValue: { title: seoTitle, description: seoDescription, keywords },
      mysqlValue: null,
      status: 'missing_in_mysql',
      message: 'JSON source has SEO fields but no matching MySQL seo_settings row.',
    });
    return;
  }

  addFieldCheck(input.checks, `${input.ownerType}.seo.title`, seoTitle, input.seoRow.title, input.stableKey);
  addFieldCheck(input.checks, `${input.ownerType}.seo.description`, seoDescription, input.seoRow.description, input.stableKey);
  addFieldCheck(input.checks, `${input.ownerType}.seo.keywords`, keywords, input.seoRow.keywords, input.stableKey);
  addDateFieldCheck(input.checks, `${input.ownerType}.seo.published_at`, input.publishedAt, input.seoRow.published_at, input.stableKey);
}

function addFaqChecks(input: {
  checks: FieldCheck[];
  warnings: MigrationWarning[];
  ownerType: string;
  stableKey: string;
  sourceRecord: Record<string, unknown>;
  faqRows: FaqRow[];
}): void {
  const faqItems = sourceFaqItems(input.sourceRecord);

  if (faqItems.length === 0) {
    addCustomCheck({
      checks: input.checks,
      fieldName: `${input.ownerType}.faq_items`,
      stableKey: input.stableKey,
      jsonValue: 0,
      mysqlValue: input.faqRows.length,
      status: input.faqRows.length === 0 ? 'skipped' : 'missing_in_json',
      message: input.faqRows.length === 0
        ? 'JSON source has no FAQ items; zero MySQL FAQ rows is normal.'
        : 'MySQL FAQ rows exist while the JSON source has no FAQ items.',
    });
    return;
  }

  addFieldCheck(input.checks, `${input.ownerType}.faq_items.count`, faqItems.length, input.faqRows.length, input.stableKey);

  for (const [index, faqItem] of faqItems.entries()) {
    const sortOrder = sourceNumber(faqItem, ['sortOrder', 'sort_order'], index + 1);
    const question = asNullableString(faqItem.question ?? faqItem.q);
    const row = input.faqRows.find((candidate) => asNumber(candidate.sort_order) === sortOrder && candidate.question === question);
    const faqKey = `${input.stableKey}:faq:${sortOrder}`;

    if (!question || !asNullableString(faqItem.answer ?? faqItem.a)) {
      addWarning({
        checks: input.checks,
        warnings: input.warnings,
        fieldName: `${input.ownerType}.faq_items`,
        stableKey: faqKey,
        message: 'JSON FAQ item is missing question or answer; migration skips invalid FAQ rows.',
      });
      continue;
    }

    if (!row) {
      addCustomCheck({
        checks: input.checks,
        fieldName: `${input.ownerType}.faq_items.record`,
        stableKey: faqKey,
        jsonValue: faqItem,
        mysqlValue: null,
        status: 'missing_in_mysql',
        message: 'JSON FAQ item is missing in MySQL faq_items.',
      });
      continue;
    }

    addFieldCheck(input.checks, `${input.ownerType}.faq.question`, question, row.question, faqKey);
    addFieldCheck(input.checks, `${input.ownerType}.faq.answer`, asNullableString(faqItem.answer ?? faqItem.a), row.answer, faqKey);
    addFieldCheck(input.checks, `${input.ownerType}.faq.sort_order`, sortOrder, asNumber(row.sort_order), faqKey);
    addFieldCheck(input.checks, `${input.ownerType}.faq.status`, asString(faqItem.status, 'active'), row.status, faqKey);
  }
}

function buildMediaStableKey(input: {
  publicUrl: string | null;
  filePath: string | null;
  fileName: string | null;
  fileSize: number;
}): MediaStableKey | null {
  if (input.publicUrl) {
    return {
      type: 'public_url',
      value: input.publicUrl,
    };
  }

  if (input.filePath) {
    return {
      type: 'file_path',
      value: input.filePath,
    };
  }

  if (input.fileName && input.fileSize >= 0) {
    return {
      type: 'file_name_size',
      value: `${input.fileName}#${input.fileSize}`,
      fileName: input.fileName,
      fileSize: input.fileSize,
    };
  }

  return null;
}

function stableKeyLabel(stableKey: MediaStableKey): string {
  return `${stableKey.type}:${stableKey.value}`;
}

function mediaRowStableKeys(row: MediaRow): string[] {
  const keys = [];
  const publicUrl = asNullableString(row.public_url);
  const filePath = asNullableString(row.file_path);
  const fileName = asNullableString(row.file_name);
  const fileSize = asNumber(row.file_size, -1);

  if (publicUrl) {
    keys.push(`public_url:${publicUrl}`);
  }

  if (filePath) {
    keys.push(`file_path:${filePath}`);
  }

  if (fileName && fileSize >= 0) {
    keys.push(`file_name_size:${fileName}#${fileSize}`);
  }

  return keys;
}

function mediaLibraryEntries(data: unknown): Array<{ sourceKey: string; record: Record<string, unknown> }> {
  if (Array.isArray(data)) {
    return data
      .map((item, index) => {
        if (!isRecord(item)) {
          return null;
        }

        return {
          sourceKey: firstString(item, 'sourceKey', 'source_key', 'key', 'id', 'fileName', 'file_name') ?? `index-${index + 1}`,
          record: item,
        };
      })
      .filter((entry): entry is { sourceKey: string; record: Record<string, unknown> } => Boolean(entry));
  }

  if (!isRecord(data)) {
    return [];
  }

  return Object.entries(data)
    .map(([sourceKey, item]) => {
      if (!isRecord(item)) {
        return null;
      }

      return { sourceKey, record: item };
    })
    .filter((entry): entry is { sourceKey: string; record: Record<string, unknown> } => Boolean(entry));
}

function prepareMediaLibraryFile(entry: { sourceKey: string; record: Record<string, unknown> }): PreparedMediaFile {
  const publicUrl = normalizeMediaPath(firstString(entry.record, 'publicUrl', 'public_url', 'url'));
  const sourceFilePath = normalizeMediaPath(firstString(entry.record, 'filePath', 'file_path', 'path'));
  const fileName = firstString(entry.record, 'fileName', 'file_name', 'storageFileName', 'storage_file_name', 'name')
    ?? normalizeFileName(publicUrl, null)
    ?? entry.sourceKey;
  const originalName = firstString(entry.record, 'originalName', 'original_name');
  const displayName = firstString(entry.record, 'displayName', 'display_name', 'title');
  const fileSize = asOptionalUnsignedInteger(entry.record.fileSize ?? entry.record.file_size ?? entry.record.size) ?? 0;
  const fileExt = firstString(entry.record, 'fileExt', 'file_ext') ?? (fileName ? extFromFileName(fileName) : null);
  const mimeType = firstString(entry.record, 'mimeType', 'mime_type') ?? (fileName ? mimeFromFileName(fileName) : null);

  return {
    sourceKey: entry.sourceKey,
    sourceRecord: entry.record,
    fileName,
    originalName,
    displayName,
    publicUrl,
    sourceFilePath,
    filePathForWrite: sourceFilePath ?? publicUrl,
    publicUrlForWrite: publicUrl ?? sourceFilePath,
    mimeType,
    fileExt,
    fileSize,
    category: normalizeMediaCategory(firstString(entry.record, 'category', 'fileType', 'file_type')),
    altText: firstString(entry.record, 'altText', 'alt_text', 'alt', 'displayName', 'display_name', 'title'),
    description: firstString(entry.record, 'description', 'caption'),
    status: firstString(entry.record, 'status') ?? (asBoolean(entry.record.enabled ?? entry.record.is_enabled, true) ? 'active' : 'inactive'),
    stableKey: buildMediaStableKey({
      publicUrl,
      filePath: sourceFilePath,
      fileName,
      fileSize,
    }),
  };
}

function findMediaRow(rows: MediaRow[], stableKey: MediaStableKey): MediaRow | null {
  if (stableKey.type === 'public_url') {
    return rows.find((row) => row.public_url === stableKey.value || row.file_path === stableKey.value) ?? null;
  }

  if (stableKey.type === 'file_path') {
    return rows.find((row) => row.file_path === stableKey.value || row.public_url === stableKey.value) ?? null;
  }

  return rows.find((row) => row.file_name === stableKey.fileName && asNumber(row.file_size) === stableKey.fileSize) ?? null;
}

function mediaUrlMatches(url: string | null, media: Pick<MediaRow, 'public_url' | 'file_path'>): boolean {
  if (!url) {
    return false;
  }

  const publicUrl = asNullableString(media.public_url);
  const filePath = asNullableString(media.file_path);
  return [publicUrl, filePath].some((value) => Boolean(value && (value === url || value.includes(url))));
}

async function readMediaByIdOrUrl(mediaId: number | null, url: string | null): Promise<Pick<MediaRow, 'id' | 'public_url' | 'file_path'> | null> {
  if (mediaId !== null) {
    const rows = await readRows<Array<RowDataPacket & Pick<MediaRow, 'id' | 'public_url' | 'file_path'>>>(
      `SELECT id, public_url, file_path
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

  const rows = await readRows<Array<RowDataPacket & Pick<MediaRow, 'id' | 'public_url' | 'file_path'>>>(
    `SELECT id, public_url, file_path
     FROM media_files
     WHERE public_url = :url OR file_path = :url
     LIMIT 1`,
    { url },
  );

  return rows[0] ?? null;
}

async function addMediaUrlCheck(input: {
  checks: FieldCheck[];
  warnings: MigrationWarning[];
  stableKey: string;
  fieldName: string;
  mediaId: number | null;
  url: string | null;
  missingStatus?: Extract<FieldCheckStatus, 'warning' | 'missing_in_mysql'>;
}): Promise<void> {
  if (!input.url) {
    addWarning({
      checks: input.checks,
      warnings: input.warnings,
      fieldName: input.fieldName,
      stableKey: input.stableKey,
      message: `${input.fieldName} has no URL in JSON source.`,
    });
    return;
  }

  const media = await readMediaByIdOrUrl(input.mediaId, input.url);

  if (!media) {
    const status = input.missingStatus ?? 'warning';
    addCustomCheck({
      checks: input.checks,
      fieldName: input.fieldName,
      stableKey: input.stableKey,
      jsonValue: input.url,
      mysqlValue: null,
      status,
      message: `No related media_files row was found for ${input.url}.`,
    });

    if (status === 'warning') {
      input.warnings.push({
        code: 'compare_media_file_missing',
        level: 'warning',
        message: `${input.stableKey}: No related media_files row was found for ${input.url}.`,
      });
    }
    return;
  }

  const status = mediaUrlMatches(input.url, media) ? 'matched' : 'mismatch';
  addCustomCheck({
    checks: input.checks,
    fieldName: input.fieldName,
    stableKey: input.stableKey,
    jsonValue: input.url,
    mysqlValue: {
      public_url: media.public_url,
      file_path: media.file_path,
    },
    status,
    message: status === 'matched'
      ? `${input.fieldName} media_files public_url/file_path contains the JSON URL.`
      : `${input.fieldName} media_files public_url/file_path does not contain the JSON URL.`,
  });
}

function articleSourceId(article: Record<string, unknown>): string | null {
  return asNullableString(article.sourceId ?? article.source_id ?? article.id);
}

function articleCategorySlug(article: Record<string, unknown>): string | null {
  return asNullableString(article.categorySlug ?? article.category_slug ?? article.category ?? article['\u5206\u7c7b']);
}

function articleStatus(article: Record<string, unknown>): string {
  const status = asNullableString(article.status);
  return status ?? (asBoolean(article.published ?? article.enabled, false) ? 'published' : 'draft');
}

function publishedAtForStatus(record: Record<string, unknown>, status: string): unknown {
  return status === 'published'
    ? record.publishedAt ?? record.published_at ?? record.updatedAt ?? record.createdAt
    : null;
}

async function compareArticles(jsonSource: JsonSourceSnapshot, mysqlTarget: MysqlTargetSnapshot): Promise<DetailCompareResult> {
  const checks: FieldCheck[] = [];
  const warnings: MigrationWarning[] = [];
  const articles = sourceRecords(jsonSource.data);
  const rows = await readRows<ArticleRow[]>(
    `SELECT id, source_id, category_slug, title, slug, summary, content, cover_url, tags_json,
            status, sort_order, is_home_featured, published_at
     FROM articles
     ORDER BY sort_order, id`,
  );
  const categoryRows = await readRows<ArticleCategoryRow[]>(
    `SELECT slug, name, sort_order, status
     FROM article_categories
     ORDER BY sort_order, slug`,
  );
  const seoRows = await readRows<SeoRow[]>(
    `SELECT owner_type, owner_source_id, owner_id, title, description, keywords, published_at
     FROM seo_settings
     WHERE owner_type = 'article'`,
  );
  const faqRows = await readRows<FaqRow[]>(
    `SELECT owner_type, owner_source_id, owner_id, question, answer, sort_order, status
     FROM faq_items
     WHERE owner_type = 'article'
     ORDER BY sort_order, id`,
  );
  const categorySlugs = Array.from(new Set(articles.map(articleCategorySlug).filter((slug): slug is string => Boolean(slug)))).sort();
  const rowBySlug = new Map(rows.map((row) => [row.slug, row]));
  const seenArticleIds = new Set<number>();

  addFieldCheck(checks, 'article_categories.count', categorySlugs.length, categoryRows.length);

  for (const slug of categorySlugs) {
    const row = categoryRows.find((category) => category.slug === slug);
    const stableKey = `category_slug:${slug}`;

    if (!row) {
      addCustomCheck({
        checks,
        fieldName: 'article_categories.record',
        stableKey,
        jsonValue: slug,
        mysqlValue: null,
        status: 'missing_in_mysql',
        message: 'JSON article category is missing in MySQL article_categories.',
      });
      continue;
    }

    addFieldCheck(checks, 'article_categories.slug', slug, row.slug, stableKey);
    addFieldCheck(checks, 'article_categories.status', 'active', row.status, stableKey);
  }

  for (const [index, article] of articles.entries()) {
    const slug = asNullableString(article.slug);
    const stableKey = slug ? `slug:${slug}` : `index:${index + 1}`;

    warnIfMissingSourceField({ checks, warnings, record: article, names: ['slug'], fieldName: 'slug', stableKey });
    warnIfMissingSourceField({ checks, warnings, record: article, names: ['title'], fieldName: 'title', stableKey });

    if (!slug) {
      continue;
    }

    const row = rowBySlug.get(slug);

    if (!row) {
      addCustomCheck({
        checks,
        fieldName: 'articles.record',
        stableKey,
        jsonValue: article,
        mysqlValue: null,
        status: 'missing_in_mysql',
        message: 'JSON article is missing in MySQL articles.',
      });
      continue;
    }

    seenArticleIds.add(row.id);
    const sourceId = articleSourceId(article);
    const status = articleStatus(article);
    const ownerId = ownerSourceId(sourceId, slug);
    const publishedAt = publishedAtForStatus(article, status);
    const seoRow = findSeoRow(seoRows, row.id, ownerId);
    const ownerFaqRows = faqRowsForOwner(faqRows, row.id, ownerId);

    addFieldCheck(checks, 'source_id', sourceId, row.source_id, stableKey);
    addFieldCheck(checks, 'slug', slug, row.slug, stableKey);
    addFieldCheck(checks, 'title', asString(article.title).trim(), row.title, stableKey);
    addFieldCheck(checks, 'summary', sourceNullableString(article, ['summary', 'excerpt', 'description']), row.summary, stableKey);
    addFieldCheck(checks, 'content', asNullableString(article.content ?? article.content_html ?? article.body), row.content, stableKey);
    addFieldCheck(checks, 'category_slug', articleCategorySlug(article), row.category_slug, stableKey);
    addFieldCheck(checks, 'status', status, row.status, stableKey);
    addFieldCheck(checks, 'status_semantic', asBooleanSemantic(status, false), asBooleanSemantic(row.status, false), stableKey);
    addFieldCheck(checks, 'sort_order', sourceNumber(article, ['sortOrder', 'sort_order'], index + 1), asNumber(row.sort_order), stableKey);
    addDateFieldCheck(checks, 'published_at', publishedAt, row.published_at, stableKey);
    addSeoChecks({ checks, warnings, ownerType: 'article', stableKey, sourceRecord: article, seoRow, publishedAt });
    addFaqChecks({ checks, warnings, ownerType: 'article', stableKey, sourceRecord: article, faqRows: ownerFaqRows });
  }

  for (const row of rows.filter((candidate) => !seenArticleIds.has(candidate.id))) {
    addCustomCheck({
      checks,
      fieldName: 'articles.record',
      stableKey: `slug:${row.slug}`,
      jsonValue: null,
      mysqlValue: {
        source_id: row.source_id,
        slug: row.slug,
        title: row.title,
      },
      status: 'missing_in_json',
      message: 'MySQL article is missing in articles.json.',
    });
  }

  return {
    detailStatus: detailStatusFromChecks(checks, jsonSource.sourceCount, mysqlTarget.rowCount),
    fieldChecks: checks,
    warnings,
    errors: [],
  };
}

async function compareMediaLibrary(jsonSource: JsonSourceSnapshot, mysqlTarget: MysqlTargetSnapshot): Promise<DetailCompareResult> {
  const checks: FieldCheck[] = [];
  const warnings: MigrationWarning[] = [];
  const entries = mediaLibraryEntries(jsonSource.data);
  const rows = await readRows<MediaRow[]>(
    `SELECT id, file_name, original_name, file_path, public_url, mime_type, file_ext, file_size,
            category, alt_text, description, metadata_json, status
     FROM media_files
     ORDER BY id`,
  );
  const seenMediaIds = new Set<number>();
  const sourceStableKeys = new Set<string>();

  addCustomCheck({
    checks,
    fieldName: 'media-library.source_count',
    jsonValue: jsonSource.sourceCount,
    mysqlValue: mysqlTarget.rowCount,
    status: 'warning',
    message: 'media_files is shared; MySQL total count is informational and is not used as a media-library failure condition.',
  });

  warnings.push({
    code: 'compare_shared_mysql_table',
    level: 'info',
    message: 'media_files is shared; extra MySQL media rows from cases, solutions, home, and company-assets are not media-library failures.',
  });

  for (const entry of entries) {
    const prepared = prepareMediaLibraryFile(entry);
    const stableKey = prepared.stableKey ? stableKeyLabel(prepared.stableKey) : `source:${prepared.sourceKey}`;

    if (!prepared.stableKey) {
      addWarning({
        checks,
        warnings,
        fieldName: 'media_files.stable_key',
        stableKey,
        jsonValue: entry.record,
        message: 'JSON media-library record has no public_url/url, file_path, or file_name+file_size stable key.',
      });
      continue;
    }

    sourceStableKeys.add(stableKey);
    const row = findMediaRow(rows, prepared.stableKey);

    if (!row) {
      addCustomCheck({
        checks,
        fieldName: 'media_files.record',
        stableKey,
        jsonValue: entry.record,
        mysqlValue: null,
        status: 'missing_in_mysql',
        message: 'JSON media-library record is missing in MySQL media_files.',
      });
      continue;
    }

    seenMediaIds.add(row.id);
    const metadataJson = parseJsonColumn(row.metadata_json);
    const metadataRecord = isRecord(metadataJson) ? metadataJson.sourceRecord : undefined;
    const sourceRecordPreserved = jsonContainsCoreFields(metadataRecord, entry.record);

    addFieldCheck(checks, 'media_files.public_url', prepared.publicUrlForWrite, row.public_url, stableKey);
    addFieldCheck(checks, 'media_files.file_path', prepared.filePathForWrite, row.file_path, stableKey);
    addFieldCheck(checks, 'media_files.file_name', prepared.fileName, row.file_name, stableKey);
    addFieldCheck(checks, 'media_files.original_name', prepared.originalName ?? prepared.fileName, row.original_name, stableKey);
    addFieldCheck(checks, 'media_files.display_name', prepared.displayName, isRecord(metadataJson) ? metadataJson.displayName : null, stableKey);
    addFieldCheck(checks, 'media_files.mime_type', prepared.mimeType, row.mime_type, stableKey);
    addFieldCheck(checks, 'media_files.file_ext', prepared.fileExt, row.file_ext, stableKey);
    addFieldCheck(checks, 'media_files.file_size', prepared.fileSize, asNumber(row.file_size), stableKey);
    addFieldCheck(checks, 'media_files.category', prepared.category, row.category, stableKey);
    addFieldCheck(checks, 'media_files.alt_text', prepared.altText, row.alt_text, stableKey);
    addFieldCheck(checks, 'media_files.description', prepared.description, row.description, stableKey);
    addFieldCheck(checks, 'media_files.status', prepared.status, row.status, stableKey);
    addCustomCheck({
      checks,
      fieldName: 'media_files.metadata_json.sourceRecord',
      stableKey,
      jsonValue: entry.record,
      mysqlValue: metadataRecord,
      status: sourceRecordPreserved ? 'matched' : 'mismatch',
      message: sourceRecordPreserved
        ? 'metadata_json.sourceRecord preserves the JSON media-library source core fields.'
        : 'metadata_json.sourceRecord is missing one or more JSON media-library source core fields.',
    });
  }

  const extraMysqlKeys = rows
    .filter((row) => !seenMediaIds.has(row.id))
    .flatMap(mediaRowStableKeys)
    .filter((key) => !sourceStableKeys.has(key));

  if (extraMysqlKeys.length > 0) {
    addCustomCheck({
      checks,
      fieldName: 'media_files.extraMysqlKeys',
      jsonValue: { sourceStableKeyCount: sourceStableKeys.size },
      mysqlValue: {
        extraCount: extraMysqlKeys.length,
        extraMysqlKeys: extraMysqlKeys.slice(0, 100),
      },
      status: 'warning',
      message: 'Extra MySQL media_files keys are informational because media_files is shared by multiple modules.',
    });
  }

  return {
    detailStatus: detailStatusFromChecks(checks, jsonSource.sourceCount, entries.length),
    fieldChecks: checks,
    warnings,
    errors: [],
  };
}

function caseSourceId(caseRecord: Record<string, unknown>): string | null {
  return asNullableString(caseRecord.sourceId ?? caseRecord.source_id ?? caseRecord.id);
}

function caseStatus(caseRecord: Record<string, unknown>): string {
  const status = asNullableString(caseRecord.status);
  return status ?? (asBoolean(caseRecord.published ?? caseRecord.enabled ?? caseRecord.is_enabled, false) ? 'published' : 'draft');
}

function caseImageEntries(caseRecord: Record<string, unknown>): Record<string, unknown>[] {
  const imageSources = [
    caseRecord.extractedImages,
    caseRecord.extracted_images,
    caseRecord.caseImages,
    caseRecord.case_images,
    caseRecord.images,
    caseRecord.galleryImages,
    caseRecord.gallery_images,
    caseRecord.gallery,
    caseRecord.contentImages,
    caseRecord.content_images,
  ];
  const images: Record<string, unknown>[] = [];

  for (const source of imageSources) {
    if (!Array.isArray(source)) {
      continue;
    }

    for (const item of source) {
      if (typeof item === 'string') {
        images.push({ url: item });
      } else if (isRecord(item)) {
        images.push(item);
      }
    }
  }

  return images;
}

function caseImageUrl(image: Record<string, unknown>): string | null {
  return normalizeMediaPath(firstString(image, 'url', 'imageUrl', 'image_url', 'publicUrl', 'public_url', 'src'));
}

async function compareCases(jsonSource: JsonSourceSnapshot, mysqlTarget: MysqlTargetSnapshot): Promise<DetailCompareResult> {
  const checks: FieldCheck[] = [];
  const warnings: MigrationWarning[] = [];
  const cases = sourceRecords(jsonSource.data);
  const rows = await readRows<CaseRow[]>(
    `SELECT id, source_id, title, slug, summary, client_type, event_type, event_date, location,
            cover_media_id, cover_url, cover_file_name, cover_display_name, word_file_name,
            word_original_name, raw_json, status, sort_order, is_home_featured, published_at
     FROM cases
     ORDER BY sort_order, id`,
  );
  const imageRows = await readRows<CaseImageRow[]>(
    `SELECT id, case_id, media_id, image_url, alt_text, caption, sort_order, is_enabled
     FROM case_images
     ORDER BY case_id, sort_order, id`,
  );
  const seoRows = await readRows<SeoRow[]>(
    `SELECT owner_type, owner_source_id, owner_id, title, description, keywords, published_at
     FROM seo_settings
     WHERE owner_type = 'case'`,
  );
  const faqRows = await readRows<FaqRow[]>(
    `SELECT owner_type, owner_source_id, owner_id, question, answer, sort_order, status
     FROM faq_items
     WHERE owner_type = 'case'
     ORDER BY sort_order, id`,
  );
  const rowBySlug = new Map(rows.map((row) => [row.slug, row]));
  const seenCaseIds = new Set<number>();
  let expectedImageCount = 0;

  for (const [index, caseRecord] of cases.entries()) {
    const slug = asNullableString(caseRecord.slug);
    const stableKey = slug ? `slug:${slug}` : `index:${index + 1}`;

    warnIfMissingSourceField({ checks, warnings, record: caseRecord, names: ['slug'], fieldName: 'slug', stableKey });
    warnIfMissingSourceField({ checks, warnings, record: caseRecord, names: ['title'], fieldName: 'title', stableKey });

    if (!slug) {
      continue;
    }

    const row = rowBySlug.get(slug);

    if (!row) {
      addCustomCheck({
        checks,
        fieldName: 'cases.record',
        stableKey,
        jsonValue: caseRecord,
        mysqlValue: null,
        status: 'missing_in_mysql',
        message: 'JSON case is missing in MySQL cases.',
      });
      continue;
    }

    seenCaseIds.add(row.id);
    const sourceId = caseSourceId(caseRecord);
    const status = caseStatus(caseRecord);
    const ownerId = ownerSourceId(sourceId, slug);
    const publishedAt = publishedAtForStatus(caseRecord, status);
    const rawJson = parseJsonColumn(row.raw_json);
    const rawJsonMatches = jsonContainsCoreFields(rawJson, caseRecord);

    addFieldCheck(checks, 'source_id', sourceId, row.source_id, stableKey);
    addFieldCheck(checks, 'slug', slug, row.slug, stableKey);
    addFieldCheck(checks, 'title', asString(caseRecord.title).trim(), row.title, stableKey);
    addFieldCheck(checks, 'summary', sourceNullableString(caseRecord, ['summary', 'description']), row.summary, stableKey);
    addFieldCheck(checks, 'client_type', sourceNullableString(caseRecord, ['clientType', 'client_type']), row.client_type, stableKey);
    addFieldCheck(checks, 'event_type', sourceNullableString(caseRecord, ['eventType', 'event_type']), row.event_type, stableKey);
    addFieldCheck(checks, 'event_date', sourceNullableString(caseRecord, ['eventDate', 'event_date', 'date']), row.event_date, stableKey);
    addFieldCheck(checks, 'location', asNullableString(caseRecord.location), row.location, stableKey);
    addFieldCheck(checks, 'cover_url', normalizeMediaPath(firstString(caseRecord, 'coverUrl', 'cover_url')), row.cover_url, stableKey);
    addFieldCheck(checks, 'cover_file_name', firstString(caseRecord, 'coverFileName', 'cover_file_name') ?? normalizeFileName(row.cover_url, null), row.cover_file_name, stableKey);
    addFieldCheck(checks, 'cover_display_name', firstString(caseRecord, 'coverDisplayName', 'cover_display_name'), row.cover_display_name, stableKey);
    addFieldCheck(checks, 'word_file_name', firstString(caseRecord, 'wordFileName', 'word_file_name'), row.word_file_name, stableKey);
    addFieldCheck(checks, 'word_original_name', firstString(caseRecord, 'wordOriginalName', 'word_original_name'), row.word_original_name, stableKey);
    addFieldCheck(checks, 'status', status, row.status, stableKey);
    addFieldCheck(checks, 'status_semantic', asBooleanSemantic(status, false), asBooleanSemantic(row.status, false), stableKey);
    addFieldCheck(checks, 'sort_order', sourceNumber(caseRecord, ['sortOrder', 'sort_order'], index + 1), asNumber(row.sort_order), stableKey);
    addDateFieldCheck(checks, 'published_at', publishedAt, row.published_at, stableKey);
    addCustomCheck({
      checks,
      fieldName: 'raw_json',
      stableKey,
      jsonValue: caseRecord,
      mysqlValue: rawJson,
      status: rawJsonMatches ? 'matched' : 'mismatch',
      message: rawJsonMatches
        ? 'raw_json preserves the JSON case source object core fields.'
        : 'raw_json is missing one or more JSON case source object core fields.',
    });

    await addMediaUrlCheck({
      checks,
      warnings,
      stableKey,
      fieldName: 'cover_url.media_files.url',
      mediaId: asNullableNumber(row.cover_media_id),
      url: row.cover_url,
    });

    const caseImages = caseImageEntries(caseRecord);
    const ownerImageRows = imageRows.filter((imageRow) => asNumber(imageRow.case_id) === row.id);
    const seenImageIds = new Set<number>();
    expectedImageCount += caseImages.filter((image) => Boolean(caseImageUrl(image))).length;

    for (const [imageIndex, image] of caseImages.entries()) {
      const imageUrl = caseImageUrl(image);
      const sortOrder = sourceNumber(image, ['sortOrder', 'sort_order'], imageIndex + 1);
      const imageKey = `${stableKey}:image:${sortOrder}`;

      if (!imageUrl) {
        addWarning({
          checks,
          warnings,
          fieldName: 'case_images.image_url',
          stableKey: imageKey,
          jsonValue: image,
          message: 'JSON case image has no URL; migration skips this image.',
        });
        continue;
      }

      const imageRow = ownerImageRows.find((candidate) => candidate.image_url === imageUrl && asNumber(candidate.sort_order) === sortOrder);

      if (!imageRow) {
        addCustomCheck({
          checks,
          fieldName: 'case_images.record',
          stableKey: imageKey,
          jsonValue: image,
          mysqlValue: null,
          status: 'missing_in_mysql',
          message: 'JSON case image is missing in MySQL case_images.',
        });
        continue;
      }

      seenImageIds.add(imageRow.id);
      addFieldCheck(checks, 'case_images.image_url', imageUrl, imageRow.image_url, imageKey);
      addFieldCheck(checks, 'case_images.alt_text', firstString(image, 'altText', 'alt_text', 'alt'), imageRow.alt_text, imageKey);
      addFieldCheck(checks, 'case_images.caption', firstString(image, 'caption'), imageRow.caption, imageKey);
      addFieldCheck(checks, 'case_images.sort_order', sortOrder, asNumber(imageRow.sort_order), imageKey);
      addFieldCheck(checks, 'case_images.is_enabled', asBoolean(image.enabled ?? image.is_enabled, true), asBooleanSemantic(imageRow.is_enabled), imageKey);
      await addMediaUrlCheck({
        checks,
        warnings,
        stableKey: imageKey,
        fieldName: 'case_images.media_files.url',
        mediaId: asNullableNumber(imageRow.media_id),
        url: imageUrl,
      });
    }

    for (const imageRow of ownerImageRows.filter((candidate) => !seenImageIds.has(candidate.id))) {
      addCustomCheck({
        checks,
        fieldName: 'case_images.record',
        stableKey: `${stableKey}:image:${asNumber(imageRow.sort_order)}`,
        jsonValue: null,
        mysqlValue: {
          image_url: imageRow.image_url,
          sort_order: imageRow.sort_order,
        },
        status: 'missing_in_json',
        message: 'MySQL case_images row is missing in cases.json.',
      });
    }

    addSeoChecks({
      checks,
      warnings,
      ownerType: 'case',
      stableKey,
      sourceRecord: caseRecord,
      seoRow: findSeoRow(seoRows, row.id, ownerId),
      publishedAt,
    });
    addFaqChecks({
      checks,
      warnings,
      ownerType: 'case',
      stableKey,
      sourceRecord: caseRecord,
      faqRows: faqRowsForOwner(faqRows, row.id, ownerId),
    });
  }

  addFieldCheck(checks, 'case_images.count', expectedImageCount, imageRows.length);

  for (const row of rows.filter((candidate) => !seenCaseIds.has(candidate.id))) {
    addCustomCheck({
      checks,
      fieldName: 'cases.record',
      stableKey: `slug:${row.slug}`,
      jsonValue: null,
      mysqlValue: {
        source_id: row.source_id,
        slug: row.slug,
        title: row.title,
      },
      status: 'missing_in_json',
      message: 'MySQL case is missing in cases.json.',
    });
  }

  return {
    detailStatus: detailStatusFromChecks(checks, jsonSource.sourceCount, mysqlTarget.rowCount),
    fieldChecks: checks,
    warnings,
    errors: [],
  };
}

function solutionTitle(solution: Record<string, unknown>): string {
  return asString(solution.title ?? solution.name).trim();
}

function solutionSourceId(solution: Record<string, unknown>): string | null {
  return asNullableString(solution.sourceId ?? solution.source_id ?? solution.id);
}

function enabledStatus(record: Record<string, unknown>, activeStatus = 'active'): string {
  return firstString(record, 'status') ?? (asBoolean(record.enabled ?? record.is_enabled, true) ? activeStatus : 'inactive');
}

function solutionGroups(solution: Record<string, unknown>): Record<string, unknown>[] {
  const rawGroups = solution.groups ?? solution.solutionGroups ?? solution.solution_groups ?? solution.caseGroups;
  return Array.isArray(rawGroups) ? rawGroups.filter(isRecord) : [];
}

function solutionMediaEntries(group: Record<string, unknown>): Record<string, unknown>[] {
  const mediaSources = [group.items, group.mediaItems, group.media_items, group.images, group.videos];
  const mediaItems: Record<string, unknown>[] = [];

  for (const rawItems of mediaSources) {
    if (!Array.isArray(rawItems)) {
      continue;
    }

    for (const item of rawItems) {
      if (typeof item === 'string') {
        mediaItems.push({ mediaUrl: item });
      } else if (isRecord(item)) {
        mediaItems.push(item);
      }
    }
  }

  return mediaItems;
}

function solutionMediaSourceId(item: Record<string, unknown>): string | null {
  return asNullableString(item.sourceId ?? item.source_id ?? item.id);
}

function solutionMediaUrl(item: Record<string, unknown>): string | null {
  return normalizeMediaPath(firstString(item, 'mediaUrl', 'media_url', 'url', 'publicUrl', 'public_url', 'src'));
}

function solutionMediaFileType(item: Record<string, unknown>, mediaUrl: string): string {
  const fileType = firstString(item, 'fileType', 'file_type', 'type');

  if (fileType) {
    return fileType.toLowerCase().slice(0, 30);
  }

  const fileExt = extFromFileName(mediaUrl);
  return ['mp4', 'mov', 'webm', 'avi'].includes(fileExt ?? '') ? 'video' : 'image';
}

async function compareSolutions(jsonSource: JsonSourceSnapshot, mysqlTarget: MysqlTargetSnapshot): Promise<DetailCompareResult> {
  const checks: FieldCheck[] = [];
  const warnings: MigrationWarning[] = [];
  const solutions = sourceRecords(jsonSource.data);
  const rows = await readRows<SolutionRow[]>(
    `SELECT id, source_id, title, slug, summary, cover_media_id, cover_url, raw_json, status, sort_order, published_at
     FROM solutions
     ORDER BY sort_order, id`,
  );
  const groupRows = await readRows<SolutionGroupRow[]>(
    `SELECT id, solution_id, source_id, title, slug, summary, scene_slug, sort_order, is_enabled
     FROM solution_groups
     ORDER BY solution_id, sort_order, id`,
  );
  const mediaRows = await readRows<SolutionMediaItemRow[]>(
    `SELECT id, group_id, source_id, media_id, file_type, media_url, media_file_name, media_display_name,
            alt_text, caption, sort_order, is_enabled
     FROM solution_media_items
     ORDER BY group_id, sort_order, id`,
  );
  const seoRows = await readRows<SeoRow[]>(
    `SELECT owner_type, owner_source_id, owner_id, title, description, keywords, published_at
     FROM seo_settings
     WHERE owner_type = 'solution'`,
  );
  const faqRows = await readRows<FaqRow[]>(
    `SELECT owner_type, owner_source_id, owner_id, question, answer, sort_order, status
     FROM faq_items
     WHERE owner_type = 'solution'
     ORDER BY sort_order, id`,
  );
  const rowBySlug = new Map(rows.map((row) => [row.slug, row]));
  const seenSolutionIds = new Set<number>();
  const seenGroupIds = new Set<number>();
  const seenMediaItemIds = new Set<number>();
  let expectedGroupCount = 0;
  let expectedMediaCount = 0;

  for (const [index, solution] of solutions.entries()) {
    const slug = asNullableString(solution.slug);
    const stableKey = slug ? `slug:${slug}` : `index:${index + 1}`;

    warnIfMissingSourceField({ checks, warnings, record: solution, names: ['slug'], fieldName: 'slug', stableKey });
    warnIfMissingSourceField({ checks, warnings, record: solution, names: ['title', 'name'], fieldName: 'title', stableKey });

    if (!slug) {
      continue;
    }

    const row = rowBySlug.get(slug);

    if (!row) {
      addCustomCheck({
        checks,
        fieldName: 'solutions.record',
        stableKey,
        jsonValue: solution,
        mysqlValue: null,
        status: 'missing_in_mysql',
        message: 'JSON solution is missing in MySQL solutions.',
      });
      continue;
    }

    seenSolutionIds.add(row.id);
    const sourceId = solutionSourceId(solution);
    const status = enabledStatus(solution);
    const ownerId = ownerSourceId(sourceId, slug);
    const publishedAt = publishedAtForStatus(solution, status);
    const rawJson = parseJsonColumn(row.raw_json);
    const rawJsonMatches = jsonContainsCoreFields(rawJson, solution);

    addFieldCheck(checks, 'source_id', sourceId, row.source_id, stableKey);
    addFieldCheck(checks, 'slug', slug, row.slug, stableKey);
    addFieldCheck(checks, 'title', solutionTitle(solution), row.title, stableKey);
    addFieldCheck(checks, 'summary', sourceNullableString(solution, ['summary', 'description']), row.summary, stableKey);
    addFieldCheck(checks, 'status', status, row.status, stableKey);
    addFieldCheck(checks, 'status_semantic', asBooleanSemantic(status), asBooleanSemantic(row.status), stableKey);
    addFieldCheck(checks, 'sort_order', sourceNumber(solution, ['sortOrder', 'sort_order'], index + 1), asNumber(row.sort_order), stableKey);
    addFieldCheck(checks, 'cover_url', normalizeMediaPath(firstString(solution, 'coverUrl', 'cover_url')), row.cover_url, stableKey);
    addDateFieldCheck(checks, 'published_at', publishedAt, row.published_at, stableKey);
    addCustomCheck({
      checks,
      fieldName: 'raw_json',
      stableKey,
      jsonValue: solution,
      mysqlValue: rawJson,
      status: rawJsonMatches ? 'matched' : 'mismatch',
      message: rawJsonMatches
        ? 'raw_json preserves the JSON solution source object core fields.'
        : 'raw_json is missing one or more JSON solution source object core fields.',
    });

    await addMediaUrlCheck({
      checks,
      warnings,
      stableKey,
      fieldName: 'cover_url.media_files.url',
      mediaId: asNullableNumber(row.cover_media_id),
      url: row.cover_url,
    });

    const groups = solutionGroups(solution);
    const ownerGroupRows = groupRows.filter((groupRow) => asNumber(groupRow.solution_id) === row.id);
    expectedGroupCount += groups.length;

    for (const [groupIndex, group] of groups.entries()) {
      const groupSlug = asNullableString(group.slug);
      const groupSourceId = asNullableString(group.sourceId ?? group.source_id ?? group.id);
      const groupStableKey = groupSourceId ? `source_id:${groupSourceId}` : `${stableKey}:group:${groupSlug ?? groupIndex + 1}`;

      if (!groupSlug) {
        addWarning({
          checks,
          warnings,
          fieldName: 'solution_groups.slug',
          stableKey: groupStableKey,
          jsonValue: group,
          message: 'JSON solution group has no slug; migration skips invalid groups.',
        });
        continue;
      }

      const groupRow = ownerGroupRows.find((candidate) => {
        if (groupSourceId && candidate.source_id === groupSourceId) {
          return true;
        }

        return candidate.slug === groupSlug;
      });

      if (!groupRow) {
        addCustomCheck({
          checks,
          fieldName: 'solution_groups.record',
          stableKey: groupStableKey,
          jsonValue: group,
          mysqlValue: null,
          status: 'missing_in_mysql',
          message: 'JSON solution group is missing in MySQL solution_groups.',
        });
        continue;
      }

      seenGroupIds.add(groupRow.id);
      addFieldCheck(checks, 'solution_groups.source_id', groupSourceId, groupRow.source_id, groupStableKey);
      addFieldCheck(checks, 'solution_groups.title', asString(group.title ?? group.name).trim(), groupRow.title, groupStableKey);
      addFieldCheck(checks, 'solution_groups.slug', groupSlug, groupRow.slug, groupStableKey);
      addFieldCheck(checks, 'solution_groups.summary', sourceNullableString(group, ['summary', 'description']), groupRow.summary, groupStableKey);
      addFieldCheck(checks, 'solution_groups.scene_slug', firstString(group, 'sceneSlug', 'scene_slug') ?? slug, groupRow.scene_slug, groupStableKey);
      addFieldCheck(checks, 'solution_groups.sort_order', sourceNumber(group, ['sortOrder', 'sort_order'], groupIndex + 1), asNumber(groupRow.sort_order), groupStableKey);
      addFieldCheck(checks, 'solution_groups.is_enabled', asBoolean(group.enabled ?? group.is_enabled, true), asBooleanSemantic(groupRow.is_enabled), groupStableKey);

      const mediaItems = solutionMediaEntries(group);
      const ownerMediaRows = mediaRows.filter((mediaRow) => asNumber(mediaRow.group_id) === groupRow.id);
      expectedMediaCount += mediaItems.filter((item) => Boolean(solutionMediaUrl(item))).length;

      for (const [mediaIndex, item] of mediaItems.entries()) {
        const mediaUrl = solutionMediaUrl(item);
        const mediaSourceId = solutionMediaSourceId(item);
        const sortOrder = sourceNumber(item, ['sortOrder', 'sort_order'], mediaIndex + 1);
        const mediaStableKey = mediaSourceId
          ? `source_id:${mediaSourceId}`
          : `${groupStableKey}:media:${sortOrder}`;

        if (!mediaUrl) {
          addWarning({
            checks,
            warnings,
            fieldName: 'solution_media_items.media_url',
            stableKey: mediaStableKey,
            jsonValue: item,
            message: 'JSON solution media item has no URL; migration skips this media item.',
          });
          continue;
        }

        const mediaRow = ownerMediaRows.find((candidate) => {
          if (mediaSourceId && candidate.source_id === mediaSourceId) {
            return true;
          }

          return candidate.media_url === mediaUrl && asNumber(candidate.sort_order) === sortOrder;
        });

        if (!mediaRow) {
          addCustomCheck({
            checks,
            fieldName: 'solution_media_items.record',
            stableKey: mediaStableKey,
            jsonValue: item,
            mysqlValue: null,
            status: 'missing_in_mysql',
            message: 'JSON solution media item is missing in MySQL solution_media_items.',
          });
          continue;
        }

        seenMediaItemIds.add(mediaRow.id);
        addFieldCheck(checks, 'solution_media_items.source_id', mediaSourceId, mediaRow.source_id, mediaStableKey);
        addFieldCheck(checks, 'solution_media_items.file_type', solutionMediaFileType(item, mediaUrl), mediaRow.file_type, mediaStableKey);
        addFieldCheck(checks, 'solution_media_items.media_url', mediaUrl, mediaRow.media_url, mediaStableKey);
        addFieldCheck(checks, 'solution_media_items.media_file_name', firstString(item, 'mediaFileName', 'media_file_name', 'fileName', 'file_name') ?? normalizeFileName(mediaUrl, null), mediaRow.media_file_name, mediaStableKey);
        addFieldCheck(checks, 'solution_media_items.media_display_name', firstString(item, 'mediaDisplayName', 'media_display_name', 'displayName', 'title'), mediaRow.media_display_name, mediaStableKey);
        addFieldCheck(checks, 'solution_media_items.alt_text', firstString(item, 'altText', 'alt_text', 'alt'), mediaRow.alt_text, mediaStableKey);
        addFieldCheck(checks, 'solution_media_items.caption', firstString(item, 'caption'), mediaRow.caption, mediaStableKey);
        addFieldCheck(checks, 'solution_media_items.sort_order', sortOrder, asNumber(mediaRow.sort_order), mediaStableKey);
        addFieldCheck(checks, 'solution_media_items.is_enabled', asBoolean(item.enabled ?? item.is_enabled, true), asBooleanSemantic(mediaRow.is_enabled), mediaStableKey);
        await addMediaUrlCheck({
          checks,
          warnings,
          stableKey: mediaStableKey,
          fieldName: 'solution_media_items.media_files.url',
          mediaId: asNullableNumber(mediaRow.media_id),
          url: mediaUrl,
        });
      }
    }

    addSeoChecks({
      checks,
      warnings,
      ownerType: 'solution',
      stableKey,
      sourceRecord: solution,
      seoRow: findSeoRow(seoRows, row.id, ownerId),
      publishedAt,
    });
    addFaqChecks({
      checks,
      warnings,
      ownerType: 'solution',
      stableKey,
      sourceRecord: solution,
      faqRows: faqRowsForOwner(faqRows, row.id, ownerId),
    });
  }

  addFieldCheck(checks, 'solution_groups.count', expectedGroupCount, groupRows.length);
  addFieldCheck(checks, 'solution_media_items.count', expectedMediaCount, mediaRows.length);

  for (const row of rows.filter((candidate) => !seenSolutionIds.has(candidate.id))) {
    addCustomCheck({
      checks,
      fieldName: 'solutions.record',
      stableKey: `slug:${row.slug}`,
      jsonValue: null,
      mysqlValue: {
        source_id: row.source_id,
        slug: row.slug,
        title: row.title,
      },
      status: 'missing_in_json',
      message: 'MySQL solution is missing in solutions.json.',
    });
  }

  for (const row of groupRows.filter((candidate) => !seenGroupIds.has(candidate.id))) {
    addCustomCheck({
      checks,
      fieldName: 'solution_groups.record',
      stableKey: row.source_id ? `source_id:${row.source_id}` : `group:${row.id}`,
      jsonValue: null,
      mysqlValue: {
        source_id: row.source_id,
        slug: row.slug,
        title: row.title,
      },
      status: 'missing_in_json',
      message: 'MySQL solution group is missing in solutions.json.',
    });
  }

  for (const row of mediaRows.filter((candidate) => !seenMediaItemIds.has(candidate.id))) {
    addCustomCheck({
      checks,
      fieldName: 'solution_media_items.record',
      stableKey: row.source_id ? `source_id:${row.source_id}` : `media_item:${row.id}`,
      jsonValue: null,
      mysqlValue: {
        source_id: row.source_id,
        media_url: row.media_url,
        sort_order: row.sort_order,
      },
      status: 'missing_in_json',
      message: 'MySQL solution media item is missing in solutions.json.',
    });
  }

  return {
    detailStatus: detailStatusFromChecks(checks, jsonSource.sourceCount, mysqlTarget.rowCount),
    fieldChecks: checks,
    warnings,
    errors: [],
  };
}

function publishLogManifestEntries(data: unknown): PublishLogManifestEntry[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .filter(isRecord)
    .map((entry) => ({
      fileName: asString(entry.fileName),
    }))
    .filter((entry) => entry.fileName.endsWith('.json'));
}

function fileNameWithoutExt(fileName: string): string {
  return fileName.endsWith('.json') ? fileName.slice(0, -5) : fileName;
}

function stableVersionValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function publishVersion(log: Record<string, unknown>, fileName: string): string {
  return (
    stableVersionValue(log.version)
    ?? stableVersionValue(log.publishVersion)
    ?? stableVersionValue(log.publish_version)
    ?? stableVersionValue(log.publishId)
    ?? stableVersionValue(log.publish_id)
    ?? stableVersionValue(log.timestamp)
    ?? stableVersionValue(log.generatedAt)
    ?? stableVersionValue(log.generated_at)
    ?? fileNameWithoutExt(fileName)
  ).slice(0, 120);
}

function normalizePublishStatus(log: Record<string, unknown>): 'success' | 'failed' | 'rollback' | 'unknown' {
  const status = asString(log.status).trim().toLowerCase();

  if (status === 'success' || status === 'failed' || status === 'rollback') {
    return status;
  }

  if (status === 'error') {
    return 'failed';
  }

  if (Array.isArray(log.failedRoutes) && log.failedRoutes.length > 0) {
    return 'failed';
  }

  return 'unknown';
}

function publishType(log: Record<string, unknown>, status: string): string {
  return (firstString(log, 'publishType', 'publish_type', 'type') ?? (status === 'rollback' ? 'rollback' : 'full'))
    .slice(0, 40);
}

function jsonArrayString(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function sourceStatsValue(log: Record<string, unknown>, fileName: string): Record<string, unknown> | null {
  const sourceStats = log.sourceStats ?? log.source_stats;

  if (isRecord(sourceStats)) {
    return sourceStats;
  }

  const stats: Record<string, unknown> = { fileName };
  const knownStatKeys = ['totalRoutes', 'skippedRoutes', 'sitemapPath', 'robotsPath', 'manifestPath', 'triggeredBy'];
  let hasStats = false;

  for (const key of knownStatKeys) {
    if (log[key] !== undefined) {
      stats[key] = log[key];
      hasStats = true;
    }
  }

  return hasStats ? stats : null;
}

function publishSummary(log: Record<string, unknown>): string | null {
  const summary = firstString(log, 'summary', 'message', 'description');

  if (summary) {
    return summary;
  }

  const totalRoutes = asOptionalUnsignedInteger(log.totalRoutes);
  const generatedRoutes = Array.isArray(log.generatedRoutes) ? log.generatedRoutes.length : null;
  const failedRoutes = Array.isArray(log.failedRoutes) ? log.failedRoutes.length : null;

  if (totalRoutes !== null || generatedRoutes !== null || failedRoutes !== null) {
    return `routes total=${totalRoutes ?? 'unknown'}, generated=${generatedRoutes ?? 'unknown'}, failed=${failedRoutes ?? 'unknown'}`;
  }

  return null;
}

function publishErrorMessage(log: Record<string, unknown>): string | null {
  const directError = firstString(log, 'errorMessage', 'error_message', 'error');

  if (directError) {
    return directError;
  }

  if (Array.isArray(log.errors) && log.errors.length > 0) {
    return JSON.stringify(log.errors);
  }

  return null;
}

function publishStartedAt(log: Record<string, unknown>): unknown {
  return log.startedAt ?? log.started_at ?? log.generatedAt ?? log.generated_at ?? log.createdAt ?? log.created_at;
}

function publishFinishedAt(log: Record<string, unknown>): unknown {
  return log.finishedAt ?? log.finished_at ?? log.completedAt ?? log.completed_at ?? log.generatedAt ?? log.generated_at;
}

async function comparePublishLogs(jsonSource: JsonSourceSnapshot, mysqlTarget: MysqlTargetSnapshot): Promise<DetailCompareResult> {
  const checks: FieldCheck[] = [];
  const warnings: MigrationWarning[] = [];
  const entries = publishLogManifestEntries(jsonSource.data);
  const rows = await readRows<PublishLogRow[]>(
    `SELECT publish_version, publish_type, target_type, target_id, status, release_dir, previous_version,
            rollback_to_version, summary, error_message, source_stats_json, failed_routes_json,
            routes_json, raw_log_json, started_at, finished_at
     FROM publish_logs
     ORDER BY publish_version`,
  );
  const rowByVersion = new Map(rows.map((row) => [row.publish_version, row]));
  const seenVersions = new Set<string>();

  for (const entry of entries) {
    const absolutePath = path.join(jsonSource.absolutePath, entry.fileName);
    let log: Record<string, unknown>;

    try {
      const parsed = JSON.parse(await readFile(absolutePath, 'utf8')) as unknown;

      if (!isRecord(parsed)) {
        throw new Error('Publish log JSON root is not an object.');
      }

      log = parsed;
    } catch (error) {
      addWarning({
        checks,
        warnings,
        fieldName: 'publish_logs.raw_log_json',
        stableKey: `file:${entry.fileName}`,
        message: error instanceof Error ? error.message : 'Unable to parse publish log JSON.',
      });
      continue;
    }

    const version = publishVersion(log, entry.fileName);
    const stableKey = `publish_version:${version}`;
    const row = rowByVersion.get(version);

    if (!row) {
      addCustomCheck({
        checks,
        fieldName: 'publish_logs.record',
        stableKey,
        jsonValue: { fileName: entry.fileName, publishVersion: version },
        mysqlValue: null,
        status: 'missing_in_mysql',
        message: 'JSON publish log is missing in MySQL publish_logs. This is expected if build:prerender created a new JSON log after the shadow index was last rebuilt.',
      });
      continue;
    }

    seenVersions.add(version);
    const status = normalizePublishStatus(log);
    const rawLogJson = parseJsonColumn(row.raw_log_json);
    const rawLogMatches = jsonContainsCoreFields(rawLogJson, log);

    addFieldCheck(checks, 'publish_version', version, row.publish_version, stableKey);
    addFieldCheck(checks, 'publish_type', publishType(log, status), row.publish_type, stableKey);
    addFieldCheck(checks, 'target_type', firstString(log, 'targetType', 'target_type'), row.target_type, stableKey);
    addFieldCheck(checks, 'target_id', asOptionalUnsignedInteger(log.targetId ?? log.target_id), asNullableNumber(row.target_id), stableKey);
    addFieldCheck(checks, 'status', status, row.status, stableKey);
    addFieldCheck(checks, 'release_dir', firstString(log, 'releaseDir', 'release_dir', 'outputDir', 'outDir'), row.release_dir, stableKey);
    addFieldCheck(checks, 'previous_version', firstString(log, 'previousVersion', 'previous_version'), row.previous_version, stableKey);
    addFieldCheck(checks, 'rollback_to_version', firstString(log, 'rollbackToVersion', 'rollback_to_version'), row.rollback_to_version, stableKey);
    addFieldCheck(checks, 'summary', publishSummary(log), row.summary, stableKey);
    addFieldCheck(checks, 'error_message', publishErrorMessage(log), row.error_message, stableKey);
    addFieldCheck(checks, 'source_stats_json', sourceStatsValue(log, entry.fileName), parseJsonColumn(row.source_stats_json), stableKey);
    addFieldCheck(checks, 'failed_routes_json', jsonArrayString(log.failedRoutes ?? log.failed_routes), jsonArrayValue(row.failed_routes_json), stableKey);
    addFieldCheck(checks, 'routes_json', jsonArrayString(log.routes ?? log.generatedRoutes ?? log.generated_routes), jsonArrayValue(row.routes_json), stableKey);
    addDateFieldCheck(checks, 'started_at', publishStartedAt(log), row.started_at, stableKey);
    addDateFieldCheck(checks, 'finished_at', publishFinishedAt(log), row.finished_at, stableKey);
    addCustomCheck({
      checks,
      fieldName: 'raw_log_json',
      stableKey,
      jsonValue: log,
      mysqlValue: rawLogJson,
      status: rawLogMatches ? 'matched' : 'mismatch',
      message: rawLogMatches
        ? 'raw_log_json preserves the JSON publish log core fields.'
        : 'raw_log_json is missing one or more JSON publish log core fields.',
    });
  }

  for (const row of rows.filter((candidate) => !seenVersions.has(candidate.publish_version))) {
    addCustomCheck({
      checks,
      fieldName: 'publish_logs.record',
      stableKey: `publish_version:${row.publish_version}`,
      jsonValue: null,
      mysqlValue: {
        publish_version: row.publish_version,
        status: row.status,
      },
      status: 'missing_in_json',
      message: 'MySQL publish_logs row is missing in server/data/publish-logs JSON files.',
    });
  }

  return {
    detailStatus: detailStatusFromChecks(checks, jsonSource.sourceCount, mysqlTarget.rowCount),
    fieldChecks: checks,
    warnings,
    errors: [],
  };
}

export async function runCoreDetailCompare(input: {
  moduleName: MigrationModuleName;
  jsonSource: JsonSourceSnapshot;
  mysqlTarget: MysqlTargetSnapshot;
}): Promise<DetailCompareResult> {
  if (!isCoreDetailCompareModule(input.moduleName)) {
    return {
      fieldChecks: [],
      warnings: [],
      errors: [],
    };
  }

  switch (input.moduleName) {
    case 'articles':
      return compareArticles(input.jsonSource, input.mysqlTarget);
    case 'media-library':
      return compareMediaLibrary(input.jsonSource, input.mysqlTarget);
    case 'cases':
      return compareCases(input.jsonSource, input.mysqlTarget);
    case 'solutions':
      return compareSolutions(input.jsonSource, input.mysqlTarget);
    case 'publish-logs':
      return comparePublishLogs(input.jsonSource, input.mysqlTarget);
    default:
      return {
        fieldChecks: [],
        warnings: [],
        errors: [],
      };
  }
}
