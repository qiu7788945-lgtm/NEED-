import type { RowDataPacket } from 'mysql2/promise';
import type {
  Article,
  ArticleCategory,
  ArticleFaqItem,
  ArticleStatus,
} from '../../../../shared/types/article.js';
import type {
  CaseExtractedImage,
  CaseFaqItem,
  CaseStatus,
  CaseStudy,
} from '../../../../shared/types/case.js';
import type {
  SolutionGroup,
  SolutionItem,
  SolutionItemFileType,
  SolutionScene,
  SolutionSceneSlug,
} from '../../../../shared/types/solution.js';
import { getDbPool, getSafeDatabaseConfig } from '../client.js';
import type {
  ExportModuleDefinition,
  ExportModuleName,
  ExportStatus,
  MysqlExportReadResult,
} from './types.js';

type ContactInfoRow = RowDataPacket & {
  content_json: unknown;
  is_enabled: unknown;
};

type CompanyAssetRow = RowDataPacket & {
  asset_key: unknown;
  media_url: unknown;
  alt_text: unknown;
  description: unknown;
  sort_order: unknown;
  is_enabled: unknown;
  raw_json: unknown;
};

type HomeVideoRow = RowDataPacket & {
  video_media_id: unknown;
  poster_media_id: unknown;
  video_url: unknown;
  poster_url: unknown;
  title: unknown;
  description: unknown;
  is_enabled: unknown;
  updated_at: unknown;
  video_file_name: unknown;
  video_original_name: unknown;
  poster_file_name: unknown;
  poster_original_name: unknown;
};

type HomeInteractiveImageRow = RowDataPacket & {
  slot_number: unknown;
  media_id: unknown;
  image_url: unknown;
  alt_text: unknown;
  sort_order: unknown;
  is_enabled: unknown;
  media_file_name: unknown;
};

type ArticleRow = RowDataPacket & {
  mysql_id: unknown;
  source_id: unknown;
  title: unknown;
  slug: unknown;
  summary: unknown;
  content: unknown;
  category_slug: unknown;
  category_join_slug: unknown;
  category_name: unknown;
  status: unknown;
  sort_order: unknown;
  published_at: unknown;
  created_at: unknown;
  updated_at: unknown;
  raw_json?: unknown;
};

type ArticleSeoRow = RowDataPacket & {
  owner_source_id: unknown;
  owner_id: unknown;
  title: unknown;
  description: unknown;
  keywords: unknown;
};

type ArticleFaqRow = RowDataPacket & {
  owner_source_id: unknown;
  owner_id: unknown;
  question: unknown;
  answer: unknown;
  sort_order: unknown;
  status: unknown;
};

type CaseRow = RowDataPacket & {
  mysql_id: unknown;
  source_id: unknown;
  title: unknown;
  slug: unknown;
  summary: unknown;
  client_type: unknown;
  event_type: unknown;
  event_date: unknown;
  location: unknown;
  cover_url: unknown;
  cover_file_name: unknown;
  cover_display_name: unknown;
  word_file_name: unknown;
  word_original_name: unknown;
  content_html: unknown;
  content_text: unknown;
  raw_json?: unknown;
  status: unknown;
  sort_order: unknown;
  published_at: unknown;
  created_at: unknown;
  updated_at: unknown;
};

type CaseImageRow = RowDataPacket & {
  case_id: unknown;
  image_url: unknown;
  alt_text: unknown;
  caption: unknown;
  sort_order: unknown;
  is_enabled: unknown;
};

type CaseSeoRow = RowDataPacket & {
  owner_source_id: unknown;
  owner_id: unknown;
  title: unknown;
  description: unknown;
  keywords: unknown;
};

type CaseFaqRow = RowDataPacket & {
  owner_source_id: unknown;
  owner_id: unknown;
  question: unknown;
  answer: unknown;
  sort_order: unknown;
  status: unknown;
};

type SolutionRow = RowDataPacket & {
  mysql_id: unknown;
  source_id: unknown;
  title: unknown;
  slug: unknown;
  summary: unknown;
  raw_json?: unknown;
  status: unknown;
  sort_order: unknown;
  published_at: unknown;
  created_at: unknown;
  updated_at: unknown;
};

type SolutionGroupRow = RowDataPacket & {
  mysql_id: unknown;
  solution_id: unknown;
  source_id: unknown;
  title: unknown;
  slug: unknown;
  summary: unknown;
  scene_slug: unknown;
  sort_order: unknown;
  is_enabled: unknown;
  created_at: unknown;
  updated_at: unknown;
};

type SolutionMediaItemRow = RowDataPacket & {
  group_id: unknown;
  source_id: unknown;
  file_type: unknown;
  media_url: unknown;
  media_file_name: unknown;
  media_display_name: unknown;
  alt_text: unknown;
  caption: unknown;
  sort_order: unknown;
  is_enabled: unknown;
  created_at: unknown;
};

const implementedExportModules = new Set<ExportModuleName>([
  'contact-info',
  'company-assets',
  'home-video',
  'home-interactive-images',
  'articles',
  'cases',
  'solutions',
]);

const allowedArticleCategories = new Set<ArticleCategory>([
  'how_to_choose',
  'choose_between_two',
  'method_judgment',
]);
const allowedArticleStatuses = new Set<ArticleStatus>([
  'draft',
  'published',
  'offline',
]);
const allowedCaseStatuses = new Set<CaseStatus>([
  'draft',
  'published',
  'offline',
]);
const solutionSceneSlugs: SolutionSceneSlug[] = [
  'family-day',
  'client-appreciation',
  'annual-meeting',
  'commercial-display',
  'video-digital-assets',
  'academic-forum',
  'other',
];
const allowedSolutionSceneSlugs = new Set<SolutionSceneSlug>(solutionSceneSlugs);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function asMysqlBoolean(value: unknown, fallback = true): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'enabled', 'published'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'no', 'disabled', 'draft', 'archived'].includes(normalized)) {
      return false;
    }
  }

  return fallback;
}

function parseJsonColumn(value: unknown): unknown {
  if (Buffer.isBuffer(value)) {
    return parseJsonColumn(value.toString('utf8'));
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed ? JSON.parse(trimmed) as unknown : undefined;
}

function fileNameFromUrl(value: unknown): string {
  const rawValue = asString(value);
  if (!rawValue) {
    return '';
  }

  const withoutQuery = rawValue.split('?')[0]?.split('#')[0] ?? rawValue;
  return withoutQuery.split(/[\\/]/).filter(Boolean).pop() ?? '';
}

function pickString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = asString(record[key]);
    if (value) {
      return value;
    }
  }

  return '';
}

function pickNumber(record: Record<string, unknown>, keys: string[], fallback: number): number {
  for (const key of keys) {
    if (record[key] !== undefined) {
      const value = asNumber(record[key], Number.NaN);
      if (Number.isFinite(value)) {
        return value;
      }
    }
  }

  return fallback;
}

function pickBoolean(record: Record<string, unknown>, keys: string[], fallback: boolean): boolean {
  for (const key of keys) {
    if (typeof record[key] === 'boolean') {
      return record[key] as boolean;
    }
  }

  return fallback;
}

function pickArray(record: Record<string, unknown>, keys: string[]): unknown[] {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

function toIsoString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'string' && value.trim()) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value.trim() : date.toISOString();
  }

  return '';
}

function ownerIdKey(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

function ownerSourceKey(value: unknown): string | null {
  return asString(value) || null;
}

function addToMapList<T>(map: Map<string, T[]>, key: string | null, value: T): void {
  if (!key) {
    return;
  }

  const existing = map.get(key) ?? [];
  existing.push(value);
  map.set(key, existing);
}

function normalizeArticleCategory(value: unknown): ArticleCategory | null {
  const category = asString(value);
  return allowedArticleCategories.has(category as ArticleCategory)
    ? category as ArticleCategory
    : null;
}

function normalizeArticleStatus(value: unknown): ArticleStatus | null {
  const status = asString(value);
  return allowedArticleStatuses.has(status as ArticleStatus)
    ? status as ArticleStatus
    : null;
}

function buildArticleSeoLookup(rows: ArticleSeoRow[]) {
  const byOwnerId = new Map<string, ArticleSeoRow>();
  const byOwnerSourceId = new Map<string, ArticleSeoRow>();

  for (const row of rows) {
    const ownerId = ownerIdKey(row.owner_id);
    const ownerSourceId = ownerSourceKey(row.owner_source_id);

    if (ownerId) {
      byOwnerId.set(ownerId, row);
    }

    if (ownerSourceId) {
      byOwnerSourceId.set(ownerSourceId, row);
    }
  }

  return { byOwnerId, byOwnerSourceId };
}

function buildArticleFaqLookup(rows: ArticleFaqRow[]) {
  const byOwnerId = new Map<string, ArticleFaqRow[]>();
  const byOwnerSourceId = new Map<string, ArticleFaqRow[]>();

  for (const row of rows) {
    addToMapList(byOwnerId, ownerIdKey(row.owner_id), row);
    addToMapList(byOwnerSourceId, ownerSourceKey(row.owner_source_id), row);
  }

  return { byOwnerId, byOwnerSourceId };
}

function findArticleSeo(input: {
  lookupByOwnerId: Map<string, ArticleSeoRow>;
  lookupByOwnerSourceId: Map<string, ArticleSeoRow>;
  mysqlId: unknown;
  ownerSourceId: string;
  slug: string;
}): ArticleSeoRow | undefined {
  return input.lookupByOwnerSourceId.get(input.ownerSourceId)
    ?? input.lookupByOwnerSourceId.get(input.slug)
    ?? input.lookupByOwnerId.get(ownerIdKey(input.mysqlId) ?? '');
}

function findArticleFaqRows(input: {
  lookupByOwnerId: Map<string, ArticleFaqRow[]>;
  lookupByOwnerSourceId: Map<string, ArticleFaqRow[]>;
  mysqlId: unknown;
  ownerSourceId: string;
  slug: string;
}): ArticleFaqRow[] {
  return input.lookupByOwnerSourceId.get(input.ownerSourceId)
    ?? input.lookupByOwnerSourceId.get(input.slug)
    ?? input.lookupByOwnerId.get(ownerIdKey(input.mysqlId) ?? '')
    ?? [];
}

function toArticleFaqItems(rows: ArticleFaqRow[]): ArticleFaqItem[] {
  return rows
    .filter((row) => {
      const status = asString(row.status).toLowerCase();
      return status !== 'disabled' && status !== 'inactive' && status !== 'offline';
    })
    .sort((left, right) => asNumber(left.sort_order, 0) - asNumber(right.sort_order, 0))
    .map((row) => ({
      question: asString(row.question),
      answer: asString(row.answer),
    }))
    .filter((item) => item.question || item.answer);
}

function rawArticleFaqItems(rawRecord: Record<string, unknown>): ArticleFaqItem[] {
  return pickArray(rawRecord, ['faqItems', 'faq_items'])
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      return {
        question: pickString(item, ['question', 'q']),
        answer: pickString(item, ['answer', 'a']),
      };
    })
    .filter((item): item is ArticleFaqItem => item !== null && Boolean(item.question || item.answer));
}

function normalizeCaseStatus(value: unknown): CaseStatus | null {
  const status = asString(value);
  return allowedCaseStatuses.has(status as CaseStatus)
    ? status as CaseStatus
    : null;
}

function toDateFieldString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return asString(value);
}

function buildCaseImageLookup(rows: CaseImageRow[]) {
  const byCaseId = new Map<string, CaseImageRow[]>();

  for (const row of rows) {
    addToMapList(byCaseId, ownerIdKey(row.case_id), row);
  }

  return byCaseId;
}

function buildCaseSeoLookup(rows: CaseSeoRow[]) {
  const byOwnerId = new Map<string, CaseSeoRow>();
  const byOwnerSourceId = new Map<string, CaseSeoRow>();

  for (const row of rows) {
    const ownerId = ownerIdKey(row.owner_id);
    const ownerSourceId = ownerSourceKey(row.owner_source_id);

    if (ownerId) {
      byOwnerId.set(ownerId, row);
    }

    if (ownerSourceId) {
      byOwnerSourceId.set(ownerSourceId, row);
    }
  }

  return { byOwnerId, byOwnerSourceId };
}

function buildCaseFaqLookup(rows: CaseFaqRow[]) {
  const byOwnerId = new Map<string, CaseFaqRow[]>();
  const byOwnerSourceId = new Map<string, CaseFaqRow[]>();

  for (const row of rows) {
    addToMapList(byOwnerId, ownerIdKey(row.owner_id), row);
    addToMapList(byOwnerSourceId, ownerSourceKey(row.owner_source_id), row);
  }

  return { byOwnerId, byOwnerSourceId };
}

function findCaseSeo(input: {
  lookupByOwnerId: Map<string, CaseSeoRow>;
  lookupByOwnerSourceId: Map<string, CaseSeoRow>;
  mysqlId: unknown;
  ownerSourceId: string;
  slug: string;
}): CaseSeoRow | undefined {
  return input.lookupByOwnerSourceId.get(input.ownerSourceId)
    ?? input.lookupByOwnerSourceId.get(input.slug)
    ?? input.lookupByOwnerId.get(ownerIdKey(input.mysqlId) ?? '');
}

function findCaseFaqRows(input: {
  lookupByOwnerId: Map<string, CaseFaqRow[]>;
  lookupByOwnerSourceId: Map<string, CaseFaqRow[]>;
  mysqlId: unknown;
  ownerSourceId: string;
  slug: string;
}): CaseFaqRow[] {
  return input.lookupByOwnerSourceId.get(input.ownerSourceId)
    ?? input.lookupByOwnerSourceId.get(input.slug)
    ?? input.lookupByOwnerId.get(ownerIdKey(input.mysqlId) ?? '')
    ?? [];
}

function rawCaseFaqItems(rawRecord: Record<string, unknown>): CaseFaqItem[] {
  return pickArray(rawRecord, ['faqItems', 'faq_items'])
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      return {
        question: pickString(item, ['question', 'q']),
        answer: pickString(item, ['answer', 'a']),
      };
    })
    .filter((item): item is CaseFaqItem => item !== null && Boolean(item.question || item.answer));
}

function toCaseFaqItems(rows: CaseFaqRow[]): CaseFaqItem[] {
  return rows
    .filter((row) => {
      const status = asString(row.status).toLowerCase();
      return status !== 'disabled' && status !== 'inactive' && status !== 'offline';
    })
    .sort((left, right) => asNumber(left.sort_order, 0) - asNumber(right.sort_order, 0))
    .map((row) => ({
      question: asString(row.question),
      answer: asString(row.answer),
    }))
    .filter((item) => item.question || item.answer);
}

function rawCaseImages(rawRecord: Record<string, unknown>): CaseExtractedImage[] {
  return pickArray(rawRecord, ['extractedImages', 'extracted_images', 'caseImages', 'case_images'])
    .map((image, index) => {
      if (!isRecord(image)) {
        return null;
      }

      const url = pickString(image, ['url', 'imageUrl', 'image_url', 'publicUrl', 'public_url', 'src']);
      const fileName = pickString(image, ['fileName', 'file_name', 'storageFileName', 'storage_file_name'])
        || fileNameFromUrl(url);
      const displayName = pickString(image, ['displayName', 'display_name', 'title', 'caption'])
        || pickString(image, ['altText', 'alt_text', 'alt'])
        || fileName;
      const alt = pickString(image, ['altText', 'alt_text', 'alt']) || displayName;

      return {
        fileName,
        url,
        displayName,
        alt,
        sortOrder: pickNumber(image, ['sortOrder', 'sort_order'], index + 1),
      };
    })
    .filter((image): image is CaseExtractedImage => image !== null && Boolean(image.fileName && image.url));
}

function mysqlCaseImages(rows: CaseImageRow[]): CaseExtractedImage[] {
  return rows
    .sort((left, right) => asNumber(left.sort_order, 0) - asNumber(right.sort_order, 0))
    .map((row, index) => {
      const url = asString(row.image_url);
      const fileName = fileNameFromUrl(url);
      const caption = asString(row.caption);
      const alt = asString(row.alt_text) || caption || fileName;
      const displayName = caption || alt || fileName;

      return {
        fileName,
        url,
        displayName,
        alt,
        sortOrder: asNumber(row.sort_order, index + 1),
      };
    })
    .filter((image) => image.fileName && image.url);
}

function normalizeSolutionSceneSlug(value: unknown): SolutionSceneSlug | null {
  const slug = asString(value);
  return allowedSolutionSceneSlugs.has(slug as SolutionSceneSlug) ? slug as SolutionSceneSlug : null;
}

function solutionStatusToEnabled(value: unknown, fallback: boolean): boolean {
  const status = asString(value).toLowerCase();
  return status ? asMysqlBoolean(status, fallback) : fallback;
}

function normalizeSolutionFileType(value: unknown, mediaUrl: string): SolutionItemFileType {
  const fileType = asString(value).toLowerCase();
  if (fileType === 'video') {
    return 'video';
  }

  if (fileType === 'image') {
    return 'image';
  }

  return /\.(mp4|webm)(\?|#|$)/i.test(mediaUrl) ? 'video' : 'image';
}

function solutionRowKey(row: SolutionRow, index: number): string {
  return asString(row.source_id) || asString(row.slug) || String(row.mysql_id ?? `row_${index + 1}`);
}

function parseSolutionRawJson(input: {
  row: SolutionRow;
  index: number;
  warnings: string[];
  blockers: string[];
}): Record<string, unknown> {
  const rawValue = input.row.raw_json;
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return {};
  }

  try {
    const parsed = parseJsonColumn(rawValue);
    if (isRecord(parsed)) {
      return parsed;
    }

    input.warnings.push(`solutions.${solutionRowKey(input.row, input.index)} raw_json is not an object; split rows were used where possible.`);
    return {};
  } catch (error) {
    input.blockers.push(
      `solutions.${solutionRowKey(input.row, input.index)} raw_json could not be parsed: ${
        error instanceof Error ? error.message : 'invalid JSON'
      }.`,
    );
    return {};
  }
}

function solutionGroupStableKey(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  const slug = pickString(value, ['slug']);
  if (slug) {
    return `slug:${slug}`;
  }

  const id = pickString(value, ['id', 'source_id']);
  return id ? `id:${id}` : null;
}

function solutionItemStableKey(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = pickString(value, ['id', 'source_id']);
  if (id) {
    return `id:${id}`;
  }

  const mediaUrl = pickString(value, ['mediaUrl', 'media_url']);
  const sortOrder = pickNumber(value, ['sortOrder', 'sort_order'], Number.NaN);
  return mediaUrl && Number.isFinite(sortOrder) ? `media:${mediaUrl}|sort:${sortOrder}` : null;
}

function buildRecordMapByStableKey(records: Record<string, unknown>[], keyForRecord: (record: unknown) => string | null) {
  const map = new Map<string, Record<string, unknown>>();

  for (const record of records) {
    const key = keyForRecord(record);
    if (key && !map.has(key)) {
      map.set(key, record);
    }
  }

  return map;
}

function solutionItemsFromRows(rows: SolutionMediaItemRow[], warnings: string[], blockers: string[]) {
  const byGroupId = new Map<string, SolutionItem[]>();

  for (const [index, row] of rows.entries()) {
    const groupId = ownerIdKey(row.group_id);
    const rowKey = asString(row.source_id) || `${asString(row.media_url) || 'row'}#${index + 1}`;
    if (!groupId) {
      blockers.push(`solution_media_items.${rowKey} is missing a valid group_id.`);
      continue;
    }

    const mediaUrl = asString(row.media_url);
    const rawFileType = asString(row.file_type).toLowerCase();
    if (!rawFileType) {
      blockers.push(`solution_media_items.${rowKey} is missing required file_type.`);
    } else if (rawFileType !== 'image' && rawFileType !== 'video') {
      warnings.push(`solution_media_items.${rowKey} has unsupported file_type "${rawFileType}"; file type was inferred for export.`);
    }

    if (!mediaUrl) {
      blockers.push(`solution_media_items.${rowKey} is missing required media_url.`);
    }

    const sortOrder = asNumber(row.sort_order, index + 1);
    const id = asString(row.source_id) || (mediaUrl ? `${mediaUrl}#${sortOrder}` : `row-${index + 1}`);
    if (!asString(row.source_id)) {
      warnings.push(`solution_media_items.${rowKey} has no source_id; item id was derived from mediaUrl and sortOrder for dry-run shape recovery.`);
    }

    const item: SolutionItem = {
      id,
      fileType: normalizeSolutionFileType(row.file_type, mediaUrl),
      mediaUrl,
      mediaFileName: asString(row.media_file_name),
      mediaDisplayName: asString(row.media_display_name),
      alt: asString(row.alt_text),
      caption: asString(row.caption),
      sortOrder,
      enabled: asMysqlBoolean(row.is_enabled, true),
      createdAt: toIsoString(row.created_at),
    };
    const items = byGroupId.get(groupId) ?? [];
    items.push(item);
    byGroupId.set(groupId, items);
  }

  for (const items of byGroupId.values()) {
    items.sort((left, right) => left.sortOrder - right.sortOrder);
  }

  return byGroupId;
}

function solutionGroupsFromRows(input: {
  groupRows: SolutionGroupRow[];
  itemsByGroupId: Map<string, SolutionItem[]>;
  warnings: string[];
  blockers: string[];
}) {
  const bySolutionId = new Map<string, SolutionGroup[]>();

  for (const [index, row] of input.groupRows.entries()) {
    const solutionId = ownerIdKey(row.solution_id);
    const groupMysqlId = ownerIdKey(row.mysql_id);
    const rowKey = asString(row.source_id) || asString(row.slug) || String(row.mysql_id ?? `row_${index + 1}`);

    if (!solutionId || !groupMysqlId) {
      input.blockers.push(`solution_groups.${rowKey} is missing a valid solution_id or id.`);
      continue;
    }

    const sourceId = asString(row.source_id);
    const title = asString(row.title);
    const slug = asString(row.slug);
    const sceneSlug = normalizeSolutionSceneSlug(row.scene_slug);

    if (!sourceId) {
      input.warnings.push(`solution_groups.${rowKey} has no source_id; group id was derived from slug for dry-run shape recovery.`);
    }

    if (!title || !slug || !sceneSlug) {
      input.blockers.push(`solution_groups.${rowKey} is missing required title, slug, or scene_slug.`);
    }

    const group: SolutionGroup = {
      id: sourceId || slug || `group-${groupMysqlId}`,
      title,
      slug,
      summary: asString(row.summary),
      sceneSlug: sceneSlug ?? 'other',
      sortOrder: asNumber(row.sort_order, index + 1),
      enabled: asMysqlBoolean(row.is_enabled, true),
      items: input.itemsByGroupId.get(groupMysqlId) ?? [],
      createdAt: toIsoString(row.created_at),
      updatedAt: toIsoString(row.updated_at),
    };

    const groups = bySolutionId.get(solutionId) ?? [];
    groups.push(group);
    bySolutionId.set(solutionId, groups);
  }

  for (const groups of bySolutionId.values()) {
    groups.sort((left, right) => left.sortOrder - right.sortOrder);
  }

  return bySolutionId;
}

function warnSolutionStringConflict(input: {
  warnings: string[];
  key: string;
  fieldName: string;
  rawValue: unknown;
  mysqlValue: unknown;
}): void {
  const rawValue = asString(input.rawValue);
  const mysqlValue = asString(input.mysqlValue);
  if (!rawValue || !mysqlValue || rawValue === mysqlValue) {
    return;
  }

  input.warnings.push(
    `solutions.${input.key} ${input.fieldName} differs between raw_json and split MySQL rows; raw_json shape was preserved.`,
  );
}

function warnSolutionNumberConflict(input: {
  warnings: string[];
  key: string;
  fieldName: string;
  rawValue: unknown;
  mysqlValue: unknown;
}): void {
  if (input.rawValue === undefined || input.mysqlValue === undefined || input.mysqlValue === null) {
    return;
  }

  const rawValue = asNumber(input.rawValue, Number.NaN);
  const mysqlValue = asNumber(input.mysqlValue, Number.NaN);
  if (!Number.isFinite(rawValue) || !Number.isFinite(mysqlValue) || rawValue === mysqlValue) {
    return;
  }

  input.warnings.push(
    `solutions.${input.key} ${input.fieldName} differs between raw_json and split MySQL rows; raw_json shape was preserved.`,
  );
}

function warnSolutionBooleanConflict(input: {
  warnings: string[];
  key: string;
  fieldName: string;
  rawValue: unknown;
  mysqlValue: boolean;
}): void {
  if (typeof input.rawValue !== 'boolean' || input.rawValue === input.mysqlValue) {
    return;
  }

  input.warnings.push(
    `solutions.${input.key} ${input.fieldName} differs between raw_json and split MySQL rows; raw_json shape was preserved.`,
  );
}

function rawRecordList(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function warnSolutionItemDifferences(input: {
  warnings: string[];
  key: string;
  rawItems: Record<string, unknown>[];
  mysqlItems: SolutionItem[];
}): void {
  if (input.rawItems.length === 0 && input.mysqlItems.length === 0) {
    return;
  }

  if (input.rawItems.length === 0 && input.mysqlItems.length > 0) {
    input.warnings.push(`solutions.${input.key} has no raw_json items; active solution_media_items rows were exported.`);
    return;
  }

  if (input.rawItems.length > 0 && input.mysqlItems.length === 0) {
    input.warnings.push(`solutions.${input.key} has raw_json items but no active solution_media_items rows; raw_json items were preserved.`);
    return;
  }

  if (input.rawItems.length !== input.mysqlItems.length) {
    input.warnings.push(
      `solutions.${input.key} item count (${input.rawItems.length}) differs from active solution_media_items count (${input.mysqlItems.length}); raw_json items were preserved.`,
    );
  }

  const rawByKey = buildRecordMapByStableKey(input.rawItems, solutionItemStableKey);
  const mysqlByKey = buildRecordMapByStableKey(input.mysqlItems as unknown as Record<string, unknown>[], solutionItemStableKey);

  for (const [itemKey, rawItem] of rawByKey.entries()) {
    const mysqlItem = mysqlByKey.get(itemKey);
    if (!mysqlItem) {
      input.warnings.push(`solutions.${input.key} raw_json item ${itemKey} has no matching active solution_media_items row.`);
      continue;
    }

    for (const fieldName of ['fileType', 'mediaUrl', 'mediaFileName', 'mediaDisplayName', 'alt', 'caption'] as const) {
      warnSolutionStringConflict({
        warnings: input.warnings,
        key: `${input.key}.${itemKey}`,
        fieldName,
        rawValue: rawItem[fieldName],
        mysqlValue: mysqlItem[fieldName],
      });
    }
    warnSolutionNumberConflict({
      warnings: input.warnings,
      key: `${input.key}.${itemKey}`,
      fieldName: 'sortOrder',
      rawValue: rawItem.sortOrder,
      mysqlValue: mysqlItem.sortOrder,
    });
    warnSolutionBooleanConflict({
      warnings: input.warnings,
      key: `${input.key}.${itemKey}`,
      fieldName: 'enabled',
      rawValue: rawItem.enabled,
      mysqlValue: asMysqlBoolean(mysqlItem.enabled, true),
    });
  }

  for (const itemKey of mysqlByKey.keys()) {
    if (!rawByKey.has(itemKey)) {
      input.warnings.push(`solutions.${input.key} active solution_media_items row ${itemKey} is missing from raw_json items.`);
    }
  }
}

function warnSolutionGroupDifferences(input: {
  warnings: string[];
  sceneKey: string;
  rawGroups: Record<string, unknown>[];
  mysqlGroups: SolutionGroup[];
}): void {
  if (input.rawGroups.length === 0 && input.mysqlGroups.length === 0) {
    return;
  }

  if (input.rawGroups.length === 0 && input.mysqlGroups.length > 0) {
    input.warnings.push(`solutions.${input.sceneKey} has no raw_json groups; active solution_groups rows were exported.`);
    return;
  }

  if (input.rawGroups.length > 0 && input.mysqlGroups.length === 0) {
    input.warnings.push(`solutions.${input.sceneKey} has raw_json groups but no active solution_groups rows; raw_json groups were preserved.`);
    return;
  }

  if (input.rawGroups.length !== input.mysqlGroups.length) {
    input.warnings.push(
      `solutions.${input.sceneKey} group count (${input.rawGroups.length}) differs from active solution_groups count (${input.mysqlGroups.length}); raw_json groups were preserved.`,
    );
  }

  const rawByKey = buildRecordMapByStableKey(input.rawGroups, solutionGroupStableKey);
  const mysqlByKey = buildRecordMapByStableKey(input.mysqlGroups as unknown as Record<string, unknown>[], solutionGroupStableKey);

  for (const [groupKey, rawGroup] of rawByKey.entries()) {
    const mysqlGroup = mysqlByKey.get(groupKey);
    if (!mysqlGroup) {
      input.warnings.push(`solutions.${input.sceneKey} raw_json group ${groupKey} has no matching active solution_groups row.`);
      continue;
    }

    for (const fieldName of ['title', 'slug', 'summary', 'sceneSlug'] as const) {
      warnSolutionStringConflict({
        warnings: input.warnings,
        key: `${input.sceneKey}.${groupKey}`,
        fieldName,
        rawValue: rawGroup[fieldName],
        mysqlValue: mysqlGroup[fieldName],
      });
    }
    warnSolutionNumberConflict({
      warnings: input.warnings,
      key: `${input.sceneKey}.${groupKey}`,
      fieldName: 'sortOrder',
      rawValue: rawGroup.sortOrder,
      mysqlValue: mysqlGroup.sortOrder,
    });
    warnSolutionBooleanConflict({
      warnings: input.warnings,
      key: `${input.sceneKey}.${groupKey}`,
      fieldName: 'enabled',
      rawValue: rawGroup.enabled,
      mysqlValue: asMysqlBoolean(mysqlGroup.enabled, true),
    });

    warnSolutionItemDifferences({
      warnings: input.warnings,
      key: `${input.sceneKey}.${groupKey}`,
      rawItems: rawRecordList(rawGroup.items),
      mysqlItems: Array.isArray(mysqlGroup.items) ? mysqlGroup.items : [],
    });
  }

  for (const groupKey of mysqlByKey.keys()) {
    if (!rawByKey.has(groupKey)) {
      input.warnings.push(`solutions.${input.sceneKey} active solution_groups row ${groupKey} is missing from raw_json groups.`);
    }
  }
}

function validateSolutionSceneSet(scenes: SolutionScene[], blockers: string[]): void {
  if (scenes.length !== solutionSceneSlugs.length) {
    blockers.push(`solutions export restored ${scenes.length} active scenes; expected fixed ${solutionSceneSlugs.length} scene structure.`);
  }

  const seenSlugs = new Set<SolutionSceneSlug>();
  for (const scene of scenes) {
    if (seenSlugs.has(scene.slug)) {
      blockers.push(`solutions export restored duplicate scene "${scene.slug}".`);
    }
    seenSlugs.add(scene.slug);
  }

  for (const slug of solutionSceneSlugs) {
    if (!seenSlugs.has(slug)) {
      blockers.push(`solutions export is missing fixed scene "${slug}".`);
    }
  }
}

function validateSolutionVideoRules(scenes: SolutionScene[], blockers: string[]): void {
  for (const scene of scenes) {
    for (const group of scene.groups) {
      const items = Array.isArray(group.items) ? group.items : [];
      if (scene.slug === 'video-digital-assets') {
        if (items.length > 1) {
          blockers.push(`solutions.video-digital-assets group "${group.slug || group.id}" has more than one active item.`);
        }
        continue;
      }

      if (items.some((item) => item.fileType === 'video')) {
        blockers.push(`solutions.${scene.slug} group "${group.slug || group.id}" contains a video item outside video-digital-assets.`);
      }
    }
  }
}

function validateSolutionSplitVideoRules(groupsBySolutionId: Map<string, SolutionGroup[]>, blockers: string[]): void {
  for (const groups of groupsBySolutionId.values()) {
    for (const group of groups) {
      const items = Array.isArray(group.items) ? group.items : [];
      if (group.sceneSlug === 'video-digital-assets') {
        if (items.length > 1) {
          blockers.push(`solution_groups.${group.slug || group.id} has more than one active split item for video-digital-assets.`);
        }
        continue;
      }

      if (items.some((item) => item.fileType === 'video')) {
        blockers.push(`solution_groups.${group.slug || group.id} has an active video split item outside video-digital-assets.`);
      }
    }
  }
}

function buildSolutionSceneFromMysql(input: {
  row: SolutionRow;
  rawRecord: Record<string, unknown>;
  mysqlGroups: SolutionGroup[];
  index: number;
  warnings: string[];
  blockers: string[];
}): SolutionScene {
  const { row, rawRecord, mysqlGroups, index, warnings, blockers } = input;
  const rawSlug = normalizeSolutionSceneSlug(rawRecord.slug);
  const mysqlSlug = normalizeSolutionSceneSlug(row.slug);
  const slug = rawSlug ?? mysqlSlug;
  const key = slug ?? solutionRowKey(row, index);
  const rawEnabledFallback = typeof rawRecord.enabled === 'boolean' ? rawRecord.enabled : true;
  const mysqlEnabled = solutionStatusToEnabled(row.status, rawEnabledFallback);
  const rawGroupsValue = rawRecord.groups;
  const rawGroups = rawRecordList(rawGroupsValue);
  const groups = Array.isArray(rawGroupsValue) ? rawGroupsValue as SolutionGroup[] : mysqlGroups;

  if (!slug) {
    blockers.push(`solutions.${solutionRowKey(row, index)} cannot restore required scene slug.`);
  }

  if (!pickString(rawRecord, ['name', 'title']) && !asString(row.title)) {
    blockers.push(`solutions.${solutionRowKey(row, index)} cannot restore required scene name/title.`);
  }

  if (!Array.isArray(rawGroupsValue) && mysqlGroups.length > 0) {
    warnings.push(`solutions.${key} raw_json has no groups array; active split groups were used for dry-run export.`);
  }

  if (Array.isArray(rawGroupsValue)) {
    warnSolutionGroupDifferences({
      warnings,
      sceneKey: key,
      rawGroups,
      mysqlGroups,
    });
  }

  warnSolutionStringConflict({
    warnings,
    key,
    fieldName: 'slug',
    rawValue: rawRecord.slug,
    mysqlValue: row.slug,
  });
  warnSolutionStringConflict({
    warnings,
    key,
    fieldName: 'name/title',
    rawValue: rawRecord.name ?? rawRecord.title,
    mysqlValue: row.title,
  });
  warnSolutionStringConflict({
    warnings,
    key,
    fieldName: 'description/summary',
    rawValue: rawRecord.description ?? rawRecord.summary,
    mysqlValue: row.summary,
  });
  warnSolutionNumberConflict({
    warnings,
    key,
    fieldName: 'sortOrder',
    rawValue: rawRecord.sortOrder ?? rawRecord.sort_order,
    mysqlValue: row.sort_order,
  });
  warnSolutionBooleanConflict({
    warnings,
    key,
    fieldName: 'enabled/status',
    rawValue: rawRecord.enabled,
    mysqlValue: mysqlEnabled,
  });

  return {
    slug: slug ?? 'other',
    name: pickString(rawRecord, ['name', 'title']) || asString(row.title),
    description: pickString(rawRecord, ['description', 'summary']) || asString(row.summary),
    sortOrder: pickNumber(rawRecord, ['sortOrder', 'sort_order'], asNumber(row.sort_order, index + 1)),
    enabled: typeof rawRecord.enabled === 'boolean' ? rawRecord.enabled : mysqlEnabled,
    groups,
  };
}

async function tableColumnExists(tableName: string, columnName: string): Promise<boolean> {
  const [rows] = await getDbPool().query<(RowDataPacket & { count: unknown })[]>(
    `SELECT COUNT(*) AS count
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?`,
    [tableName, columnName],
  );

  return asNumber(rows[0]?.count, 0) > 0;
}

function emptyExportResult(input: {
  definition: ExportModuleDefinition;
  status: MysqlExportReadResult['status'];
  implemented: boolean;
  warnings?: string[];
  blockers?: string[];
}): MysqlExportReadResult {
  return {
    moduleName: input.definition.moduleName,
    implemented: input.implemented,
    status: input.status,
    data: null,
    recordCount: 0,
    warnings: input.warnings ?? [],
    blockers: input.blockers ?? [],
  };
}

async function readContactInfoExport(definition: ExportModuleDefinition): Promise<MysqlExportReadResult> {
  const [rows] = await getDbPool().query<ContactInfoRow[]>(
    `SELECT content_json, is_enabled
     FROM contact_info
     WHERE singleton_key = ? AND deleted_at IS NULL
     ORDER BY is_enabled DESC, updated_at DESC, id DESC
     LIMIT 1`,
    ['contact_info'],
  );

  const row = rows[0];
  if (!row) {
    return emptyExportResult({
      definition,
      status: 'shape_risk',
      implemented: true,
      blockers: ['No active contact_info singleton row was found.'],
    });
  }

  let content: unknown;
  try {
    content = parseJsonColumn(row.content_json);
  } catch (error) {
    return emptyExportResult({
      definition,
      status: 'shape_risk',
      implemented: true,
      blockers: [
        `contact_info.content_json could not be parsed: ${error instanceof Error ? error.message : 'invalid JSON'}.`,
      ],
    });
  }

  if (!isRecord(content)) {
    return emptyExportResult({
      definition,
      status: 'shape_risk',
      implemented: true,
      blockers: ['contact_info.content_json is not an object, so contact-info.json shape cannot be restored.'],
    });
  }

  return {
    moduleName: definition.moduleName,
    implemented: true,
    status: 'exported',
    data: content,
    recordCount: 1,
    warnings: asMysqlBoolean(row.is_enabled, true)
      ? []
      : ['contact_info row is disabled; exported content_json is still reported for dry-run comparison.'],
    blockers: [],
  };
}

async function readCompanyAssetsExport(definition: ExportModuleDefinition): Promise<MysqlExportReadResult> {
  const [rows] = await getDbPool().query<CompanyAssetRow[]>(
    `SELECT asset_key, media_url, alt_text, description, sort_order, is_enabled, raw_json
     FROM company_assets
     WHERE deleted_at IS NULL
     ORDER BY sort_order ASC, asset_key ASC`,
  );
  const warnings: string[] = [];
  const blockers: string[] = [];
  const assets = rows.map((row, index) => {
    let rawJson: unknown;
    try {
      rawJson = parseJsonColumn(row.raw_json);
    } catch (error) {
      rawJson = undefined;
      warnings.push(
        `company_assets.${asString(row.asset_key) || `row_${index + 1}`} raw_json could not be parsed: ${
          error instanceof Error ? error.message : 'invalid JSON'
        }.`,
      );
    }

    const rawRecord = isRecord(rawJson) ? rawJson : {};
    const assetKey = asString(row.asset_key) || pickString(rawRecord, ['id', 'assetKey', 'asset_key']);
    const mediaUrl = asString(row.media_url) || pickString(rawRecord, ['imageUrl', 'image_url', 'mediaUrl', 'media_url']);
    const imageAlt = asString(row.alt_text) || pickString(rawRecord, ['imageAlt', 'image_alt', 'altText', 'alt_text']);
    const description = asString(row.description) || pickString(rawRecord, ['description', 'summary']);
    const sortOrder = asNumber(row.sort_order, pickNumber(rawRecord, ['sortOrder', 'sort_order'], index + 1));
    const enabled = asMysqlBoolean(row.is_enabled, pickBoolean(rawRecord, ['enabled', 'isEnabled', 'is_enabled'], true));

    const asset = {
      ...rawRecord,
      id: pickString(rawRecord, ['id', 'assetKey', 'asset_key']) || assetKey,
      title: pickString(rawRecord, ['title']),
      summary: pickString(rawRecord, ['summary']),
      description,
      location: pickString(rawRecord, ['location']),
      imageUrl: mediaUrl,
      imageAlt,
      sortOrder,
      enabled,
    };

    if (!isRecord(rawJson)) {
      warnings.push(`company_assets.${assetKey || `row_${index + 1}`} has no usable raw_json; only table fields were available.`);
    }

    const missingCoreFields = ['id', 'title', 'summary', 'description', 'location']
      .filter((fieldName) => !asString(asset[fieldName as keyof typeof asset]));

    if (missingCoreFields.length > 0) {
      blockers.push(
        `company_assets.${assetKey || `row_${index + 1}`} cannot fully restore core JSON fields: ${missingCoreFields.join(', ')}.`,
      );
    }

    if (!mediaUrl || !imageAlt) {
      warnings.push(`company_assets.${assetKey || `row_${index + 1}`} has incomplete media fields; this is a dry-run warning only.`);
    }

    return asset;
  });

  return {
    moduleName: definition.moduleName,
    implemented: true,
    status: blockers.length > 0 ? 'shape_risk' : 'exported',
    data: assets,
    recordCount: rows.length,
    warnings,
    blockers,
  };
}

async function readHomeVideoExport(definition: ExportModuleDefinition): Promise<MysqlExportReadResult> {
  const [rows] = await getDbPool().query<HomeVideoRow[]>(
    `SELECT
       hv.video_media_id,
       hv.poster_media_id,
       hv.video_url,
       hv.poster_url,
       hv.title,
       hv.description,
       hv.is_enabled,
       hv.updated_at,
       video_media.file_name AS video_file_name,
       video_media.original_name AS video_original_name,
       poster_media.file_name AS poster_file_name,
       poster_media.original_name AS poster_original_name
     FROM home_video hv
     LEFT JOIN media_files video_media ON video_media.id = hv.video_media_id AND video_media.deleted_at IS NULL
     LEFT JOIN media_files poster_media ON poster_media.id = hv.poster_media_id AND poster_media.deleted_at IS NULL
     WHERE hv.singleton_key = ? AND hv.deleted_at IS NULL
     ORDER BY hv.is_enabled DESC, hv.updated_at DESC, hv.id DESC
     LIMIT 1`,
    ['home_video'],
  );

  const row = rows[0];
  if (!row) {
    return emptyExportResult({
      definition,
      status: 'shape_risk',
      implemented: true,
      blockers: ['No active home_video singleton row was found.'],
    });
  }

  const warnings: string[] = [];
  const videoUrl = asString(row.video_url);
  const posterUrl = asString(row.poster_url);
  const videoFileName = asString(row.video_file_name) || fileNameFromUrl(videoUrl);
  const posterFileName = asString(row.poster_file_name) || fileNameFromUrl(posterUrl);

  if (row.video_media_id && !asString(row.video_file_name)) {
    warnings.push('home_video.video_media_id has no active media_files row; videoFileName was derived from video_url.');
  }

  if (row.poster_media_id && !asString(row.poster_file_name)) {
    warnings.push('home_video.poster_media_id has no active media_files row; posterFileName was derived from poster_url.');
  }

  return {
    moduleName: definition.moduleName,
    implemented: true,
    status: 'exported',
    data: {
      videoUrl,
      videoFileName,
      videoDisplayName: asString(row.video_original_name),
      posterUrl,
      posterFileName,
      posterDisplayName: asString(row.poster_original_name),
      title: asString(row.title),
      description: asString(row.description),
      enabled: asMysqlBoolean(row.is_enabled, true),
      updatedAt: toIsoString(row.updated_at),
    },
    recordCount: 1,
    warnings,
    blockers: [],
  };
}

function createDefaultInteractiveSlots() {
  return Array.from({ length: 12 }, (_, index) => ({
    slotNo: index + 1,
    mediaUrl: '',
    mediaFileName: '',
    alt: '',
    sortOrder: index + 1,
    enabled: true,
  }));
}

async function readHomeInteractiveImagesExport(definition: ExportModuleDefinition): Promise<MysqlExportReadResult> {
  const [rows] = await getDbPool().query<HomeInteractiveImageRow[]>(
    `SELECT
       slots.slot_number,
       slots.media_id,
       slots.image_url,
       slots.alt_text,
       slots.sort_order,
       slots.is_enabled,
       media_files.file_name AS media_file_name
     FROM home_interactive_images slots
     LEFT JOIN media_files ON media_files.id = slots.media_id AND media_files.deleted_at IS NULL
     WHERE slots.deleted_at IS NULL
     ORDER BY slots.slot_number ASC, slots.sort_order ASC`,
  );
  const warnings: string[] = [];
  const slots = createDefaultInteractiveSlots();
  const seenSlots = new Set<number>();

  if (rows.length !== 12) {
    warnings.push(`home_interactive_images has ${rows.length} active rows; expected exactly 12.`);
  }

  for (const row of rows) {
    const slotNo = asNumber(row.slot_number, -1);

    if (!Number.isInteger(slotNo) || slotNo < 1 || slotNo > 12) {
      warnings.push(`home_interactive_images contains invalid slot_number "${String(row.slot_number)}"; it was not exported.`);
      continue;
    }

    if (seenSlots.has(slotNo)) {
      warnings.push(`home_interactive_images contains duplicate slot_number "${slotNo}"; first row was kept.`);
      continue;
    }

    seenSlots.add(slotNo);
    const mediaUrl = asString(row.image_url);

    if (row.media_id && !asString(row.media_file_name)) {
      warnings.push(`home_interactive_images slot ${slotNo} has no active media_files row; mediaFileName was derived from image_url.`);
    }

    slots[slotNo - 1] = {
      slotNo,
      mediaUrl,
      mediaFileName: asString(row.media_file_name) || fileNameFromUrl(mediaUrl),
      alt: asString(row.alt_text),
      sortOrder: asNumber(row.sort_order, slotNo),
      enabled: asMysqlBoolean(row.is_enabled, true),
    };
  }

  return {
    moduleName: definition.moduleName,
    implemented: true,
    status: 'exported',
    data: slots,
    recordCount: rows.length,
    warnings,
    blockers: [],
  };
}

function articleKey(row: ArticleRow, index: number): string {
  return asString(row.source_id) || asString(row.slug) || String(row.mysql_id ?? `row_${index + 1}`);
}

function parseArticleRawJson(input: {
  row: ArticleRow;
  index: number;
  warnings: string[];
  blockers: string[];
}): Record<string, unknown> {
  const rawValue = input.row.raw_json;
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return {};
  }

  try {
    const parsed = parseJsonColumn(rawValue);
    if (isRecord(parsed)) {
      return parsed;
    }

    input.warnings.push(`articles.${articleKey(input.row, input.index)} raw_json is not an object; table fields were used.`);
    return {};
  } catch (error) {
    input.blockers.push(
      `articles.${articleKey(input.row, input.index)} raw_json could not be parsed: ${
        error instanceof Error ? error.message : 'invalid JSON'
      }.`,
    );
    return {};
  }
}

function buildArticleFromMysql(input: {
  row: ArticleRow;
  rawRecord: Record<string, unknown>;
  seo?: ArticleSeoRow;
  faqItems: ArticleFaqItem[];
  index: number;
  warnings: string[];
  blockers: string[];
}): Article {
  const { row, rawRecord, seo, faqItems, index, warnings, blockers } = input;
  const sourceId = asString(row.source_id);
  const slug = asString(row.slug) || pickString(rawRecord, ['slug']);
  const rawCategory = asString(row.category_slug)
    || asString(row.category_join_slug)
    || pickString(rawRecord, ['category', 'categorySlug', 'category_slug']);
  const rawStatus = asString(row.status) || pickString(rawRecord, ['status']);
  const category = normalizeArticleCategory(rawCategory);
  const status = normalizeArticleStatus(rawStatus);
  const title = asString(row.title) || pickString(rawRecord, ['title']);
  const content = asString(row.content) || pickString(rawRecord, ['content', 'contentHtml', 'content_html', 'body']);
  const rawFaqFallback = rawArticleFaqItems(rawRecord);
  const outputFaqItems = faqItems.length > 0 ? faqItems : rawFaqFallback;
  const seoTitle = asString(seo?.title) || pickString(rawRecord, ['seoTitle', 'seo_title']);
  const seoDescription = asString(seo?.description) || pickString(rawRecord, ['seoDescription', 'seo_description']);
  const keywords = asString(seo?.keywords) || pickString(rawRecord, ['keywords']);
  const key = sourceId || slug || String(row.mysql_id ?? `row_${index + 1}`);

  if (!title) {
    blockers.push(`articles.${key} cannot restore required field: title.`);
  }

  if (!slug) {
    blockers.push(`articles.${key} cannot restore required field: slug.`);
  }

  if (!rawCategory || !category) {
    blockers.push(`articles.${key} has unsupported or missing category "${rawCategory}".`);
  }

  if (!rawStatus || !status) {
    blockers.push(`articles.${key} has unsupported or missing status "${rawStatus}".`);
  }

  if (!content) {
    blockers.push(`articles.${key} cannot restore required field: content.`);
  }

  if (!seoTitle && !seoDescription && !keywords) {
    warnings.push(
      seo
        ? `articles.${key} has an empty article seo_settings row; SEO fields were reconstructed from raw_json or left empty.`
        : `articles.${key} has no matching article seo_settings row; SEO fields were reconstructed from raw_json or left empty.`,
    );
  }

  if (faqItems.length === 0 && rawFaqFallback.length > 0) {
    warnings.push(`articles.${key} has no matching active faq_items rows; FAQ fields were reconstructed from raw_json.`);
  }

  return {
    id: sourceId || pickString(rawRecord, ['id', 'sourceId', 'source_id']) || slug || String(row.mysql_id ?? index + 1),
    title,
    slug,
    category: (category ?? rawCategory) as ArticleCategory,
    summary: asString(row.summary) || pickString(rawRecord, ['summary', 'excerpt', 'description']),
    content,
    sortOrder: asNumber(row.sort_order, pickNumber(rawRecord, ['sortOrder', 'sort_order'], index + 1)),
    status: (status ?? rawStatus) as ArticleStatus,
    seoTitle,
    seoDescription,
    keywords,
    faqItems: outputFaqItems,
    createdAt: toIsoString(row.created_at) || pickString(rawRecord, ['createdAt', 'created_at']),
    updatedAt: toIsoString(row.updated_at) || pickString(rawRecord, ['updatedAt', 'updated_at']),
  };
}

async function readArticlesExport(definition: ExportModuleDefinition): Promise<MysqlExportReadResult> {
  const hasRawJsonColumn = await tableColumnExists('articles', 'raw_json');
  const rawJsonSelect = hasRawJsonColumn ? 'a.raw_json' : 'NULL AS raw_json';
  const [articleRows] = await getDbPool().query<ArticleRow[]>(
    `SELECT
       a.id AS mysql_id,
       a.source_id,
       a.title,
       a.slug,
       a.summary,
       a.content,
       COALESCE(a.category_slug, c.slug) AS category_slug,
       c.slug AS category_join_slug,
       c.name AS category_name,
       a.status,
       a.sort_order,
       a.published_at,
       a.created_at,
       a.updated_at,
       ${rawJsonSelect}
     FROM articles a
     LEFT JOIN article_categories c
       ON c.id = a.category_id
      AND c.deleted_at IS NULL
     WHERE a.deleted_at IS NULL
     ORDER BY a.sort_order ASC, a.updated_at DESC, a.id ASC`,
  );

  const warnings: string[] = [];
  const blockers: string[] = [];

  if (!hasRawJsonColumn) {
    warnings.push(
      'articles.raw_json column is absent; articles are reconstructed from articles, article_categories, seo_settings, and faq_items.',
    );
  }

  const [seoRows] = await getDbPool().query<ArticleSeoRow[]>(
    `SELECT owner_source_id, owner_id, title, description, keywords
     FROM seo_settings
     WHERE owner_type = 'article'
       AND deleted_at IS NULL`,
  );
  const [faqRows] = await getDbPool().query<ArticleFaqRow[]>(
    `SELECT owner_source_id, owner_id, question, answer, sort_order, status
     FROM faq_items
     WHERE owner_type = 'article'
       AND deleted_at IS NULL
     ORDER BY sort_order ASC, id ASC`,
  );
  const seoLookup = buildArticleSeoLookup(seoRows);
  const faqLookup = buildArticleFaqLookup(faqRows);
  let missingRawJsonCount = 0;

  const articles = articleRows.map((row, index) => {
    const rawRecord = parseArticleRawJson({ row, index, warnings, blockers });
    if (!isRecord(rawRecord) || Object.keys(rawRecord).length === 0) {
      missingRawJsonCount += 1;
    }

    const ownerSourceId = asString(row.source_id) || asString(row.slug) || pickString(rawRecord, ['id', 'slug']);
    const slug = asString(row.slug) || pickString(rawRecord, ['slug']);
    const seo = findArticleSeo({
      lookupByOwnerId: seoLookup.byOwnerId,
      lookupByOwnerSourceId: seoLookup.byOwnerSourceId,
      mysqlId: row.mysql_id,
      ownerSourceId,
      slug,
    });
    const ownerFaqRows = findArticleFaqRows({
      lookupByOwnerId: faqLookup.byOwnerId,
      lookupByOwnerSourceId: faqLookup.byOwnerSourceId,
      mysqlId: row.mysql_id,
      ownerSourceId,
      slug,
    });

    return buildArticleFromMysql({
      row,
      rawRecord,
      seo,
      faqItems: toArticleFaqItems(ownerFaqRows),
      index,
      warnings,
      blockers,
    });
  });

  if (hasRawJsonColumn && missingRawJsonCount > 0) {
    warnings.push(
      `articles.raw_json is missing or unusable for ${missingRawJsonCount} active rows; normalized table fields were used for those rows.`,
    );
  }

  if (articleRows.length === 0) {
    blockers.push('No active articles rows were found.');
  }

  return {
    moduleName: definition.moduleName,
    implemented: true,
    status: blockers.length > 0 ? 'shape_risk' : 'exported',
    data: articles,
    recordCount: articleRows.length,
    warnings,
    blockers,
  };
}

function caseKey(row: CaseRow, index: number): string {
  return asString(row.source_id) || asString(row.slug) || String(row.mysql_id ?? `row_${index + 1}`);
}

function parseCaseRawJson(input: {
  row: CaseRow;
  index: number;
  warnings: string[];
  blockers: string[];
}): Record<string, unknown> {
  const rawValue = input.row.raw_json;
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return {};
  }

  try {
    const parsed = parseJsonColumn(rawValue);
    if (isRecord(parsed)) {
      return parsed;
    }

    input.warnings.push(`cases.${caseKey(input.row, input.index)} raw_json is not an object; table fields were used.`);
    return {};
  } catch (error) {
    input.blockers.push(
      `cases.${caseKey(input.row, input.index)} raw_json could not be parsed: ${
        error instanceof Error ? error.message : 'invalid JSON'
      }.`,
    );
    return {};
  }
}

function warnCaseFieldConflict(input: {
  warnings: string[];
  key: string;
  fieldName: string;
  rawValue: unknown;
  mysqlValue: unknown;
}): void {
  const rawValue = asString(input.rawValue);
  const mysqlValue = asString(input.mysqlValue);

  if (!rawValue || !mysqlValue || rawValue === mysqlValue) {
    return;
  }

  input.warnings.push(
    `cases.${input.key} ${input.fieldName} differs between raw_json and the cases table; the table value was exported.`,
  );
}

function warnCaseImageDifferences(input: {
  warnings: string[];
  key: string;
  rawImages: CaseExtractedImage[];
  mysqlImages: CaseExtractedImage[];
}): void {
  if (input.rawImages.length === 0 && input.mysqlImages.length === 0) {
    return;
  }

  if (input.rawImages.length === 0 && input.mysqlImages.length > 0) {
    input.warnings.push(
      `cases.${input.key} has no raw_json extractedImages; case_images rows were used and fileName values were derived from image_url.`,
    );
    return;
  }

  if (input.rawImages.length > 0 && input.mysqlImages.length === 0) {
    input.warnings.push(`cases.${input.key} has raw_json extractedImages but no active case_images rows; raw_json images were preserved.`);
    return;
  }

  if (input.rawImages.length !== input.mysqlImages.length) {
    input.warnings.push(
      `cases.${input.key} extractedImages count (${input.rawImages.length}) differs from active case_images count (${input.mysqlImages.length}); raw_json images were preserved.`,
    );
  }

  const mysqlByUrl = new Map(input.mysqlImages.map((image) => [image.url, image]));
  const rawByUrl = new Map(input.rawImages.map((image) => [image.url, image]));

  for (const rawImage of input.rawImages) {
    const mysqlImage = mysqlByUrl.get(rawImage.url);
    if (!mysqlImage) {
      input.warnings.push(`cases.${input.key} raw_json image "${rawImage.url}" has no matching active case_images row.`);
      continue;
    }

    if (rawImage.alt && mysqlImage.alt && rawImage.alt !== mysqlImage.alt) {
      input.warnings.push(`cases.${input.key} image "${rawImage.url}" alt differs between raw_json and case_images.`);
    }

    if (rawImage.sortOrder !== mysqlImage.sortOrder) {
      input.warnings.push(`cases.${input.key} image "${rawImage.url}" sortOrder differs between raw_json and case_images.`);
    }
  }

  for (const mysqlImage of input.mysqlImages) {
    if (!rawByUrl.has(mysqlImage.url)) {
      input.warnings.push(`cases.${input.key} active case_images row "${mysqlImage.url}" is missing from raw_json extractedImages.`);
    }
  }
}

function buildCaseFromMysql(input: {
  row: CaseRow;
  rawRecord: Record<string, unknown>;
  imageRows: CaseImageRow[];
  seo?: CaseSeoRow;
  faqRows: CaseFaqRow[];
  index: number;
  warnings: string[];
  blockers: string[];
}): CaseStudy {
  const { row, rawRecord, imageRows, seo, faqRows, index, warnings, blockers } = input;
  const sourceId = asString(row.source_id);
  const slug = asString(row.slug) || pickString(rawRecord, ['slug']);
  const title = asString(row.title) || pickString(rawRecord, ['title']);
  const id = sourceId || pickString(rawRecord, ['id', 'sourceId', 'source_id']) || slug || String(row.mysql_id ?? '');
  const rawStatus = asString(row.status) || pickString(rawRecord, ['status']);
  const status = normalizeCaseStatus(rawStatus);
  const key = id || slug || String(row.mysql_id ?? `row_${index + 1}`);
  const rawImages = rawCaseImages(rawRecord);
  const caseImageItems = mysqlCaseImages(imageRows);
  const rawFaqItems = rawCaseFaqItems(rawRecord);
  const caseFaqItems = toCaseFaqItems(faqRows);
  const coverUrl = asString(row.cover_url) || pickString(rawRecord, ['coverUrl', 'cover_url']);
  const coverFileName = asString(row.cover_file_name)
    || pickString(rawRecord, ['coverFileName', 'cover_file_name'])
    || fileNameFromUrl(coverUrl);
  const seoTitle = asString(seo?.title) || pickString(rawRecord, ['seoTitle', 'seo_title']);
  const seoDescription = asString(seo?.description) || pickString(rawRecord, ['seoDescription', 'seo_description']);
  const keywords = asString(seo?.keywords) || pickString(rawRecord, ['keywords']);

  if (!id) {
    blockers.push(`cases.${key} cannot restore required field: id.`);
  }

  if (!title) {
    blockers.push(`cases.${key} cannot restore required field: title.`);
  }

  if (!slug) {
    blockers.push(`cases.${key} cannot restore required field: slug.`);
  }

  if (!rawStatus || !status) {
    blockers.push(`cases.${key} has unsupported or missing status "${rawStatus}".`);
  }

  for (const [fieldName, rawValue, mysqlValue] of [
    ['title', rawRecord.title, row.title],
    ['slug', rawRecord.slug, row.slug],
    ['summary', rawRecord.summary, row.summary],
    ['clientType', rawRecord.clientType ?? rawRecord.client_type, row.client_type],
    ['eventType', rawRecord.eventType ?? rawRecord.event_type, row.event_type],
    ['eventDate', rawRecord.eventDate ?? rawRecord.event_date, row.event_date],
    ['location', rawRecord.location, row.location],
    ['coverUrl', rawRecord.coverUrl ?? rawRecord.cover_url, row.cover_url],
    ['coverFileName', rawRecord.coverFileName ?? rawRecord.cover_file_name, row.cover_file_name],
    ['coverDisplayName', rawRecord.coverDisplayName ?? rawRecord.cover_display_name, row.cover_display_name],
    ['wordFileName', rawRecord.wordFileName ?? rawRecord.word_file_name, row.word_file_name],
    ['wordOriginalName', rawRecord.wordOriginalName ?? rawRecord.word_original_name, row.word_original_name],
    ['contentHtml', rawRecord.contentHtml ?? rawRecord.content_html, row.content_html],
    ['contentText', rawRecord.contentText ?? rawRecord.content_text, row.content_text],
    ['status', rawRecord.status, row.status],
  ] as const) {
    warnCaseFieldConflict({ warnings, key, fieldName, rawValue, mysqlValue });
  }

  warnCaseImageDifferences({
    warnings,
    key,
    rawImages,
    mysqlImages: caseImageItems,
  });

  if (caseFaqItems.length === 0 && rawFaqItems.length > 0) {
    warnings.push(`cases.${key} has no matching active faq_items rows; FAQ fields were reconstructed from raw_json.`);
  }

  if (caseFaqItems.length > 0 && rawFaqItems.length === 0) {
    warnings.push(`cases.${key} has active faq_items rows while raw_json has no faqItems; MySQL FAQ rows were exported.`);
  }

  if (!seoTitle && !seoDescription && !keywords && seo) {
    warnings.push(`cases.${key} has an empty case seo_settings row; SEO fields were reconstructed from raw_json or left empty.`);
  }

  return {
    id,
    title,
    slug,
    summary: asString(row.summary) || pickString(rawRecord, ['summary']),
    clientType: asString(row.client_type) || pickString(rawRecord, ['clientType', 'client_type']),
    eventType: asString(row.event_type) || pickString(rawRecord, ['eventType', 'event_type']),
    eventDate: toDateFieldString(row.event_date) || pickString(rawRecord, ['eventDate', 'event_date']),
    location: asString(row.location) || pickString(rawRecord, ['location']),
    coverUrl,
    coverFileName,
    coverDisplayName: asString(row.cover_display_name) || pickString(rawRecord, ['coverDisplayName', 'cover_display_name']),
    wordFileName: asString(row.word_file_name) || pickString(rawRecord, ['wordFileName', 'word_file_name']),
    wordOriginalName: asString(row.word_original_name) || pickString(rawRecord, ['wordOriginalName', 'word_original_name']),
    contentHtml: asString(row.content_html) || pickString(rawRecord, ['contentHtml', 'content_html']),
    contentText: asString(row.content_text) || pickString(rawRecord, ['contentText', 'content_text']),
    extractedImages: rawImages.length > 0 ? rawImages : caseImageItems,
    sortOrder: asNumber(row.sort_order, pickNumber(rawRecord, ['sortOrder', 'sort_order'], index + 1)),
    status: (status ?? rawStatus) as CaseStatus,
    seoTitle,
    seoDescription,
    keywords,
    faqItems: caseFaqItems.length > 0 ? caseFaqItems : rawFaqItems,
    createdAt: toIsoString(row.created_at) || pickString(rawRecord, ['createdAt', 'created_at']),
    updatedAt: toIsoString(row.updated_at) || pickString(rawRecord, ['updatedAt', 'updated_at']),
  };
}

async function readCasesExport(definition: ExportModuleDefinition): Promise<MysqlExportReadResult> {
  const hasRawJsonColumn = await tableColumnExists('cases', 'raw_json');
  const rawJsonSelect = hasRawJsonColumn ? 'raw_json' : 'NULL AS raw_json';
  const [caseRows] = await getDbPool().query<CaseRow[]>(
    `SELECT
       id AS mysql_id,
       source_id,
       title,
       slug,
       summary,
       client_type,
       event_type,
       event_date,
       location,
       cover_url,
       cover_file_name,
       cover_display_name,
       word_file_name,
       word_original_name,
       content_html,
       content_text,
       ${rawJsonSelect},
       status,
       sort_order,
       published_at,
       created_at,
       updated_at
     FROM cases
     WHERE deleted_at IS NULL
     ORDER BY sort_order ASC, updated_at DESC, id ASC`,
  );

  const warnings: string[] = [];
  const blockers: string[] = [];

  if (!hasRawJsonColumn) {
    warnings.push('cases.raw_json column is absent; cases are reconstructed from normalized tables with reduced shape confidence.');
  }

  const [caseImageRows] = await getDbPool().query<CaseImageRow[]>(
    `SELECT case_id, image_url, alt_text, caption, sort_order, is_enabled
     FROM case_images
     WHERE deleted_at IS NULL
     ORDER BY case_id ASC, sort_order ASC, id ASC`,
  );
  const [seoRows] = await getDbPool().query<CaseSeoRow[]>(
    `SELECT owner_source_id, owner_id, title, description, keywords
     FROM seo_settings
     WHERE owner_type = 'case'
       AND deleted_at IS NULL`,
  );
  const [faqRows] = await getDbPool().query<CaseFaqRow[]>(
    `SELECT owner_source_id, owner_id, question, answer, sort_order, status
     FROM faq_items
     WHERE owner_type = 'case'
       AND deleted_at IS NULL
     ORDER BY sort_order ASC, id ASC`,
  );
  const imageLookup = buildCaseImageLookup(caseImageRows);
  const seoLookup = buildCaseSeoLookup(seoRows);
  const faqLookup = buildCaseFaqLookup(faqRows);
  let missingRawJsonCount = 0;

  const cases = caseRows.map((row, index) => {
    const rawRecord = parseCaseRawJson({ row, index, warnings, blockers });
    if (!isRecord(rawRecord) || Object.keys(rawRecord).length === 0) {
      missingRawJsonCount += 1;
    }

    const slug = asString(row.slug) || pickString(rawRecord, ['slug']);
    const ownerSourceId = asString(row.source_id) || slug || pickString(rawRecord, ['id', 'sourceId', 'source_id']);
    const mysqlId = ownerIdKey(row.mysql_id) ?? '';
    const seo = findCaseSeo({
      lookupByOwnerId: seoLookup.byOwnerId,
      lookupByOwnerSourceId: seoLookup.byOwnerSourceId,
      mysqlId: row.mysql_id,
      ownerSourceId,
      slug,
    });
    const ownerFaqRows = findCaseFaqRows({
      lookupByOwnerId: faqLookup.byOwnerId,
      lookupByOwnerSourceId: faqLookup.byOwnerSourceId,
      mysqlId: row.mysql_id,
      ownerSourceId,
      slug,
    });

    return buildCaseFromMysql({
      row,
      rawRecord,
      imageRows: imageLookup.get(mysqlId) ?? [],
      seo,
      faqRows: ownerFaqRows,
      index,
      warnings,
      blockers,
    });
  });

  if (hasRawJsonColumn && missingRawJsonCount > 0) {
    warnings.push(
      `cases.raw_json is missing or unusable for ${missingRawJsonCount} active rows; normalized table fields were used for those rows.`,
    );
  }

  if (caseRows.length === 0) {
    blockers.push('No active cases rows were found.');
  }

  return {
    moduleName: definition.moduleName,
    implemented: true,
    status: blockers.length > 0 ? 'shape_risk' : 'exported',
    data: cases,
    recordCount: caseRows.length,
    warnings,
    blockers,
  };
}

async function readSolutionsExport(definition: ExportModuleDefinition): Promise<MysqlExportReadResult> {
  const hasRawJsonColumn = await tableColumnExists('solutions', 'raw_json');
  const rawJsonSelect = hasRawJsonColumn ? 'raw_json' : 'NULL AS raw_json';
  const [solutionRows] = await getDbPool().query<SolutionRow[]>(
    `SELECT
       id AS mysql_id,
       source_id,
       title,
       slug,
       summary,
       ${rawJsonSelect},
       status,
       sort_order,
       published_at,
       created_at,
       updated_at
     FROM solutions
     WHERE deleted_at IS NULL
     ORDER BY sort_order ASC, id ASC`,
  );

  const warnings: string[] = [];
  const blockers: string[] = [];

  if (!hasRawJsonColumn) {
    warnings.push('solutions.raw_json column is absent; scenes are reconstructed from normalized split tables with reduced shape confidence.');
  }

  const [groupRows] = await getDbPool().query<SolutionGroupRow[]>(
    `SELECT
       id AS mysql_id,
       solution_id,
       source_id,
       title,
       slug,
       summary,
       scene_slug,
       sort_order,
       is_enabled,
       created_at,
       updated_at
     FROM solution_groups
     WHERE deleted_at IS NULL
     ORDER BY solution_id ASC, sort_order ASC, id ASC`,
  );

  const [mediaRows] = await getDbPool().query<SolutionMediaItemRow[]>(
    `SELECT
       group_id,
       source_id,
       file_type,
       media_url,
       media_file_name,
       media_display_name,
       alt_text,
       caption,
       sort_order,
       is_enabled,
       created_at
     FROM solution_media_items
     WHERE deleted_at IS NULL
     ORDER BY group_id ASC, sort_order ASC, id ASC`,
  );

  if (solutionRows.length === 0) {
    blockers.push('No active solutions rows were found.');
  }

  const activeSolutionIds = new Set(solutionRows.map((row) => ownerIdKey(row.mysql_id)).filter((value): value is string => Boolean(value)));
  const activeGroupIds = new Set(groupRows.map((row) => ownerIdKey(row.mysql_id)).filter((value): value is string => Boolean(value)));
  const orphanGroupCount = groupRows.filter((row) => {
    const solutionId = ownerIdKey(row.solution_id);
    return solutionId !== null && !activeSolutionIds.has(solutionId);
  }).length;
  const orphanItemCount = mediaRows.filter((row) => {
    const groupId = ownerIdKey(row.group_id);
    return groupId !== null && !activeGroupIds.has(groupId);
  }).length;

  if (orphanGroupCount > 0) {
    warnings.push(`${orphanGroupCount} active solution_groups rows reference inactive or missing solutions and were not exported.`);
  }

  if (orphanItemCount > 0) {
    warnings.push(`${orphanItemCount} active solution_media_items rows reference inactive or missing groups and were not exported.`);
  }

  const itemsByGroupId = solutionItemsFromRows(mediaRows, warnings, blockers);
  const groupsBySolutionId = solutionGroupsFromRows({
    groupRows,
    itemsByGroupId,
    warnings,
    blockers,
  });

  let rawJsonBaseCount = 0;
  let missingRawJsonCount = 0;
  const scenes = solutionRows.map((row, index) => {
    const rawRecord = parseSolutionRawJson({ row, index, warnings, blockers });
    if (Object.keys(rawRecord).length > 0) {
      rawJsonBaseCount += 1;
    } else {
      missingRawJsonCount += 1;
    }

    const mysqlId = ownerIdKey(row.mysql_id);
    return buildSolutionSceneFromMysql({
      row,
      rawRecord,
      mysqlGroups: mysqlId ? groupsBySolutionId.get(mysqlId) ?? [] : [],
      index,
      warnings,
      blockers,
    });
  }).sort((left, right) => left.sortOrder - right.sortOrder);

  if (hasRawJsonColumn && missingRawJsonCount > 0) {
    warnings.push(
      `solutions.raw_json is missing or unusable for ${missingRawJsonCount} active rows; normalized table fields and split rows were used for those rows.`,
    );
  }

  validateSolutionSceneSet(scenes, blockers);
  validateSolutionVideoRules(scenes, blockers);
  validateSolutionSplitVideoRules(groupsBySolutionId, blockers);

  const exportedGroupCount = scenes.reduce((sum, scene) => sum + scene.groups.length, 0);
  const exportedItemCount = scenes.reduce(
    (sceneSum, scene) => sceneSum + scene.groups.reduce((groupSum, group) => groupSum + group.items.length, 0),
    0,
  );

  return {
    moduleName: definition.moduleName,
    implemented: true,
    status: blockers.length > 0 ? 'shape_risk' : 'exported',
    data: scenes,
    recordCount: scenes.length,
    warnings,
    blockers,
    metrics: {
      activeMysqlSolutionCount: solutionRows.length,
      activeMysqlGroupCount: groupRows.length,
      activeMysqlItemCount: mediaRows.length,
      exportedSceneCount: scenes.length,
      exportedGroupCount,
      exportedItemCount,
      rawJsonBaseCount,
      missingRawJsonCount,
      orphanGroupCount,
      orphanItemCount,
      usesMediaFiles: false,
      wroteServerData: false,
      wroteMysql: false,
      canRollback: false,
    },
  };
}

export async function readMysqlExportedData(input: {
  definition: ExportModuleDefinition;
  exportStatus: ExportStatus;
}): Promise<MysqlExportReadResult> {
  if (input.exportStatus !== 'implemented' || !implementedExportModules.has(input.definition.moduleName)) {
    return emptyExportResult({
      definition: input.definition,
      status: 'not_implemented',
      implemented: false,
    });
  }

  try {
    const safeConfig = getSafeDatabaseConfig();
    if (!safeConfig.configured) {
      return emptyExportResult({
        definition: input.definition,
        status: 'mysql_unavailable',
        implemented: true,
        warnings: [`MySQL is not configured. Missing: ${safeConfig.missing.join(', ')}`],
      });
    }

    await getDbPool().query('SELECT 1');

    switch (input.definition.moduleName) {
      case 'contact-info':
        return readContactInfoExport(input.definition);
      case 'company-assets':
        return readCompanyAssetsExport(input.definition);
      case 'home-video':
        return readHomeVideoExport(input.definition);
      case 'home-interactive-images':
        return readHomeInteractiveImagesExport(input.definition);
      case 'articles':
        return readArticlesExport(input.definition);
      case 'cases':
        return readCasesExport(input.definition);
      case 'solutions':
        return readSolutionsExport(input.definition);
      default:
        return emptyExportResult({
          definition: input.definition,
          status: 'not_implemented',
          implemented: false,
        });
    }
  } catch (error) {
    return emptyExportResult({
      definition: input.definition,
      status: 'mysql_unavailable',
      implemented: true,
      blockers: [error instanceof Error ? error.message : 'Unable to read MySQL export data.'],
    });
  }
}
