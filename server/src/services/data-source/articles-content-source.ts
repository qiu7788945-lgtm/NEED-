import type { RowDataPacket } from 'mysql2/promise';
import type { Article, ArticleCategory, ArticleFaqItem, ArticleStatus } from '../../../../shared/types/article.js';
import { getDbPool, getSafeDatabaseConfig } from '../../db/client.js';
import { logger } from '../../utils/logger.js';

type JsonFallback = () => Promise<Article[]>;
type ArticlesNormalizer = (value: unknown) => Article[];
type UnknownRecord = Record<string, unknown>;

type ArticleRow = RowDataPacket & {
  mysql_id: unknown;
  source_id: unknown;
  title: unknown;
  slug: unknown;
  summary: unknown;
  content: unknown;
  category_slug: unknown;
  category_name: unknown;
  status: unknown;
  sort_order: unknown;
  created_at: unknown;
  updated_at: unknown;
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

const allowedCategories = new Set<ArticleCategory>(['how_to_choose', 'choose_between_two', 'method_judgment']);
const allowedStatuses = new Set<ArticleStatus>(['draft', 'published', 'offline']);
const warnedFallbacks = new Set<string>();

function warnFallbackOnce(reason: string, message: string, meta?: UnknownRecord) {
  const key = `articles:${reason}`;
  if (warnedFallbacks.has(key)) {
    return;
  }

  warnedFallbacks.add(key);
  logger.warn(message, {
    moduleName: 'articles',
    reason,
    ...meta,
  });
}

function canUseMysql() {
  try {
    const config = getSafeDatabaseConfig();
    return config.configured;
  } catch (error) {
    warnFallbackOnce(
      'mysql-config-invalid',
      'Articles source is falling back to JSON because MySQL config is invalid.',
      { message: error instanceof Error ? error.message : String(error) },
    );
    return false;
  }
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown, fallback: number) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function asDateString(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  return asString(value);
}

function normalizeCategory(value: unknown): ArticleCategory | null {
  const category = asString(value);
  return allowedCategories.has(category as ArticleCategory) ? category as ArticleCategory : null;
}

function normalizeStatus(value: unknown): ArticleStatus | null {
  const status = asString(value);
  return allowedStatuses.has(status as ArticleStatus) ? status as ArticleStatus : null;
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

function findByOwner<T>(
  input: {
    lookupByOwnerId: Map<string, T>;
    lookupByOwnerSourceId: Map<string, T>;
    mysqlId: unknown;
    ownerSourceId: string;
    slug: string;
  },
) {
  return input.lookupByOwnerSourceId.get(input.ownerSourceId)
    ?? input.lookupByOwnerSourceId.get(input.slug)
    ?? input.lookupByOwnerId.get(ownerIdKey(input.mysqlId) ?? '');
}

function findFaqRows(
  input: {
    lookupByOwnerId: Map<string, FaqRow[]>;
    lookupByOwnerSourceId: Map<string, FaqRow[]>;
    mysqlId: unknown;
    ownerSourceId: string;
    slug: string;
  },
) {
  return input.lookupByOwnerSourceId.get(input.ownerSourceId)
    ?? input.lookupByOwnerSourceId.get(input.slug)
    ?? input.lookupByOwnerId.get(ownerIdKey(input.mysqlId) ?? '')
    ?? [];
}

function toFaqItems(rows: FaqRow[]): ArticleFaqItem[] {
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

function toArticle(row: ArticleRow, seo: SeoRow, faqItems: ArticleFaqItem[], index: number): Article {
  const sourceId = asString(row.source_id);
  const slug = asString(row.slug);
  const title = asString(row.title);
  const summary = asString(row.summary);
  const content = asString(row.content);
  const category = normalizeCategory(row.category_slug);
  const status = normalizeStatus(row.status);

  if (!title || !slug) {
    throw new Error('articles row is missing title or slug.');
  }

  if (!category) {
    throw new Error(`articles row has unsupported category for slug "${slug}".`);
  }

  if (!status) {
    throw new Error(`articles row has unsupported status for slug "${slug}".`);
  }

  if (!content) {
    throw new Error(`articles row is missing content for slug "${slug}".`);
  }

  if (!asString(seo.title) && !asString(seo.description) && !asString(seo.keywords)) {
    throw new Error(`article seo_settings row is empty for slug "${slug}".`);
  }

  return {
    id: sourceId || slug || String(row.mysql_id),
    title,
    slug,
    category,
    summary,
    content,
    sortOrder: asNumber(row.sort_order, index + 1),
    status,
    seoTitle: asString(seo.title),
    seoDescription: asString(seo.description),
    keywords: asString(seo.keywords),
    faqItems,
    createdAt: asDateString(row.created_at),
    updatedAt: asDateString(row.updated_at),
  };
}

export async function readArticlesWithMysqlFallback(
  readJson: JsonFallback,
  normalize: ArticlesNormalizer,
) {
  if (!canUseMysql()) {
    return readJson();
  }

  try {
    const pool = getDbPool();
    const [articleRows] = await pool.query<ArticleRow[]>(
      `SELECT
         a.id AS mysql_id,
         a.source_id,
         a.title,
         a.slug,
         a.summary,
         a.content,
         COALESCE(a.category_slug, c.slug) AS category_slug,
         c.name AS category_name,
         a.status,
         a.sort_order,
         a.created_at,
         a.updated_at
       FROM articles a
       LEFT JOIN article_categories c
         ON c.id = a.category_id
        AND c.deleted_at IS NULL
       WHERE a.deleted_at IS NULL
       ORDER BY a.sort_order ASC, a.updated_at DESC, a.id ASC`,
    );

    if (articleRows.length === 0) {
      warnFallbackOnce(
        'mysql-empty',
        'Articles source is falling back to JSON because MySQL returned no article rows.',
      );
      return readJson();
    }

    const [seoRows] = await pool.query<SeoRow[]>(
      `SELECT owner_source_id, owner_id, title, description, keywords
       FROM seo_settings
       WHERE owner_type = 'article'
         AND deleted_at IS NULL`,
    );
    const [faqRows] = await pool.query<FaqRow[]>(
      `SELECT owner_source_id, owner_id, question, answer, sort_order, status
       FROM faq_items
       WHERE owner_type = 'article'
         AND deleted_at IS NULL
       ORDER BY sort_order ASC, id ASC`,
    );

    if (seoRows.length === 0) {
      throw new Error('article seo_settings rows are missing.');
    }

    const seoLookup = buildSeoLookup(seoRows);
    const faqLookup = buildFaqLookup(faqRows);
    const articles = articleRows.map((row, index) => {
      const ownerSourceId = asString(row.source_id) || asString(row.slug);
      const slug = asString(row.slug);
      const seo = findByOwner({
        lookupByOwnerId: seoLookup.byOwnerId,
        lookupByOwnerSourceId: seoLookup.byOwnerSourceId,
        mysqlId: row.mysql_id,
        ownerSourceId,
        slug,
      });

      if (!seo) {
        throw new Error(`article seo_settings row is missing for "${ownerSourceId || slug}".`);
      }

      const ownerFaqRows = findFaqRows({
        lookupByOwnerId: faqLookup.byOwnerId,
        lookupByOwnerSourceId: faqLookup.byOwnerSourceId,
        mysqlId: row.mysql_id,
        ownerSourceId,
        slug,
      });

      return toArticle(row, seo, toFaqItems(ownerFaqRows), index);
    });

    return normalize(articles);
  } catch (error) {
    warnFallbackOnce(
      'mysql-read-failed',
      'Articles source is falling back to JSON because MySQL read failed or returned unusable rows.',
      { message: error instanceof Error ? error.message : String(error) },
    );
    return readJson();
  }
}
