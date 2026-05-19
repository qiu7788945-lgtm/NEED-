import type { RowDataPacket } from 'mysql2/promise';
import type { CaseExtractedImage, CaseFaqItem, CaseStatus, CaseStudy } from '../../../../shared/types/case.js';
import { getDbPool, getSafeDatabaseConfig } from '../../db/client.js';
import { logger } from '../../utils/logger.js';

type JsonFallback = () => Promise<CaseStudy[]>;
type CasesNormalizer = (value: unknown) => CaseStudy[];
type UnknownRecord = Record<string, unknown>;

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
  raw_json: unknown;
  status: unknown;
  sort_order: unknown;
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

type SeoRow = RowDataPacket & {
  owner_source_id: unknown;
  owner_id: unknown;
  title: unknown;
  description: unknown;
  keywords: unknown;
};

type FaqRow = RowDataPacket & {
  owner_source_id: unknown;
  owner_id: unknown;
  question: unknown;
  answer: unknown;
  sort_order: unknown;
  status: unknown;
};

const allowedStatuses = new Set<CaseStatus>(['draft', 'published', 'offline']);
const warnedFallbacks = new Set<string>();

function warnFallbackOnce(reason: string, message: string, meta?: UnknownRecord) {
  const key = `cases:${reason}`;
  if (warnedFallbacks.has(key)) {
    return;
  }

  warnedFallbacks.add(key);
  logger.warn(message, {
    moduleName: 'cases',
    reason,
    ...meta,
  });
}

function canUseMysql() {
  try {
    return getSafeDatabaseConfig().configured;
  } catch (error) {
    warnFallbackOnce(
      'mysql-config-invalid',
      'Cases source is falling back to JSON because MySQL config is invalid.',
      { message: error instanceof Error ? error.message : String(error) },
    );
    return false;
  }
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseJsonColumn(value: unknown): unknown {
  if (Buffer.isBuffer(value)) {
    return parseJsonColumn(value.toString('utf8'));
  }

  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown, fallback: number) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function asDateTimeString(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  return asString(value);
}

function asDateFieldString(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  return asString(value);
}

function normalizeStatus(value: unknown): CaseStatus | null {
  const status = asString(value);
  return allowedStatuses.has(status as CaseStatus) ? status as CaseStatus : null;
}

function pickString(record: UnknownRecord, keys: string[]) {
  for (const key of keys) {
    const value = asString(record[key]);
    if (value) {
      return value;
    }
  }

  return '';
}

function ownerIdKey(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

function ownerSourceKey(value: unknown) {
  return asString(value) || null;
}

function addToMapList<T>(map: Map<string, T[]>, key: string | null, value: T) {
  if (!key) {
    return;
  }

  const existing = map.get(key) ?? [];
  existing.push(value);
  map.set(key, existing);
}

function buildImageLookup(rows: CaseImageRow[]) {
  const byCaseId = new Map<string, CaseImageRow[]>();

  for (const row of rows) {
    addToMapList(byCaseId, ownerIdKey(row.case_id), row);
  }

  return byCaseId;
}

function buildSeoLookup(rows: SeoRow[]) {
  const byOwnerId = new Map<string, SeoRow>();
  const byOwnerSourceId = new Map<string, SeoRow>();

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

function buildFaqLookup(rows: FaqRow[]) {
  const byOwnerId = new Map<string, FaqRow[]>();
  const byOwnerSourceId = new Map<string, FaqRow[]>();

  for (const row of rows) {
    addToMapList(byOwnerId, ownerIdKey(row.owner_id), row);
    addToMapList(byOwnerSourceId, ownerSourceKey(row.owner_source_id), row);
  }

  return { byOwnerId, byOwnerSourceId };
}

function findSeoRow(input: {
  lookupByOwnerId: Map<string, SeoRow>;
  lookupByOwnerSourceId: Map<string, SeoRow>;
  mysqlId: unknown;
  ownerSourceId: string;
  slug: string;
}) {
  return input.lookupByOwnerSourceId.get(input.ownerSourceId)
    ?? input.lookupByOwnerSourceId.get(input.slug)
    ?? input.lookupByOwnerId.get(ownerIdKey(input.mysqlId) ?? '')
    ?? null;
}

function findFaqRows(input: {
  lookupByOwnerId: Map<string, FaqRow[]>;
  lookupByOwnerSourceId: Map<string, FaqRow[]>;
  mysqlId: unknown;
  ownerSourceId: string;
  slug: string;
}) {
  return input.lookupByOwnerSourceId.get(input.ownerSourceId)
    ?? input.lookupByOwnerSourceId.get(input.slug)
    ?? input.lookupByOwnerId.get(ownerIdKey(input.mysqlId) ?? '')
    ?? [];
}

function fileNameFromUrl(value: string) {
  const withoutQuery = value.split('?')[0]?.split('#')[0] ?? value;
  try {
    return decodeURIComponent(withoutQuery.split(/[\\/]/).filter(Boolean).pop() ?? '');
  } catch {
    return withoutQuery.split(/[\\/]/).filter(Boolean).pop() ?? '';
  }
}

function rawCaseRecord(row: CaseRow): UnknownRecord {
  const parsed = parseJsonColumn(row.raw_json);
  return isRecord(parsed) ? parsed : {};
}

function rawExtractedImages(raw: UnknownRecord): CaseExtractedImage[] {
  const rawImages = raw.extractedImages ?? raw.extracted_images ?? raw.caseImages ?? raw.case_images;
  if (!Array.isArray(rawImages)) {
    return [];
  }

  return rawImages
    .filter(isRecord)
    .map((image, index) => {
      const url = pickString(image, ['url', 'imageUrl', 'image_url', 'publicUrl', 'public_url', 'src']);
      const fileName = pickString(image, ['fileName', 'file_name', 'storageFileName', 'storage_file_name'])
        || fileNameFromUrl(url);
      const displayName = pickString(image, ['displayName', 'display_name', 'title'])
        || pickString(image, ['altText', 'alt_text', 'alt'])
        || fileName;

      return {
        fileName,
        url,
        displayName,
        alt: pickString(image, ['altText', 'alt_text', 'alt']) || displayName,
        sortOrder: asNumber(image.sortOrder ?? image.sort_order, index + 1),
      };
    })
    .filter((image) => image.fileName && image.url);
}

function mysqlExtractedImages(rows: CaseImageRow[]): CaseExtractedImage[] {
  return rows
    .sort((left, right) => asNumber(left.sort_order, 0) - asNumber(right.sort_order, 0))
    .map((row, index) => {
      const url = asString(row.image_url);
      const fileName = fileNameFromUrl(url);
      const alt = asString(row.alt_text);
      const caption = asString(row.caption);
      const displayName = alt || caption || fileName;

      return {
        fileName,
        url,
        displayName,
        alt: alt || displayName,
        sortOrder: asNumber(row.sort_order, index + 1),
      };
    })
    .filter((image) => image.fileName && image.url);
}

function toFaqItems(rows: FaqRow[], raw: UnknownRecord): CaseFaqItem[] {
  if (rows.length > 0) {
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

  const rawFaqItems = raw.faqItems ?? raw.faq_items;
  if (!Array.isArray(rawFaqItems)) {
    return [];
  }

  return rawFaqItems
    .filter(isRecord)
    .map((item) => ({
      question: pickString(item, ['question', 'q']),
      answer: pickString(item, ['answer', 'a']),
    }))
    .filter((item) => item.question || item.answer);
}

function toCase(input: {
  row: CaseRow;
  imageRows: CaseImageRow[];
  seoRow: SeoRow | null;
  faqRows: FaqRow[];
  index: number;
}): CaseStudy {
  const { row, imageRows, seoRow, faqRows, index } = input;
  const raw = rawCaseRecord(row);
  const sourceId = asString(row.source_id);
  const slug = asString(row.slug) || pickString(raw, ['slug']);
  const title = asString(row.title) || pickString(raw, ['title']);
  const id = sourceId || pickString(raw, ['id', 'sourceId', 'source_id']) || slug || ownerIdKey(row.mysql_id) || '';
  const status = normalizeStatus(row.status) ?? normalizeStatus(raw.status);

  if (!id || !title || !slug) {
    throw new Error(`cases row is missing id, title, or slug for MySQL id "${ownerIdKey(row.mysql_id) ?? 'unknown'}".`);
  }

  if (!status) {
    throw new Error(`cases row has unsupported status for slug "${slug}".`);
  }

  const rawImages = rawExtractedImages(raw);
  const coverUrl = asString(row.cover_url) || pickString(raw, ['coverUrl', 'cover_url']);
  const coverFileName = asString(row.cover_file_name)
    || pickString(raw, ['coverFileName', 'cover_file_name'])
    || fileNameFromUrl(coverUrl);

  return {
    id,
    title,
    slug,
    summary: asString(row.summary) || pickString(raw, ['summary']),
    clientType: asString(row.client_type) || pickString(raw, ['clientType', 'client_type']),
    eventType: asString(row.event_type) || pickString(raw, ['eventType', 'event_type']),
    eventDate: asDateFieldString(row.event_date) || pickString(raw, ['eventDate', 'event_date']),
    location: asString(row.location) || pickString(raw, ['location']),
    coverUrl,
    coverFileName,
    coverDisplayName: asString(row.cover_display_name) || pickString(raw, ['coverDisplayName', 'cover_display_name']),
    wordFileName: asString(row.word_file_name) || pickString(raw, ['wordFileName', 'word_file_name']),
    wordOriginalName: asString(row.word_original_name) || pickString(raw, ['wordOriginalName', 'word_original_name']),
    contentHtml: asString(row.content_html) || pickString(raw, ['contentHtml', 'content_html']),
    contentText: asString(row.content_text) || pickString(raw, ['contentText', 'content_text']),
    extractedImages: rawImages.length > 0 ? rawImages : mysqlExtractedImages(imageRows),
    sortOrder: asNumber(row.sort_order, asNumber(raw.sortOrder ?? raw.sort_order, index + 1)),
    status,
    seoTitle: asString(seoRow?.title) || pickString(raw, ['seoTitle', 'seo_title']),
    seoDescription: asString(seoRow?.description) || pickString(raw, ['seoDescription', 'seo_description']),
    keywords: asString(seoRow?.keywords) || pickString(raw, ['keywords']),
    faqItems: toFaqItems(faqRows, raw),
    createdAt: asDateTimeString(row.created_at) || pickString(raw, ['createdAt', 'created_at']),
    updatedAt: asDateTimeString(row.updated_at) || pickString(raw, ['updatedAt', 'updated_at']),
  };
}

export async function readCasesWithMysqlFallback(
  readJson: JsonFallback,
  normalize: CasesNormalizer,
): Promise<CaseStudy[]> {
  if (!canUseMysql()) {
    return readJson();
  }

  try {
    const pool = getDbPool();
    const [caseRows] = await pool.query<CaseRow[]>(
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
         raw_json,
         status,
         sort_order,
         created_at,
         updated_at
       FROM cases
       WHERE deleted_at IS NULL
       ORDER BY sort_order ASC, updated_at DESC, id ASC`,
    );

    if (caseRows.length === 0) {
      warnFallbackOnce(
        'mysql-empty',
        'Cases source is falling back to JSON because MySQL returned no case rows.',
      );
      return readJson();
    }

    const [caseImageRows] = await pool.query<CaseImageRow[]>(
      `SELECT case_id, image_url, alt_text, caption, sort_order, is_enabled
       FROM case_images
       WHERE deleted_at IS NULL
       ORDER BY case_id ASC, sort_order ASC, id ASC`,
    );
    const [seoRows] = await pool.query<SeoRow[]>(
      `SELECT owner_source_id, owner_id, title, description, keywords
       FROM seo_settings
       WHERE owner_type = 'case'
         AND deleted_at IS NULL`,
    );
    const [faqRows] = await pool.query<FaqRow[]>(
      `SELECT owner_source_id, owner_id, question, answer, sort_order, status
       FROM faq_items
       WHERE owner_type = 'case'
         AND deleted_at IS NULL
       ORDER BY sort_order ASC, id ASC`,
    );
    const imageLookup = buildImageLookup(caseImageRows);
    const seoLookup = buildSeoLookup(seoRows);
    const faqLookup = buildFaqLookup(faqRows);
    const cases = caseRows.map((row, index) => {
      const slug = asString(row.slug);
      const ownerSourceId = asString(row.source_id) || slug;
      const mysqlId = ownerIdKey(row.mysql_id) ?? '';
      const seoRow = findSeoRow({
        lookupByOwnerId: seoLookup.byOwnerId,
        lookupByOwnerSourceId: seoLookup.byOwnerSourceId,
        mysqlId: row.mysql_id,
        ownerSourceId,
        slug,
      });
      const ownerFaqRows = findFaqRows({
        lookupByOwnerId: faqLookup.byOwnerId,
        lookupByOwnerSourceId: faqLookup.byOwnerSourceId,
        mysqlId: row.mysql_id,
        ownerSourceId,
        slug,
      });

      return toCase({
        row,
        imageRows: imageLookup.get(mysqlId) ?? [],
        seoRow,
        faqRows: ownerFaqRows,
        index,
      });
    });

    return normalize(cases);
  } catch (error) {
    warnFallbackOnce(
      'mysql-read-failed',
      'Cases source is falling back to JSON because MySQL read failed or returned unusable rows.',
      { message: error instanceof Error ? error.message : String(error) },
    );
    return readJson();
  }
}
