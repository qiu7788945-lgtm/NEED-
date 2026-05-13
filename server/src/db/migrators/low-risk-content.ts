import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { loadSource } from '../migration/source-loader.js';
import type {
  ActualTableWrite,
  MigrationModuleName,
  MigrationWarning,
  ModuleDefinition,
  ModuleMigrationResult,
  ModulePlan,
} from '../migration/types.js';

export const writableContentModules = [
  'articles',
  'cases',
  'solutions',
  'scenario-detail-pages',
  'pages',
  'contact-info',
  'company-assets',
  'home-video',
  'home-interactive-images',
  'media-library',
  'publish-logs',
] as const satisfies MigrationModuleName[];

type WritableContentModuleName = (typeof writableContentModules)[number];

type MigrationContext = {
  pool: DbExecutor;
  definition: ModuleDefinition;
  plan: ModulePlan;
};

type DbExecutor = Pick<PoolConnection, 'execute'>;

type CountableWrite = {
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  actualWrites: ActualTableWrite[];
  warnings: MigrationWarning[];
  details?: Record<string, unknown>;
};

type IdRow = RowDataPacket & {
  id: number;
};

type CountRow = RowDataPacket & {
  count: number;
};

type SqlValue = string | number | boolean | Date | null | SqlValue[] | { [key: string]: SqlValue };
type SqlParams = { [key: string]: SqlValue };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  const text = asString(value).trim();
  return text ? text : null;
}

function asBoolean(value: unknown, fallback = true): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asDate(value: unknown): Date | null {
  const text = asNullableString(value);

  if (!text) {
    return null;
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function categoryNameFromSlug(slug: string): string {
  return slug.replace(/[-_]+/g, ' ');
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

function asOptionalNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function asOptionalUnsignedInteger(value: unknown): number | null {
  const numberValue = asOptionalNumber(value);

  if (numberValue === null || numberValue < 0) {
    return null;
  }

  return Math.trunc(numberValue);
}

function emptyWrites(): CountableWrite {
  return {
    insertedCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    actualWrites: [],
    warnings: [],
  };
}

function addWrite(writes: ActualTableWrite[], table: string, kind: 'inserted' | 'updated' | 'skipped', count = 1): void {
  const existing = writes.find((write) => write.table === table);
  const target = existing ?? { table, inserted: 0, updated: 0, skipped: 0 };

  target[kind] += count;

  if (!existing) {
    writes.push(target);
  }
}

async function rowExists(pool: DbExecutor, sql: string, params: SqlParams): Promise<boolean> {
  const [rows] = await pool.execute<CountRow[]>(sql, params);
  return Number(rows[0]?.count ?? 0) > 0;
}

async function findId(pool: DbExecutor, sql: string, params: SqlParams): Promise<number | null> {
  const [rows] = await pool.execute<IdRow[]>(sql, params);
  return rows[0]?.id ?? null;
}

async function upsertMediaFile(input: {
  pool: DbExecutor;
  writes: ActualTableWrite[];
  publicUrl: string | null;
  fileName?: string | null;
  originalName?: string | null;
  altText?: string | null;
  description?: string | null;
  category: string;
  metadata?: Record<string, unknown>;
}): Promise<number | null> {
  const publicUrl = input.publicUrl?.trim();

  if (!publicUrl) {
    return null;
  }

  const fileName = normalizeFileName(publicUrl, input.fileName ?? null);

  if (!fileName) {
    return null;
  }

  const exists = await rowExists(
    input.pool,
    'SELECT COUNT(*) AS count FROM media_files WHERE public_url = :publicUrl',
    { publicUrl },
  );

  await input.pool.execute(
    `INSERT INTO media_files (
      file_name,
      original_name,
      file_path,
      public_url,
      mime_type,
      file_ext,
      file_size,
      category,
      alt_text,
      description,
      metadata_json,
      status
    ) VALUES (
      :fileName,
      :originalName,
      :filePath,
      :publicUrl,
      :mimeType,
      :fileExt,
      0,
      :category,
      :altText,
      :description,
      :metadataJson,
      'active'
    )
    ON DUPLICATE KEY UPDATE
      file_name = VALUES(file_name),
      original_name = VALUES(original_name),
      file_path = VALUES(file_path),
      mime_type = VALUES(mime_type),
      file_ext = VALUES(file_ext),
      category = VALUES(category),
      alt_text = VALUES(alt_text),
      description = VALUES(description),
      metadata_json = VALUES(metadata_json),
      status = VALUES(status),
      deleted_at = NULL`,
    {
      fileName,
      originalName: input.originalName ?? fileName,
      filePath: publicUrl,
      publicUrl,
      mimeType: mimeFromFileName(fileName),
      fileExt: extFromFileName(fileName),
      category: input.category,
      altText: input.altText ?? null,
      description: input.description ?? null,
      metadataJson: JSON.stringify(input.metadata ?? {}),
    },
  );

  addWrite(input.writes, 'media_files', exists ? 'updated' : 'inserted');

  return findId(input.pool, 'SELECT id FROM media_files WHERE public_url = :publicUrl LIMIT 1', { publicUrl });
}

async function hasSuccessfulSourceHash(pool: DbExecutor, plan: ModulePlan): Promise<boolean> {
  if (!plan.sourceHash) {
    return false;
  }

  return rowExists(
    pool,
    `SELECT COUNT(*) AS count
     FROM migration_logs
     WHERE migration_key = :migrationKey
       AND source_hash = :sourceHash
       AND status IN ('success', 'skipped_success_hash')`,
    {
      migrationKey: plan.migrationKey,
      sourceHash: plan.sourceHash,
    },
  );
}

function finishResult(input: {
  plan: ModulePlan;
  status: ModuleMigrationResult['status'];
  counts: CountableWrite;
  startedAt: Date;
  warnings?: MigrationWarning[];
  errorMessage?: string | null;
  skippedReason?: string | null;
  details?: Record<string, unknown>;
}): ModuleMigrationResult {
  const warnings = input.warnings ?? input.plan.warnings;

  return {
    moduleName: input.plan.moduleName,
    migrationKey: input.plan.migrationKey,
    sourceFile: input.plan.sourceFile,
    sourceHash: input.plan.sourceHash,
    status: input.status,
    sourceCount: input.plan.sourceCount,
    insertedCount: input.counts.insertedCount,
    updatedCount: input.counts.updatedCount,
    skippedCount: input.counts.skippedCount,
    warningCount: warnings.length,
    errorMessage: input.errorMessage ?? null,
    actualWrites: input.counts.actualWrites,
    warnings,
    skippedReason: input.skippedReason ?? input.plan.skippedReason,
    details: input.details ?? input.counts.details,
    startedAt: input.startedAt,
    finishedAt: new Date(),
  };
}

function getArticleSourceId(article: Record<string, unknown>): string | null {
  return asNullableString(article.sourceId ?? article.source_id ?? article.id);
}

function getArticleCategorySlug(article: Record<string, unknown>): string | null {
  return asNullableString(article.categorySlug ?? article.category_slug ?? article.category ?? article['\u5206\u7c7b']);
}

function getArticleStatus(article: Record<string, unknown>): string {
  const status = asNullableString(article.status);

  if (status) {
    return status;
  }

  return asBoolean(article.published ?? article.enabled, false) ? 'published' : 'draft';
}

function getArticleTagsJson(article: Record<string, unknown>): string | null {
  if (!Array.isArray(article.tags)) {
    return null;
  }

  const tags = article.tags
    .map((tag) => asNullableString(tag))
    .filter((tag): tag is string => Boolean(tag));

  return tags.length > 0 ? JSON.stringify(tags) : null;
}

async function upsertArticleCategories(
  context: MigrationContext,
  articles: Record<string, unknown>[],
  counts: CountableWrite,
): Promise<Map<string, number>> {
  const categorySortOrders = new Map<string, number>();
  const categoryIdBySlug = new Map<string, number>();

  for (const article of articles) {
    const categorySlug = getArticleCategorySlug(article);

    if (categorySlug && !categorySortOrders.has(categorySlug)) {
      categorySortOrders.set(categorySlug, categorySortOrders.size + 1);
    }
  }

  for (const [slug, sortOrder] of categorySortOrders.entries()) {
    const exists = await rowExists(
      context.pool,
      'SELECT COUNT(*) AS count FROM article_categories WHERE slug = :slug',
      { slug },
    );

    await context.pool.execute(
      `INSERT INTO article_categories (
        name,
        slug,
        description,
        sort_order,
        status
      ) VALUES (
        :name,
        :slug,
        NULL,
        :sortOrder,
        'active'
      )
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        sort_order = VALUES(sort_order),
        status = VALUES(status),
        deleted_at = NULL`,
      {
        name: categoryNameFromSlug(slug),
        slug,
        sortOrder,
      },
    );

    counts[exists ? 'updatedCount' : 'insertedCount'] += 1;
    addWrite(counts.actualWrites, 'article_categories', exists ? 'updated' : 'inserted');

    const categoryId = await findId(context.pool, 'SELECT id FROM article_categories WHERE slug = :slug LIMIT 1', {
      slug,
    });

    if (categoryId) {
      categoryIdBySlug.set(slug, categoryId);
    } else {
      counts.warnings.push({
        code: 'article_category_id_missing',
        level: 'warning',
        message: `Could not resolve article category id for slug "${slug}".`,
      });
    }
  }

  return categoryIdBySlug;
}

async function findArticleId(
  pool: DbExecutor,
  sourceId: string | null,
  slug: string,
): Promise<number | null> {
  if (sourceId) {
    return findId(pool, 'SELECT id FROM articles WHERE source_id = :sourceId OR slug = :slug LIMIT 1', {
      sourceId,
      slug,
    });
  }

  return findId(pool, 'SELECT id FROM articles WHERE slug = :slug LIMIT 1', { slug });
}

async function upsertArticleSeo(input: {
  context: MigrationContext;
  counts: CountableWrite;
  article: Record<string, unknown>;
  articleId: number;
  ownerSourceId: string;
  publishedAt: Date | null;
}): Promise<number> {
  const seoTitle = asNullableString(input.article.seoTitle ?? input.article.seo_title);
  const seoDescription = asNullableString(input.article.seoDescription ?? input.article.seo_description);
  const keywords = asNullableString(input.article.keywords);

  if (!seoTitle && !seoDescription && !keywords) {
    return 0;
  }

  const existingId = await findId(
    input.context.pool,
    `SELECT id
     FROM seo_settings
     WHERE owner_type = 'article'
       AND (owner_source_id = :ownerSourceId OR owner_id = :ownerId)
     LIMIT 1`,
    {
      ownerSourceId: input.ownerSourceId,
      ownerId: input.articleId,
    },
  );

  if (existingId) {
    await input.context.pool.execute(
      `UPDATE seo_settings
       SET owner_source_id = :ownerSourceId,
           owner_id = :ownerId,
           title = :title,
           description = :description,
           keywords = :keywords,
           robots = 'index,follow',
           published_at = :publishedAt,
           deleted_at = NULL
       WHERE id = :id`,
      {
        id: existingId,
        ownerSourceId: input.ownerSourceId,
        ownerId: input.articleId,
        title: seoTitle,
        description: seoDescription,
        keywords,
        publishedAt: input.publishedAt,
      },
    );

    input.counts.updatedCount += 1;
    addWrite(input.counts.actualWrites, 'seo_settings', 'updated');
    return 1;
  }

  await input.context.pool.execute(
    `INSERT INTO seo_settings (
      owner_type,
      owner_source_id,
      owner_id,
      title,
      description,
      keywords,
      robots,
      published_at
    ) VALUES (
      'article',
      :ownerSourceId,
      :ownerId,
      :title,
      :description,
      :keywords,
      'index,follow',
      :publishedAt
    )`,
    {
      ownerSourceId: input.ownerSourceId,
      ownerId: input.articleId,
      title: seoTitle,
      description: seoDescription,
      keywords,
      publishedAt: input.publishedAt,
    },
  );

  input.counts.insertedCount += 1;
  addWrite(input.counts.actualWrites, 'seo_settings', 'inserted');
  return 1;
}

async function upsertArticleFaqItems(input: {
  context: MigrationContext;
  counts: CountableWrite;
  article: Record<string, unknown>;
  articleId: number;
  ownerSourceId: string;
}): Promise<number> {
  const rawFaqItems = input.article.faqItems ?? input.article.faq_items;
  const faqItems = Array.isArray(rawFaqItems) ? rawFaqItems.filter(isRecord) : [];
  let writtenCount = 0;

  for (const [index, faqItem] of faqItems.entries()) {
    const question = asNullableString(faqItem.question ?? faqItem.q);
    const answer = asNullableString(faqItem.answer ?? faqItem.a);
    const sortOrder = asNumber(faqItem.sortOrder ?? faqItem.sort_order, index + 1);

    if (!question || !answer || question.length > 300) {
      input.counts.skippedCount += 1;
      addWrite(input.counts.actualWrites, 'faq_items', 'skipped');
      input.counts.warnings.push({
        code: 'article_faq_item_skipped',
        level: 'warning',
        message: `Skipped article FAQ item at sort_order ${sortOrder} for ${input.ownerSourceId}.`,
      });
      continue;
    }

    const existingId = await findId(
      input.context.pool,
      `SELECT id
       FROM faq_items
       WHERE owner_type = 'article'
         AND owner_source_id = :ownerSourceId
         AND sort_order = :sortOrder
         AND question = :question
       LIMIT 1`,
      {
        ownerSourceId: input.ownerSourceId,
        sortOrder,
        question,
      },
    );

    if (existingId) {
      await input.context.pool.execute(
        `UPDATE faq_items
         SET owner_id = :ownerId,
             answer = :answer,
             status = :status,
             deleted_at = NULL
         WHERE id = :id`,
        {
          id: existingId,
          ownerId: input.articleId,
          answer,
          status: asString(faqItem.status, 'active'),
        },
      );

      input.counts.updatedCount += 1;
      addWrite(input.counts.actualWrites, 'faq_items', 'updated');
      writtenCount += 1;
      continue;
    }

    await input.context.pool.execute(
      `INSERT INTO faq_items (
        owner_type,
        owner_source_id,
        owner_id,
        question,
        answer,
        sort_order,
        status
      ) VALUES (
        'article',
        :ownerSourceId,
        :ownerId,
        :question,
        :answer,
        :sortOrder,
        :status
      )`,
      {
        ownerSourceId: input.ownerSourceId,
        ownerId: input.articleId,
        question,
        answer,
        sortOrder,
        status: asString(faqItem.status, 'active'),
      },
    );

    input.counts.insertedCount += 1;
    addWrite(input.counts.actualWrites, 'faq_items', 'inserted');
    writtenCount += 1;
  }

  return writtenCount;
}

async function migrateArticles(context: MigrationContext): Promise<CountableWrite> {
  const source = await loadSource(context.definition);
  const articles = Array.isArray(source.data) ? source.data.filter(isRecord) : [];
  const counts = emptyWrites();
  const categoryIdBySlug = await upsertArticleCategories(context, articles, counts);
  let articleCount = 0;
  let seoCount = 0;
  let faqCount = 0;
  let skippedArticleCount = 0;
  const hasExplicitBlocks = articles.some((article) => Array.isArray(article.blocks) && article.blocks.length > 0);

  for (const [index, article] of articles.entries()) {
    const title = asString(article.title).trim();
    const slug = asString(article.slug).trim();

    if (!title || !slug) {
      skippedArticleCount += 1;
      counts.skippedCount += 1;
      addWrite(counts.actualWrites, 'articles', 'skipped');
      counts.warnings.push({
        code: 'article_missing_required_field',
        level: 'warning',
        message: `Skipped article at index ${index}; title and slug are required.`,
      });
      continue;
    }

    const sourceId = getArticleSourceId(article);
    const categorySlug = getArticleCategorySlug(article);
    const categoryId = categorySlug ? categoryIdBySlug.get(categorySlug) ?? null : null;
    const status = getArticleStatus(article);
    const publishedAt = status === 'published'
      ? asDate(article.publishedAt ?? article.published_at ?? article.updatedAt ?? article.createdAt)
      : null;
    const exists = sourceId
      ? await rowExists(
          context.pool,
          'SELECT COUNT(*) AS count FROM articles WHERE source_id = :sourceId OR slug = :slug',
          { sourceId, slug },
        )
      : await rowExists(context.pool, 'SELECT COUNT(*) AS count FROM articles WHERE slug = :slug', { slug });

    await context.pool.execute(
      `INSERT INTO articles (
        source_id,
        category_id,
        category_slug,
        title,
        slug,
        summary,
        content,
        cover_media_id,
        cover_url,
        tags_json,
        status,
        sort_order,
        is_home_featured,
        published_at
      ) VALUES (
        :sourceId,
        :categoryId,
        :categorySlug,
        :title,
        :slug,
        :summary,
        :content,
        NULL,
        :coverUrl,
        :tagsJson,
        :status,
        :sortOrder,
        :isHomeFeatured,
        :publishedAt
      )
      ON DUPLICATE KEY UPDATE
        source_id = VALUES(source_id),
        category_id = VALUES(category_id),
        category_slug = VALUES(category_slug),
        title = VALUES(title),
        summary = VALUES(summary),
        content = VALUES(content),
        cover_url = VALUES(cover_url),
        tags_json = VALUES(tags_json),
        status = VALUES(status),
        sort_order = VALUES(sort_order),
        is_home_featured = VALUES(is_home_featured),
        published_at = VALUES(published_at),
        deleted_at = NULL`,
      {
        sourceId,
        categoryId,
        categorySlug,
        title,
        slug,
        summary: asNullableString(article.summary),
        content: asNullableString(article.content ?? article.content_html ?? article.body),
        coverUrl: asNullableString(article.coverUrl ?? article.cover_url),
        tagsJson: getArticleTagsJson(article),
        status,
        sortOrder: asNumber(article.sortOrder ?? article.sort_order, index + 1),
        isHomeFeatured: asBoolean(article.isHomeFeatured ?? article.is_home_featured, false) ? 1 : 0,
        publishedAt,
      },
    );

    counts[exists ? 'updatedCount' : 'insertedCount'] += 1;
    addWrite(counts.actualWrites, 'articles', exists ? 'updated' : 'inserted');
    articleCount += 1;

    const articleId = await findArticleId(context.pool, sourceId, slug);
    const ownerSourceId = sourceId ?? slug;

    if (!articleId) {
      counts.warnings.push({
        code: 'article_id_missing',
        level: 'warning',
        message: `Could not resolve article id for slug "${slug}"; SEO and FAQ rows skipped.`,
      });
      continue;
    }

    seoCount += await upsertArticleSeo({
      context,
      counts,
      article,
      articleId,
      ownerSourceId,
      publishedAt,
    });
    faqCount += await upsertArticleFaqItems({
      context,
      counts,
      article,
      articleId,
      ownerSourceId,
    });
  }

  if (seoCount === 0) {
    counts.warnings.push({
      code: 'articles_seo_empty',
      level: 'info',
      message: 'No article SEO fields were found; seo_settings was skipped for articles.',
    });
  }

  if (faqCount === 0) {
    counts.warnings.push({
      code: 'articles_faq_empty',
      level: 'info',
      message: 'No article FAQ items were found; faq_items was skipped for articles.',
    });
  }

  if (!hasExplicitBlocks) {
    counts.warnings.push({
      code: 'article_blocks_not_written',
      level: 'info',
      message: 'articles.json stores article body as whole content; article_blocks was not written.',
    });
  }

  counts.details = {
    categoryCount: categoryIdBySlug.size,
    articleCount,
    seoCount,
    faqCount,
    articleBlockCount: 0,
    skippedArticleCount,
    articleBlocksSkippedReason: hasExplicitBlocks ? null : 'source_has_whole_content_without_blocks',
    faqSkippedReason: faqCount === 0 ? 'source_has_no_faq_items' : null,
    seoSkippedReason: seoCount === 0 ? 'source_has_no_seo_fields' : null,
  };

  return counts;
}

type MediaLibraryEntry = {
  sourceKey: string;
  record: Record<string, unknown>;
};

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
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  category: string;
  altText: string | null;
  description: string | null;
  status: string;
  stableKey: MediaStableKey | null;
};

function firstString(record: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = asNullableString(record[key]);

    if (value) {
      return value;
    }
  }

  return null;
}

function buildMediaLibraryEntries(data: unknown): MediaLibraryEntry[] {
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
      .filter((entry): entry is MediaLibraryEntry => Boolean(entry));
  }

  if (!isRecord(data)) {
    return [];
  }

  return Object.entries(data)
    .map(([sourceKey, item]) => {
      if (!isRecord(item)) {
        return null;
      }

      return {
        sourceKey,
        record: item,
      };
    })
    .filter((entry): entry is MediaLibraryEntry => Boolean(entry));
}

function normalizeMediaCategory(category: string | null): string {
  const fallback = 'general';
  const normalized = category ?? fallback;

  return normalized.length > 80 ? normalized.slice(0, 80) : normalized;
}

function getMediaFileName(entry: MediaLibraryEntry, publicUrl: string | null): string | null {
  const explicitFileName = firstString(
    entry.record,
    'fileName',
    'file_name',
    'storageFileName',
    'storage_file_name',
    'name',
  );

  if (explicitFileName) {
    return explicitFileName;
  }

  return normalizeFileName(publicUrl, null) ?? entry.sourceKey;
}

function getMediaStatus(record: Record<string, unknown>): string {
  const status = firstString(record, 'status');

  if (status) {
    return status;
  }

  return asBoolean(record.enabled ?? record.is_enabled, true) ? 'active' : 'inactive';
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

function prepareMediaFile(entry: MediaLibraryEntry): PreparedMediaFile {
  const publicUrl = normalizeMediaPath(firstString(entry.record, 'publicUrl', 'public_url', 'url'));
  const sourceFilePath = normalizeMediaPath(firstString(entry.record, 'filePath', 'file_path', 'path'));
  const fileName = getMediaFileName(entry, publicUrl);
  const originalName = firstString(entry.record, 'originalName', 'original_name');
  const displayName = firstString(entry.record, 'displayName', 'display_name', 'title');
  const fileSize = asOptionalUnsignedInteger(entry.record.fileSize ?? entry.record.file_size ?? entry.record.size) ?? 0;
  const fileExt = firstString(entry.record, 'fileExt', 'file_ext') ?? (fileName ? extFromFileName(fileName) : null);
  const mimeType = firstString(entry.record, 'mimeType', 'mime_type') ?? (fileName ? mimeFromFileName(fileName) : null);
  const filePathForWrite = sourceFilePath ?? publicUrl;
  const publicUrlForWrite = publicUrl ?? sourceFilePath;

  return {
    sourceKey: entry.sourceKey,
    sourceRecord: entry.record,
    fileName,
    originalName,
    displayName,
    publicUrl,
    sourceFilePath,
    filePathForWrite,
    publicUrlForWrite,
    mimeType,
    fileExt,
    fileSize,
    width: asOptionalUnsignedInteger(entry.record.width),
    height: asOptionalUnsignedInteger(entry.record.height),
    durationSeconds: asOptionalNumber(entry.record.durationSeconds ?? entry.record.duration_seconds ?? entry.record.duration),
    category: normalizeMediaCategory(firstString(entry.record, 'category', 'fileType', 'file_type')),
    altText: firstString(entry.record, 'altText', 'alt_text', 'alt', 'displayName', 'display_name', 'title'),
    description: firstString(entry.record, 'description', 'caption'),
    status: getMediaStatus(entry.record),
    stableKey: buildMediaStableKey({
      publicUrl,
      filePath: sourceFilePath,
      fileName,
      fileSize,
    }),
  };
}

function buildMediaLibraryMetadata(prepared: PreparedMediaFile): string {
  return JSON.stringify({
    moduleName: 'media-library',
    sourceKey: prepared.sourceKey,
    displayName: prepared.displayName,
    title: firstString(prepared.sourceRecord, 'title'),
    fileType: firstString(prepared.sourceRecord, 'fileType', 'file_type'),
    ownerType: firstString(prepared.sourceRecord, 'ownerType', 'owner_type'),
    ownerId: prepared.sourceRecord.ownerId ?? prepared.sourceRecord.owner_id ?? null,
    ownerSlug: firstString(prepared.sourceRecord, 'ownerSlug', 'owner_slug'),
    groupKey: firstString(prepared.sourceRecord, 'groupKey', 'group_key'),
    slotNo: asOptionalUnsignedInteger(prepared.sourceRecord.slotNo ?? prepared.sourceRecord.slot_no),
    caption: firstString(prepared.sourceRecord, 'caption'),
    enabled: asBoolean(prepared.sourceRecord.enabled ?? prepared.sourceRecord.is_enabled, true),
    sortOrder: asOptionalUnsignedInteger(prepared.sourceRecord.sortOrder ?? prepared.sourceRecord.sort_order),
    createdAt: firstString(prepared.sourceRecord, 'createdAt', 'created_at'),
    dedupeKey: prepared.stableKey
      ? {
          type: prepared.stableKey.type,
          value: prepared.stableKey.value,
        }
      : null,
    sourceRecord: prepared.sourceRecord,
  });
}

async function findMediaFileByStableKey(
  pool: DbExecutor,
  stableKey: MediaStableKey,
): Promise<number | null> {
  if (stableKey.type === 'public_url') {
    return findId(pool, 'SELECT id FROM media_files WHERE public_url = :publicUrl LIMIT 1', {
      publicUrl: stableKey.value,
    });
  }

  if (stableKey.type === 'file_path') {
    return findId(pool, 'SELECT id FROM media_files WHERE file_path = :filePath LIMIT 1', {
      filePath: stableKey.value,
    });
  }

  return findId(
    pool,
    'SELECT id FROM media_files WHERE file_name = :fileName AND file_size = :fileSize LIMIT 1',
    {
      fileName: stableKey.fileName,
      fileSize: stableKey.fileSize,
    },
  );
}

async function writePreparedMediaFile(
  context: MigrationContext,
  prepared: PreparedMediaFile,
  existingId: number | null,
): Promise<'inserted' | 'updated' | 'skipped'> {
  if (!prepared.fileName) {
    return 'skipped';
  }

  if (existingId) {
    await context.pool.execute(
      `UPDATE media_files
       SET file_name = :fileName,
           original_name = :originalName,
           file_path = COALESCE(:filePath, file_path),
           public_url = COALESCE(:publicUrl, public_url),
           mime_type = :mimeType,
           file_ext = :fileExt,
           file_size = :fileSize,
           width = :width,
           height = :height,
           duration_seconds = :durationSeconds,
           category = CASE WHEN category = 'general' THEN :category ELSE category END,
           alt_text = :altText,
           description = :description,
           metadata_json = :metadataJson,
           status = :status,
           deleted_at = NULL
       WHERE id = :id`,
      {
        id: existingId,
        fileName: prepared.fileName,
        originalName: prepared.originalName ?? prepared.fileName,
        filePath: prepared.filePathForWrite,
        publicUrl: prepared.publicUrlForWrite,
        mimeType: prepared.mimeType,
        fileExt: prepared.fileExt,
        fileSize: prepared.fileSize,
        width: prepared.width,
        height: prepared.height,
        durationSeconds: prepared.durationSeconds,
        category: prepared.category,
        altText: prepared.altText,
        description: prepared.description,
        metadataJson: buildMediaLibraryMetadata(prepared),
        status: prepared.status,
      },
    );

    return 'updated';
  }

  if (!prepared.publicUrlForWrite) {
    return 'skipped';
  }

  await context.pool.execute(
    `INSERT INTO media_files (
      file_name,
      original_name,
      file_path,
      public_url,
      mime_type,
      file_ext,
      file_size,
      width,
      height,
      duration_seconds,
      category,
      alt_text,
      description,
      metadata_json,
      status
    ) VALUES (
      :fileName,
      :originalName,
      :filePath,
      :publicUrl,
      :mimeType,
      :fileExt,
      :fileSize,
      :width,
      :height,
      :durationSeconds,
      :category,
      :altText,
      :description,
      :metadataJson,
      :status
    )
    ON DUPLICATE KEY UPDATE
      file_name = VALUES(file_name),
      original_name = VALUES(original_name),
      file_path = VALUES(file_path),
      mime_type = VALUES(mime_type),
      file_ext = VALUES(file_ext),
      file_size = VALUES(file_size),
      width = VALUES(width),
      height = VALUES(height),
      duration_seconds = VALUES(duration_seconds),
      category = CASE WHEN category = 'general' THEN VALUES(category) ELSE category END,
      alt_text = VALUES(alt_text),
      description = VALUES(description),
      metadata_json = VALUES(metadata_json),
      status = VALUES(status),
      deleted_at = NULL`,
    {
      fileName: prepared.fileName,
      originalName: prepared.originalName ?? prepared.fileName,
      filePath: prepared.filePathForWrite,
      publicUrl: prepared.publicUrlForWrite,
      mimeType: prepared.mimeType,
      fileExt: prepared.fileExt,
      fileSize: prepared.fileSize,
      width: prepared.width,
      height: prepared.height,
      durationSeconds: prepared.durationSeconds,
      category: prepared.category,
      altText: prepared.altText,
      description: prepared.description,
      metadataJson: buildMediaLibraryMetadata(prepared),
      status: prepared.status,
    },
  );

  return 'inserted';
}

async function migrateMediaLibrary(context: MigrationContext): Promise<CountableWrite> {
  const source = await loadSource(context.definition);
  const entries = buildMediaLibraryEntries(source.data);
  const counts = emptyWrites();
  const nonRecordSkippedCount = Math.max(0, context.plan.sourceCount - entries.length);
  const seenStableKeys = new Set<string>();
  const duplicateStableKeys = new Set<string>();
  const dedupeKeyCounts = {
    publicUrl: 0,
    filePath: 0,
    fileNameAndFileSize: 0,
  };
  let mediaFilesCount = 0;
  let missingPublicUrlCount = 0;
  let missingFilePathCount = 0;
  let missingStableKeyCount = 0;
  let missingWritablePathCount = 0;
  let duplicateCount = 0;

  if (nonRecordSkippedCount > 0) {
    counts.skippedCount += nonRecordSkippedCount;
    addWrite(counts.actualWrites, 'media_files', 'skipped', nonRecordSkippedCount);
  }

  for (const entry of entries) {
    const prepared = prepareMediaFile(entry);

    if (!prepared.publicUrl) {
      missingPublicUrlCount += 1;
    }

    if (!prepared.sourceFilePath) {
      missingFilePathCount += 1;
    }

    if (!prepared.stableKey) {
      missingStableKeyCount += 1;
      counts.skippedCount += 1;
      addWrite(counts.actualWrites, 'media_files', 'skipped');
      continue;
    }

    if (prepared.stableKey.type === 'public_url') {
      dedupeKeyCounts.publicUrl += 1;
    } else if (prepared.stableKey.type === 'file_path') {
      dedupeKeyCounts.filePath += 1;
    } else {
      dedupeKeyCounts.fileNameAndFileSize += 1;
    }

    const stableKeyLabel = `${prepared.stableKey.type}:${prepared.stableKey.value}`;

    if (seenStableKeys.has(stableKeyLabel)) {
      duplicateCount += 1;
      duplicateStableKeys.add(stableKeyLabel);
      counts.skippedCount += 1;
      addWrite(counts.actualWrites, 'media_files', 'skipped');
      continue;
    }

    seenStableKeys.add(stableKeyLabel);

    const existingId = await findMediaFileByStableKey(context.pool, prepared.stableKey);
    const writeKind = await writePreparedMediaFile(context, prepared, existingId);

    if (writeKind === 'skipped') {
      missingWritablePathCount += 1;
      counts.skippedCount += 1;
      addWrite(counts.actualWrites, 'media_files', 'skipped');
      continue;
    }

    counts[writeKind === 'inserted' ? 'insertedCount' : 'updatedCount'] += 1;
    addWrite(counts.actualWrites, 'media_files', writeKind);
    mediaFilesCount += 1;
  }

  if (missingPublicUrlCount > 0) {
    counts.warnings.push({
      code: 'media_library_missing_public_url',
      level: 'warning',
      message: `${missingPublicUrlCount} media-library records have no public_url/url; file_path is used when available.`,
    });
  }

  if (nonRecordSkippedCount > 0) {
    counts.warnings.push({
      code: 'media_library_non_record_source',
      level: 'warning',
      message: `${nonRecordSkippedCount} media-library source entries were skipped because they are not JSON objects.`,
    });
  }

  if (missingFilePathCount > 0) {
    counts.warnings.push({
      code: 'media_library_missing_file_path',
      level: 'warning',
      message: `${missingFilePathCount} media-library records have no source file_path; public_url is used as the shadow file_path fallback.`,
    });
  }

  if (missingStableKeyCount > 0) {
    counts.warnings.push({
      code: 'media_library_missing_stable_key',
      level: 'warning',
      message: `${missingStableKeyCount} media-library records were skipped because no stable dedupe key could be formed.`,
    });
  }

  if (missingWritablePathCount > 0) {
    counts.warnings.push({
      code: 'media_library_missing_writable_path',
      level: 'warning',
      message: `${missingWritablePathCount} media-library records matched only file_name+file_size and could not be inserted without public_url or file_path.`,
    });
  }

  if (duplicateCount > 0) {
    counts.warnings.push({
      code: 'media_library_duplicate_stable_key',
      level: 'warning',
      message: `${duplicateCount} media-library duplicate source records were skipped across ${duplicateStableKeys.size} duplicate stable keys.`,
    });
  }

  counts.details = {
    sourceCount: context.plan.sourceCount,
    mediaFilesCount,
    missingPublicUrlCount,
    missingFilePathCount,
    missingStableKeyCount,
    missingWritablePathCount,
    nonRecordSkippedCount,
    duplicateCount,
    duplicateKeyCount: duplicateStableKeys.size,
    uniqueStableKeyCount: seenStableKeys.size,
    dedupeStrategy: ['public_url', 'file_path', 'file_name+file_size'],
    dedupeKeyCounts,
    inserted: {
      media_files: counts.actualWrites.find((write) => write.table === 'media_files')?.inserted ?? 0,
    },
    updated: {
      media_files: counts.actualWrites.find((write) => write.table === 'media_files')?.updated ?? 0,
    },
    skipped: {
      media_files: counts.actualWrites.find((write) => write.table === 'media_files')?.skipped ?? 0,
    },
    duplicate: {
      media_files: duplicateCount,
    },
  };

  return counts;
}

type ShadowMediaFileInput = {
  moduleName: string;
  sourceKey: string;
  role: string;
  publicUrl: string | null;
  filePath?: string | null;
  fileName?: string | null;
  originalName?: string | null;
  displayName?: string | null;
  mimeType?: string | null;
  fileExt?: string | null;
  fileSize?: number | null;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  category: string;
  altText?: string | null;
  description?: string | null;
  status?: string | null;
  metadata?: Record<string, unknown>;
};

type ShadowMediaFileWrite = {
  mediaId: number | null;
  writeKind: 'inserted' | 'updated' | 'skipped';
  stableKey: MediaStableKey | null;
};

function buildShadowMediaMetadata(input: ShadowMediaFileInput, stableKey: MediaStableKey | null): string {
  return JSON.stringify({
    moduleName: input.moduleName,
    sourceKey: input.sourceKey,
    role: input.role,
    displayName: input.displayName,
    dedupeKey: stableKey
      ? {
          type: stableKey.type,
          value: stableKey.value,
        }
      : null,
    ...(input.metadata ?? {}),
  });
}

async function upsertShadowMediaFile(
  context: MigrationContext,
  counts: CountableWrite,
  input: ShadowMediaFileInput,
): Promise<ShadowMediaFileWrite> {
  const publicUrl = normalizeMediaPath(input.publicUrl);
  const sourceFilePath = normalizeMediaPath(input.filePath ?? null);
  const publicUrlForWrite = publicUrl ?? sourceFilePath;
  const filePathForWrite = sourceFilePath ?? publicUrl;
  const fileName = input.fileName ?? normalizeFileName(publicUrlForWrite, null);
  const fileSize = input.fileSize ?? 0;
  const stableKey = buildMediaStableKey({
    publicUrl,
    filePath: sourceFilePath,
    fileName,
    fileSize,
  });

  if (!stableKey || !fileName) {
    counts.skippedCount += 1;
    addWrite(counts.actualWrites, 'media_files', 'skipped');
    return {
      mediaId: null,
      writeKind: 'skipped',
      stableKey,
    };
  }

  const existingId = await findMediaFileByStableKey(context.pool, stableKey);

  if (!existingId && !publicUrlForWrite) {
    counts.skippedCount += 1;
    addWrite(counts.actualWrites, 'media_files', 'skipped');
    return {
      mediaId: null,
      writeKind: 'skipped',
      stableKey,
    };
  }

  const mimeType = input.mimeType ?? (fileName ? mimeFromFileName(fileName) : null);
  const fileExt = input.fileExt ?? (fileName ? extFromFileName(fileName) : null);
  const metadataJson = buildShadowMediaMetadata(input, stableKey);
  const params = {
    fileName,
    originalName: input.originalName ?? fileName,
    filePath: filePathForWrite,
    publicUrl: publicUrlForWrite,
    mimeType,
    fileExt,
    fileSize,
    width: input.width ?? null,
    height: input.height ?? null,
    durationSeconds: input.durationSeconds ?? null,
    category: normalizeMediaCategory(input.category),
    altText: input.altText ?? null,
    description: input.description ?? null,
    metadataJson,
    status: input.status ?? 'active',
  };

  if (existingId) {
    await context.pool.execute(
      `UPDATE media_files
       SET file_name = :fileName,
           original_name = COALESCE(:originalName, original_name, :fileName),
           file_path = COALESCE(:filePath, file_path),
           public_url = COALESCE(:publicUrl, public_url),
           mime_type = COALESCE(:mimeType, mime_type),
           file_ext = COALESCE(:fileExt, file_ext),
           file_size = CASE WHEN :fileSize > 0 THEN :fileSize ELSE file_size END,
           width = COALESCE(:width, width),
           height = COALESCE(:height, height),
           duration_seconds = COALESCE(:durationSeconds, duration_seconds),
           category = :category,
           alt_text = COALESCE(:altText, alt_text),
           description = COALESCE(:description, description),
           metadata_json = :metadataJson,
           status = :status,
           deleted_at = NULL
       WHERE id = :id`,
      {
        id: existingId,
        ...params,
      },
    );

    counts.updatedCount += 1;
    addWrite(counts.actualWrites, 'media_files', 'updated');
    return {
      mediaId: existingId,
      writeKind: 'updated',
      stableKey,
    };
  }

  await context.pool.execute(
    `INSERT INTO media_files (
      file_name,
      original_name,
      file_path,
      public_url,
      mime_type,
      file_ext,
      file_size,
      width,
      height,
      duration_seconds,
      category,
      alt_text,
      description,
      metadata_json,
      status
    ) VALUES (
      :fileName,
      :originalName,
      :filePath,
      :publicUrl,
      :mimeType,
      :fileExt,
      :fileSize,
      :width,
      :height,
      :durationSeconds,
      :category,
      :altText,
      :description,
      :metadataJson,
      :status
    )
    ON DUPLICATE KEY UPDATE
      file_name = VALUES(file_name),
      original_name = VALUES(original_name),
      file_path = VALUES(file_path),
      mime_type = VALUES(mime_type),
      file_ext = VALUES(file_ext),
      file_size = CASE WHEN VALUES(file_size) > 0 THEN VALUES(file_size) ELSE file_size END,
      width = COALESCE(VALUES(width), width),
      height = COALESCE(VALUES(height), height),
      duration_seconds = COALESCE(VALUES(duration_seconds), duration_seconds),
      category = VALUES(category),
      alt_text = COALESCE(VALUES(alt_text), alt_text),
      description = COALESCE(VALUES(description), description),
      metadata_json = VALUES(metadata_json),
      status = VALUES(status),
      deleted_at = NULL`,
    params,
  );

  const mediaId = await findMediaFileByStableKey(context.pool, stableKey);

  counts.insertedCount += 1;
  addWrite(counts.actualWrites, 'media_files', 'inserted');
  return {
    mediaId,
    writeKind: 'inserted',
    stableKey,
  };
}

function getCaseSourceId(caseRecord: Record<string, unknown>): string | null {
  return asNullableString(caseRecord.sourceId ?? caseRecord.source_id ?? caseRecord.id);
}

function getCaseStatus(caseRecord: Record<string, unknown>): string {
  const status = asNullableString(caseRecord.status);

  if (status) {
    return status;
  }

  return asBoolean(caseRecord.published ?? caseRecord.enabled ?? caseRecord.is_enabled, false) ? 'published' : 'draft';
}

async function findCaseId(pool: DbExecutor, sourceId: string | null, slug: string): Promise<number | null> {
  if (sourceId) {
    return findId(pool, 'SELECT id FROM cases WHERE source_id = :sourceId OR slug = :slug LIMIT 1', {
      sourceId,
      slug,
    });
  }

  return findId(pool, 'SELECT id FROM cases WHERE slug = :slug LIMIT 1', { slug });
}

function buildCaseImageEntries(caseRecord: Record<string, unknown>): Record<string, unknown>[] {
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

function getCaseImageUrl(image: Record<string, unknown>): string | null {
  return normalizeMediaPath(firstString(image, 'url', 'imageUrl', 'image_url', 'publicUrl', 'public_url', 'src'));
}

async function upsertCaseSeo(input: {
  context: MigrationContext;
  counts: CountableWrite;
  caseRecord: Record<string, unknown>;
  caseId: number;
  ownerSourceId: string;
  publishedAt: Date | null;
}): Promise<number> {
  const seoTitle = asNullableString(input.caseRecord.seoTitle ?? input.caseRecord.seo_title);
  const seoDescription = asNullableString(input.caseRecord.seoDescription ?? input.caseRecord.seo_description);
  const keywords = asNullableString(input.caseRecord.keywords);

  if (!seoTitle && !seoDescription && !keywords) {
    return 0;
  }

  const existingId = await findId(
    input.context.pool,
    `SELECT id
     FROM seo_settings
     WHERE owner_type = 'case'
       AND (owner_source_id = :ownerSourceId OR owner_id = :ownerId)
     LIMIT 1`,
    {
      ownerSourceId: input.ownerSourceId,
      ownerId: input.caseId,
    },
  );

  if (existingId) {
    await input.context.pool.execute(
      `UPDATE seo_settings
       SET owner_source_id = :ownerSourceId,
           owner_id = :ownerId,
           title = :title,
           description = :description,
           keywords = :keywords,
           robots = 'index,follow',
           published_at = :publishedAt,
           deleted_at = NULL
       WHERE id = :id`,
      {
        id: existingId,
        ownerSourceId: input.ownerSourceId,
        ownerId: input.caseId,
        title: seoTitle,
        description: seoDescription,
        keywords,
        publishedAt: input.publishedAt,
      },
    );

    input.counts.updatedCount += 1;
    addWrite(input.counts.actualWrites, 'seo_settings', 'updated');
    return 1;
  }

  await input.context.pool.execute(
    `INSERT INTO seo_settings (
      owner_type,
      owner_source_id,
      owner_id,
      title,
      description,
      keywords,
      robots,
      published_at
    ) VALUES (
      'case',
      :ownerSourceId,
      :ownerId,
      :title,
      :description,
      :keywords,
      'index,follow',
      :publishedAt
    )`,
    {
      ownerSourceId: input.ownerSourceId,
      ownerId: input.caseId,
      title: seoTitle,
      description: seoDescription,
      keywords,
      publishedAt: input.publishedAt,
    },
  );

  input.counts.insertedCount += 1;
  addWrite(input.counts.actualWrites, 'seo_settings', 'inserted');
  return 1;
}

async function upsertCaseFaqItems(input: {
  context: MigrationContext;
  counts: CountableWrite;
  caseRecord: Record<string, unknown>;
  caseId: number;
  ownerSourceId: string;
}): Promise<number> {
  const rawFaqItems = input.caseRecord.faqItems ?? input.caseRecord.faq_items;
  const faqItems = Array.isArray(rawFaqItems) ? rawFaqItems.filter(isRecord) : [];
  let writtenCount = 0;

  for (const [index, faqItem] of faqItems.entries()) {
    const question = asNullableString(faqItem.question ?? faqItem.q);
    const answer = asNullableString(faqItem.answer ?? faqItem.a);
    const sortOrder = asNumber(faqItem.sortOrder ?? faqItem.sort_order, index + 1);

    if (!question || !answer || question.length > 300) {
      input.counts.skippedCount += 1;
      addWrite(input.counts.actualWrites, 'faq_items', 'skipped');
      input.counts.warnings.push({
        code: 'case_faq_item_skipped',
        level: 'warning',
        message: `Skipped case FAQ item at sort_order ${sortOrder} for ${input.ownerSourceId}.`,
      });
      continue;
    }

    const existingId = await findId(
      input.context.pool,
      `SELECT id
       FROM faq_items
       WHERE owner_type = 'case'
         AND owner_source_id = :ownerSourceId
         AND sort_order = :sortOrder
         AND question = :question
       LIMIT 1`,
      {
        ownerSourceId: input.ownerSourceId,
        sortOrder,
        question,
      },
    );

    if (existingId) {
      await input.context.pool.execute(
        `UPDATE faq_items
         SET owner_id = :ownerId,
             answer = :answer,
             status = :status,
             deleted_at = NULL
         WHERE id = :id`,
        {
          id: existingId,
          ownerId: input.caseId,
          answer,
          status: asString(faqItem.status, 'active'),
        },
      );

      input.counts.updatedCount += 1;
      addWrite(input.counts.actualWrites, 'faq_items', 'updated');
      writtenCount += 1;
      continue;
    }

    await input.context.pool.execute(
      `INSERT INTO faq_items (
        owner_type,
        owner_source_id,
        owner_id,
        question,
        answer,
        sort_order,
        status
      ) VALUES (
        'case',
        :ownerSourceId,
        :ownerId,
        :question,
        :answer,
        :sortOrder,
        :status
      )`,
      {
        ownerSourceId: input.ownerSourceId,
        ownerId: input.caseId,
        question,
        answer,
        sortOrder,
        status: asString(faqItem.status, 'active'),
      },
    );

    input.counts.insertedCount += 1;
    addWrite(input.counts.actualWrites, 'faq_items', 'inserted');
    writtenCount += 1;
  }

  return writtenCount;
}

async function upsertCaseImages(input: {
  context: MigrationContext;
  counts: CountableWrite;
  caseRecord: Record<string, unknown>;
  caseId: number;
  ownerSourceId: string;
}): Promise<{
  caseImagesCount: number;
  mediaFilesCount: number;
  missingImageUrlCount: number;
  duplicateCount: number;
}> {
  const imageEntries = buildCaseImageEntries(input.caseRecord);
  const seenImageKeys = new Set<string>();
  let caseImagesCount = 0;
  let mediaFilesCount = 0;
  let missingImageUrlCount = 0;
  let duplicateCount = 0;

  for (const [index, image] of imageEntries.entries()) {
    const imageUrl = getCaseImageUrl(image);
    const sortOrder = asNumber(image.sortOrder ?? image.sort_order, index + 1);

    if (!imageUrl) {
      missingImageUrlCount += 1;
      input.counts.skippedCount += 1;
      addWrite(input.counts.actualWrites, 'case_images', 'skipped');
      input.counts.warnings.push({
        code: 'case_image_url_missing',
        level: 'warning',
        message: `Skipped case image at sort_order ${sortOrder} for ${input.ownerSourceId}; image URL is empty.`,
      });
      continue;
    }

    const imageKey = `${input.caseId}:${imageUrl}:${sortOrder}`;

    if (seenImageKeys.has(imageKey)) {
      duplicateCount += 1;
      input.counts.skippedCount += 1;
      addWrite(input.counts.actualWrites, 'case_images', 'skipped');
      continue;
    }

    seenImageKeys.add(imageKey);

    const fileName = firstString(image, 'fileName', 'file_name', 'storageFileName', 'storage_file_name')
      ?? normalizeFileName(imageUrl, null);
    const mediaWrite = await upsertShadowMediaFile(input.context, input.counts, {
      moduleName: 'cases',
      sourceKey: `${input.ownerSourceId}:image:${sortOrder}`,
      role: 'case_image',
      publicUrl: imageUrl,
      filePath: firstString(image, 'filePath', 'file_path', 'path') ?? imageUrl,
      fileName,
      originalName: firstString(image, 'originalName', 'original_name') ?? fileName,
      displayName: firstString(image, 'displayName', 'display_name', 'title'),
      fileSize: asOptionalUnsignedInteger(image.fileSize ?? image.file_size ?? image.size),
      width: asOptionalUnsignedInteger(image.width),
      height: asOptionalUnsignedInteger(image.height),
      category: 'case-image',
      altText: firstString(image, 'altText', 'alt_text', 'alt', 'displayName', 'display_name', 'title'),
      description: firstString(image, 'description', 'caption'),
      status: asBoolean(image.enabled ?? image.is_enabled, true) ? 'active' : 'inactive',
      metadata: {
        ownerType: 'case',
        ownerSourceId: input.ownerSourceId,
        caseId: input.caseId,
        sortOrder,
        sourceRecord: image,
      },
    });

    if (mediaWrite.writeKind !== 'skipped') {
      mediaFilesCount += 1;
    }

    const existingId = await findId(
      input.context.pool,
      `SELECT id
       FROM case_images
       WHERE case_id = :caseId
         AND image_url = :imageUrl
         AND sort_order = :sortOrder
       LIMIT 1`,
      {
        caseId: input.caseId,
        imageUrl,
        sortOrder,
      },
    );

    if (existingId) {
      await input.context.pool.execute(
        `UPDATE case_images
         SET media_id = :mediaId,
             alt_text = :altText,
             caption = :caption,
             is_enabled = :isEnabled,
             deleted_at = NULL
         WHERE id = :id`,
        {
          id: existingId,
          mediaId: mediaWrite.mediaId,
          altText: firstString(image, 'altText', 'alt_text', 'alt'),
          caption: firstString(image, 'caption'),
          isEnabled: asBoolean(image.enabled ?? image.is_enabled, true) ? 1 : 0,
        },
      );

      input.counts.updatedCount += 1;
      addWrite(input.counts.actualWrites, 'case_images', 'updated');
      caseImagesCount += 1;
      continue;
    }

    await input.context.pool.execute(
      `INSERT INTO case_images (
        case_id,
        media_id,
        image_url,
        alt_text,
        caption,
        sort_order,
        is_enabled
      ) VALUES (
        :caseId,
        :mediaId,
        :imageUrl,
        :altText,
        :caption,
        :sortOrder,
        :isEnabled
      )`,
      {
        caseId: input.caseId,
        mediaId: mediaWrite.mediaId,
        imageUrl,
        altText: firstString(image, 'altText', 'alt_text', 'alt'),
        caption: firstString(image, 'caption'),
        sortOrder,
        isEnabled: asBoolean(image.enabled ?? image.is_enabled, true) ? 1 : 0,
      },
    );

    input.counts.insertedCount += 1;
    addWrite(input.counts.actualWrites, 'case_images', 'inserted');
    caseImagesCount += 1;
  }

  return {
    caseImagesCount,
    mediaFilesCount,
    missingImageUrlCount,
    duplicateCount,
  };
}

async function migrateCases(context: MigrationContext): Promise<CountableWrite> {
  const source = await loadSource(context.definition);
  const cases = Array.isArray(source.data) ? source.data.filter(isRecord) : [];
  const counts = emptyWrites();
  let caseCount = 0;
  let caseImagesCount = 0;
  let mediaFilesCount = 0;
  let seoCount = 0;
  let faqCount = 0;
  let skippedCaseCount = 0;
  let missingImageUrlCount = 0;
  let duplicateCount = 0;

  for (const [index, caseRecord] of cases.entries()) {
    const title = asString(caseRecord.title).trim();
    const slug = asString(caseRecord.slug).trim();

    if (!title || !slug) {
      skippedCaseCount += 1;
      counts.skippedCount += 1;
      addWrite(counts.actualWrites, 'cases', 'skipped');
      counts.warnings.push({
        code: 'case_missing_required_field',
        level: 'warning',
        message: `Skipped case at index ${index}; title and slug are required.`,
      });
      continue;
    }

    const sourceId = getCaseSourceId(caseRecord);
    const ownerSourceId = sourceId ?? slug;
    const status = getCaseStatus(caseRecord);
    const publishedAt = status === 'published'
      ? asDate(caseRecord.publishedAt ?? caseRecord.published_at ?? caseRecord.updatedAt ?? caseRecord.createdAt)
      : null;
    const coverUrl = normalizeMediaPath(firstString(caseRecord, 'coverUrl', 'cover_url'));
    const coverFileName = firstString(caseRecord, 'coverFileName', 'cover_file_name') ?? normalizeFileName(coverUrl, null);
    const coverMedia = coverUrl
      ? await upsertShadowMediaFile(context, counts, {
          moduleName: 'cases',
          sourceKey: `${ownerSourceId}:cover`,
          role: 'case_cover',
          publicUrl: coverUrl,
          filePath: coverUrl,
          fileName: coverFileName,
          originalName: coverFileName,
          displayName: firstString(caseRecord, 'coverDisplayName', 'cover_display_name'),
          category: 'case-cover',
          altText: title,
          description: asNullableString(caseRecord.summary),
          status: 'active',
          metadata: {
            ownerType: 'case',
            ownerSourceId,
            slug,
            sourceRecord: {
              coverUrl,
              coverFileName,
              coverDisplayName: firstString(caseRecord, 'coverDisplayName', 'cover_display_name'),
            },
          },
        })
      : {
          mediaId: null,
          writeKind: 'skipped' as const,
          stableKey: null,
        };

    if (coverMedia.writeKind !== 'skipped') {
      mediaFilesCount += 1;
    } else if (!coverUrl) {
      counts.warnings.push({
        code: 'case_cover_url_missing',
        level: 'info',
        message: `Case "${slug}" has no cover URL; cover media_files write was skipped.`,
      });
    }

    const exists = sourceId
      ? await rowExists(
          context.pool,
          'SELECT COUNT(*) AS count FROM cases WHERE source_id = :sourceId OR slug = :slug',
          { sourceId, slug },
        )
      : await rowExists(context.pool, 'SELECT COUNT(*) AS count FROM cases WHERE slug = :slug', { slug });

    await context.pool.execute(
      `INSERT INTO cases (
        source_id,
        title,
        slug,
        summary,
        client_type,
        event_type,
        event_date,
        location,
        cover_media_id,
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
        is_home_featured,
        published_at
      ) VALUES (
        :sourceId,
        :title,
        :slug,
        :summary,
        :clientType,
        :eventType,
        :eventDate,
        :location,
        :coverMediaId,
        :coverUrl,
        :coverFileName,
        :coverDisplayName,
        :wordFileName,
        :wordOriginalName,
        :contentHtml,
        :contentText,
        :rawJson,
        :status,
        :sortOrder,
        :isHomeFeatured,
        :publishedAt
      )
      ON DUPLICATE KEY UPDATE
        source_id = VALUES(source_id),
        title = VALUES(title),
        summary = VALUES(summary),
        client_type = VALUES(client_type),
        event_type = VALUES(event_type),
        event_date = VALUES(event_date),
        location = VALUES(location),
        cover_media_id = VALUES(cover_media_id),
        cover_url = VALUES(cover_url),
        cover_file_name = VALUES(cover_file_name),
        cover_display_name = VALUES(cover_display_name),
        word_file_name = VALUES(word_file_name),
        word_original_name = VALUES(word_original_name),
        content_html = VALUES(content_html),
        content_text = VALUES(content_text),
        raw_json = VALUES(raw_json),
        status = VALUES(status),
        sort_order = VALUES(sort_order),
        is_home_featured = VALUES(is_home_featured),
        published_at = VALUES(published_at),
        deleted_at = NULL`,
      {
        sourceId,
        title,
        slug,
        summary: asNullableString(caseRecord.summary),
        clientType: asNullableString(caseRecord.clientType ?? caseRecord.client_type),
        eventType: asNullableString(caseRecord.eventType ?? caseRecord.event_type),
        eventDate: asNullableString(caseRecord.eventDate ?? caseRecord.event_date),
        location: asNullableString(caseRecord.location),
        coverMediaId: coverMedia.mediaId,
        coverUrl,
        coverFileName,
        coverDisplayName: firstString(caseRecord, 'coverDisplayName', 'cover_display_name'),
        wordFileName: firstString(caseRecord, 'wordFileName', 'word_file_name'),
        wordOriginalName: firstString(caseRecord, 'wordOriginalName', 'word_original_name'),
        contentHtml: asNullableString(caseRecord.contentHtml ?? caseRecord.content_html),
        contentText: asNullableString(caseRecord.contentText ?? caseRecord.content_text),
        rawJson: JSON.stringify(caseRecord),
        status,
        sortOrder: asNumber(caseRecord.sortOrder ?? caseRecord.sort_order, index + 1),
        isHomeFeatured: asBoolean(caseRecord.isHomeFeatured ?? caseRecord.is_home_featured, false) ? 1 : 0,
        publishedAt,
      },
    );

    counts[exists ? 'updatedCount' : 'insertedCount'] += 1;
    addWrite(counts.actualWrites, 'cases', exists ? 'updated' : 'inserted');
    caseCount += 1;

    const caseId = await findCaseId(context.pool, sourceId, slug);

    if (!caseId) {
      counts.warnings.push({
        code: 'case_id_missing',
        level: 'warning',
        message: `Could not resolve case id for slug "${slug}"; case images, SEO, and FAQ rows were skipped.`,
      });
      continue;
    }

    const imageCounts = await upsertCaseImages({
      context,
      counts,
      caseRecord,
      caseId,
      ownerSourceId,
    });

    caseImagesCount += imageCounts.caseImagesCount;
    mediaFilesCount += imageCounts.mediaFilesCount;
    missingImageUrlCount += imageCounts.missingImageUrlCount;
    duplicateCount += imageCounts.duplicateCount;
    seoCount += await upsertCaseSeo({
      context,
      counts,
      caseRecord,
      caseId,
      ownerSourceId,
      publishedAt,
    });
    faqCount += await upsertCaseFaqItems({
      context,
      counts,
      caseRecord,
      caseId,
      ownerSourceId,
    });
  }

  if (seoCount === 0) {
    counts.warnings.push({
      code: 'cases_seo_empty',
      level: 'info',
      message: 'No case SEO fields were found; seo_settings was skipped for cases.',
    });
  }

  if (faqCount === 0) {
    counts.warnings.push({
      code: 'cases_faq_empty',
      level: 'info',
      message: 'No case FAQ items were found; faq_items was skipped for cases.',
    });
  }

  if (caseImagesCount === 0) {
    counts.warnings.push({
      code: 'case_images_empty',
      level: 'info',
      message: 'No case images were written; source image lists were empty or skipped.',
    });
  }

  counts.details = {
    sourceCount: context.plan.sourceCount,
    caseCount,
    caseImagesCount,
    mediaFilesCount,
    seoCount,
    faqCount,
    skippedCaseCount,
    missingImageUrlCount,
    duplicateCount,
    duplicate: {
      case_images: duplicateCount,
      media_files: 0,
    },
    dedupeStrategy: {
      cases: ['source_id', 'slug'],
      caseImages: ['case_id', 'image_url', 'sort_order'],
      mediaFiles: ['public_url', 'file_path', 'file_name+file_size'],
    },
    inserted: {
      cases: counts.actualWrites.find((write) => write.table === 'cases')?.inserted ?? 0,
      case_images: counts.actualWrites.find((write) => write.table === 'case_images')?.inserted ?? 0,
      media_files: counts.actualWrites.find((write) => write.table === 'media_files')?.inserted ?? 0,
      seo_settings: counts.actualWrites.find((write) => write.table === 'seo_settings')?.inserted ?? 0,
      faq_items: counts.actualWrites.find((write) => write.table === 'faq_items')?.inserted ?? 0,
    },
    updated: {
      cases: counts.actualWrites.find((write) => write.table === 'cases')?.updated ?? 0,
      case_images: counts.actualWrites.find((write) => write.table === 'case_images')?.updated ?? 0,
      media_files: counts.actualWrites.find((write) => write.table === 'media_files')?.updated ?? 0,
      seo_settings: counts.actualWrites.find((write) => write.table === 'seo_settings')?.updated ?? 0,
      faq_items: counts.actualWrites.find((write) => write.table === 'faq_items')?.updated ?? 0,
    },
    skipped: {
      cases: counts.actualWrites.find((write) => write.table === 'cases')?.skipped ?? 0,
      case_images: counts.actualWrites.find((write) => write.table === 'case_images')?.skipped ?? 0,
      media_files: counts.actualWrites.find((write) => write.table === 'media_files')?.skipped ?? 0,
      seo_settings: counts.actualWrites.find((write) => write.table === 'seo_settings')?.skipped ?? 0,
      faq_items: counts.actualWrites.find((write) => write.table === 'faq_items')?.skipped ?? 0,
    },
    faqSkippedReason: faqCount === 0 ? 'source_has_no_faq_items' : null,
    seoSkippedReason: seoCount === 0 ? 'source_has_no_seo_fields' : null,
  };

  return counts;
}

function tableWriteCount(
  counts: CountableWrite,
  table: string,
  kind: 'inserted' | 'updated' | 'skipped',
): number {
  return counts.actualWrites.find((write) => write.table === table)?.[kind] ?? 0;
}

function getKeywords(record: Record<string, unknown>): string | null {
  const rawKeywords = record.keywords ?? record.seoKeywords ?? record.seo_keywords;

  if (Array.isArray(rawKeywords)) {
    const keywords = rawKeywords
      .map((keyword) => asNullableString(keyword))
      .filter((keyword): keyword is string => Boolean(keyword));

    return keywords.length > 0 ? keywords.join(',') : null;
  }

  return asNullableString(rawKeywords);
}

function getEnabledStatus(record: Record<string, unknown>, activeStatus = 'active'): string {
  const status = asNullableString(record.status);

  if (status) {
    return status;
  }

  return asBoolean(record.enabled ?? record.is_enabled, true) ? activeStatus : 'inactive';
}

async function upsertOwnerSeo(input: {
  context: MigrationContext;
  counts: CountableWrite;
  ownerType: 'solution' | 'solution_page';
  sourceRecord: Record<string, unknown>;
  ownerId: number;
  ownerSourceId: string;
  publishedAt: Date | null;
}): Promise<number> {
  const seoTitle = asNullableString(input.sourceRecord.seoTitle ?? input.sourceRecord.seo_title);
  const seoDescription = asNullableString(
    input.sourceRecord.seoDescription ?? input.sourceRecord.seo_description,
  );
  const keywords = getKeywords(input.sourceRecord);

  if (!seoTitle && !seoDescription && !keywords) {
    return 0;
  }

  const existingId = await findId(
    input.context.pool,
    `SELECT id
     FROM seo_settings
     WHERE owner_type = :ownerType
       AND (owner_source_id = :ownerSourceId OR owner_id = :ownerId)
     LIMIT 1`,
    {
      ownerType: input.ownerType,
      ownerSourceId: input.ownerSourceId,
      ownerId: input.ownerId,
    },
  );

  if (existingId) {
    await input.context.pool.execute(
      `UPDATE seo_settings
       SET owner_source_id = :ownerSourceId,
           owner_id = :ownerId,
           title = :title,
           description = :description,
           keywords = :keywords,
           robots = 'index,follow',
           published_at = :publishedAt,
           deleted_at = NULL
       WHERE id = :id`,
      {
        id: existingId,
        ownerSourceId: input.ownerSourceId,
        ownerId: input.ownerId,
        title: seoTitle,
        description: seoDescription,
        keywords,
        publishedAt: input.publishedAt,
      },
    );

    input.counts.updatedCount += 1;
    addWrite(input.counts.actualWrites, 'seo_settings', 'updated');
    return 1;
  }

  await input.context.pool.execute(
    `INSERT INTO seo_settings (
      owner_type,
      owner_source_id,
      owner_id,
      title,
      description,
      keywords,
      robots,
      published_at
    ) VALUES (
      :ownerType,
      :ownerSourceId,
      :ownerId,
      :title,
      :description,
      :keywords,
      'index,follow',
      :publishedAt
    )`,
    {
      ownerType: input.ownerType,
      ownerSourceId: input.ownerSourceId,
      ownerId: input.ownerId,
      title: seoTitle,
      description: seoDescription,
      keywords,
      publishedAt: input.publishedAt,
    },
  );

  input.counts.insertedCount += 1;
  addWrite(input.counts.actualWrites, 'seo_settings', 'inserted');
  return 1;
}

async function upsertOwnerFaqItems(input: {
  context: MigrationContext;
  counts: CountableWrite;
  ownerType: 'solution' | 'solution_page';
  sourceRecord: Record<string, unknown>;
  ownerId: number;
  ownerSourceId: string;
}): Promise<number> {
  const rawFaqItems = input.sourceRecord.faqItems ?? input.sourceRecord.faq_items;
  const faqItems = Array.isArray(rawFaqItems) ? rawFaqItems.filter(isRecord) : [];
  let writtenCount = 0;

  for (const [index, faqItem] of faqItems.entries()) {
    const question = asNullableString(faqItem.question ?? faqItem.q);
    const answer = asNullableString(faqItem.answer ?? faqItem.a);
    const sortOrder = asNumber(faqItem.sortOrder ?? faqItem.sort_order, index + 1);

    if (!question || !answer || question.length > 300) {
      input.counts.skippedCount += 1;
      addWrite(input.counts.actualWrites, 'faq_items', 'skipped');
      input.counts.warnings.push({
        code: `${input.ownerType}_faq_item_skipped`,
        level: 'warning',
        message: `Skipped ${input.ownerType} FAQ item at sort_order ${sortOrder} for ${input.ownerSourceId}.`,
      });
      continue;
    }

    const existingId = await findId(
      input.context.pool,
      `SELECT id
       FROM faq_items
       WHERE owner_type = :ownerType
         AND owner_source_id = :ownerSourceId
         AND sort_order = :sortOrder
         AND question = :question
       LIMIT 1`,
      {
        ownerType: input.ownerType,
        ownerSourceId: input.ownerSourceId,
        sortOrder,
        question,
      },
    );

    if (existingId) {
      await input.context.pool.execute(
        `UPDATE faq_items
         SET owner_id = :ownerId,
             answer = :answer,
             status = :status,
             deleted_at = NULL
         WHERE id = :id`,
        {
          id: existingId,
          ownerId: input.ownerId,
          answer,
          status: asString(faqItem.status, 'active'),
        },
      );

      input.counts.updatedCount += 1;
      addWrite(input.counts.actualWrites, 'faq_items', 'updated');
      writtenCount += 1;
      continue;
    }

    await input.context.pool.execute(
      `INSERT INTO faq_items (
        owner_type,
        owner_source_id,
        owner_id,
        question,
        answer,
        sort_order,
        status
      ) VALUES (
        :ownerType,
        :ownerSourceId,
        :ownerId,
        :question,
        :answer,
        :sortOrder,
        :status
      )`,
      {
        ownerType: input.ownerType,
        ownerSourceId: input.ownerSourceId,
        ownerId: input.ownerId,
        question,
        answer,
        sortOrder,
        status: asString(faqItem.status, 'active'),
      },
    );

    input.counts.insertedCount += 1;
    addWrite(input.counts.actualWrites, 'faq_items', 'inserted');
    writtenCount += 1;
  }

  return writtenCount;
}

function getSolutionTitle(solution: Record<string, unknown>): string {
  return asString(solution.title ?? solution.name).trim();
}

function getSolutionSourceId(solution: Record<string, unknown>): string | null {
  return asNullableString(solution.sourceId ?? solution.source_id ?? solution.id);
}

async function findSolutionId(pool: DbExecutor, sourceId: string | null, slug: string): Promise<number | null> {
  if (sourceId) {
    return findId(pool, 'SELECT id FROM solutions WHERE source_id = :sourceId OR slug = :slug LIMIT 1', {
      sourceId,
      slug,
    });
  }

  return findId(pool, 'SELECT id FROM solutions WHERE slug = :slug LIMIT 1', { slug });
}

function buildSolutionGroupEntries(solution: Record<string, unknown>): Record<string, unknown>[] {
  const rawGroups = solution.groups ?? solution.solutionGroups ?? solution.solution_groups ?? solution.caseGroups;
  return Array.isArray(rawGroups) ? rawGroups.filter(isRecord) : [];
}

function buildSolutionMediaEntries(group: Record<string, unknown>): Record<string, unknown>[] {
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

function getSolutionGroupSourceId(group: Record<string, unknown>): string | null {
  return asNullableString(group.sourceId ?? group.source_id ?? group.id);
}

async function findSolutionGroupId(
  pool: DbExecutor,
  sourceId: string | null,
  solutionId: number,
  slug: string,
): Promise<number | null> {
  if (sourceId) {
    return findId(
      pool,
      'SELECT id FROM solution_groups WHERE source_id = :sourceId OR (solution_id = :solutionId AND slug = :slug) LIMIT 1',
      {
        sourceId,
        solutionId,
        slug,
      },
    );
  }

  return findId(
    pool,
    'SELECT id FROM solution_groups WHERE solution_id = :solutionId AND slug = :slug LIMIT 1',
    {
      solutionId,
      slug,
    },
  );
}

function getSolutionMediaSourceId(item: Record<string, unknown>): string | null {
  return asNullableString(item.sourceId ?? item.source_id ?? item.id);
}

function getSolutionMediaUrl(item: Record<string, unknown>): string | null {
  return normalizeMediaPath(firstString(item, 'mediaUrl', 'media_url', 'url', 'publicUrl', 'public_url', 'src'));
}

function normalizeSolutionFileType(item: Record<string, unknown>, mediaUrl: string): string {
  const fileType = firstString(item, 'fileType', 'file_type', 'type');

  if (fileType) {
    return fileType.toLowerCase().slice(0, 30);
  }

  const fileExt = extFromFileName(mediaUrl);
  return ['mp4', 'mov', 'webm', 'avi'].includes(fileExt ?? '') ? 'video' : 'image';
}

async function upsertSolutionMediaItems(input: {
  context: MigrationContext;
  counts: CountableWrite;
  solution: Record<string, unknown>;
  solutionId: number;
  solutionSlug: string;
  group: Record<string, unknown>;
  groupId: number;
  groupSourceId: string;
  seenKeys: Set<string>;
}): Promise<{
  solutionMediaItemsCount: number;
  mediaFilesCount: number;
  missingMediaUrlCount: number;
  duplicateCount: number;
}> {
  const mediaItems = buildSolutionMediaEntries(input.group);
  let solutionMediaItemsCount = 0;
  let mediaFilesCount = 0;
  let missingMediaUrlCount = 0;
  let duplicateCount = 0;

  for (const [index, item] of mediaItems.entries()) {
    const mediaUrl = getSolutionMediaUrl(item);
    const sortOrder = asNumber(item.sortOrder ?? item.sort_order, index + 1);
    const sourceId = getSolutionMediaSourceId(item);

    if (!mediaUrl) {
      missingMediaUrlCount += 1;
      input.counts.skippedCount += 1;
      addWrite(input.counts.actualWrites, 'solution_media_items', 'skipped');
      input.counts.warnings.push({
        code: 'solution_media_url_missing',
        level: 'warning',
        message: `Skipped solution media item at sort_order ${sortOrder} for group ${input.groupSourceId}; media_url is empty.`,
      });
      continue;
    }

    const dedupeKey = sourceId
      ? `source:${sourceId}`
      : `group:${input.groupId}:${mediaUrl}:${sortOrder}`;

    if (input.seenKeys.has(dedupeKey)) {
      duplicateCount += 1;
      input.counts.skippedCount += 1;
      addWrite(input.counts.actualWrites, 'solution_media_items', 'skipped');
      continue;
    }

    input.seenKeys.add(dedupeKey);

    const fileType = normalizeSolutionFileType(item, mediaUrl);
    const fileName = firstString(item, 'mediaFileName', 'media_file_name', 'fileName', 'file_name')
      ?? normalizeFileName(mediaUrl, null);
    const mediaDisplayName = firstString(item, 'mediaDisplayName', 'media_display_name', 'displayName', 'title');
    const mediaWrite = await upsertShadowMediaFile(input.context, input.counts, {
      moduleName: 'solutions',
      sourceKey: sourceId ?? `${input.groupSourceId}:media:${sortOrder}`,
      role: 'solution_media_item',
      publicUrl: mediaUrl,
      filePath: firstString(item, 'filePath', 'file_path', 'path') ?? mediaUrl,
      fileName,
      originalName: firstString(item, 'originalName', 'original_name') ?? fileName,
      displayName: mediaDisplayName,
      fileSize: asOptionalUnsignedInteger(item.fileSize ?? item.file_size ?? item.size),
      width: asOptionalUnsignedInteger(item.width),
      height: asOptionalUnsignedInteger(item.height),
      durationSeconds: asOptionalNumber(item.durationSeconds ?? item.duration_seconds ?? item.duration),
      category: fileType === 'video' ? 'solution-video' : 'solution-image',
      altText: firstString(item, 'altText', 'alt_text', 'alt', 'mediaDisplayName', 'media_display_name', 'title'),
      description: firstString(item, 'description', 'caption'),
      status: getEnabledStatus(item),
      metadata: {
        ownerType: 'solution',
        solutionId: input.solutionId,
        solutionSlug: input.solutionSlug,
        groupId: input.groupId,
        groupSourceId: input.groupSourceId,
        sortOrder,
        fileType,
        sourceRecord: item,
      },
    });

    if (mediaWrite.writeKind !== 'skipped') {
      mediaFilesCount += 1;
    }

    const existingId = sourceId
      ? await findId(
          input.context.pool,
          'SELECT id FROM solution_media_items WHERE source_id = :sourceId LIMIT 1',
          { sourceId },
        )
      : await findId(
          input.context.pool,
          `SELECT id
           FROM solution_media_items
           WHERE group_id = :groupId
             AND media_url = :mediaUrl
             AND sort_order = :sortOrder
           LIMIT 1`,
          {
            groupId: input.groupId,
            mediaUrl,
            sortOrder,
          },
        );

    if (existingId) {
      await input.context.pool.execute(
        `UPDATE solution_media_items
         SET group_id = :groupId,
             media_id = :mediaId,
             file_type = :fileType,
             media_url = :mediaUrl,
             media_file_name = :mediaFileName,
             media_display_name = :mediaDisplayName,
             alt_text = :altText,
             caption = :caption,
             sort_order = :sortOrder,
             is_enabled = :isEnabled,
             deleted_at = NULL
         WHERE id = :id`,
        {
          id: existingId,
          groupId: input.groupId,
          mediaId: mediaWrite.mediaId,
          fileType,
          mediaUrl,
          mediaFileName: fileName,
          mediaDisplayName,
          altText: firstString(item, 'altText', 'alt_text', 'alt'),
          caption: firstString(item, 'caption'),
          sortOrder,
          isEnabled: asBoolean(item.enabled ?? item.is_enabled, true) ? 1 : 0,
        },
      );

      input.counts.updatedCount += 1;
      addWrite(input.counts.actualWrites, 'solution_media_items', 'updated');
      solutionMediaItemsCount += 1;
      continue;
    }

    await input.context.pool.execute(
      `INSERT INTO solution_media_items (
        group_id,
        source_id,
        media_id,
        file_type,
        media_url,
        media_file_name,
        media_display_name,
        alt_text,
        caption,
        sort_order,
        is_enabled
      ) VALUES (
        :groupId,
        :sourceId,
        :mediaId,
        :fileType,
        :mediaUrl,
        :mediaFileName,
        :mediaDisplayName,
        :altText,
        :caption,
        :sortOrder,
        :isEnabled
      )
      ON DUPLICATE KEY UPDATE
        group_id = VALUES(group_id),
        media_id = VALUES(media_id),
        file_type = VALUES(file_type),
        media_url = VALUES(media_url),
        media_file_name = VALUES(media_file_name),
        media_display_name = VALUES(media_display_name),
        alt_text = VALUES(alt_text),
        caption = VALUES(caption),
        sort_order = VALUES(sort_order),
        is_enabled = VALUES(is_enabled),
        deleted_at = NULL`,
      {
        groupId: input.groupId,
        sourceId,
        mediaId: mediaWrite.mediaId,
        fileType,
        mediaUrl,
        mediaFileName: fileName,
        mediaDisplayName,
        altText: firstString(item, 'altText', 'alt_text', 'alt'),
        caption: firstString(item, 'caption'),
        sortOrder,
        isEnabled: asBoolean(item.enabled ?? item.is_enabled, true) ? 1 : 0,
      },
    );

    input.counts.insertedCount += 1;
    addWrite(input.counts.actualWrites, 'solution_media_items', 'inserted');
    solutionMediaItemsCount += 1;
  }

  return {
    solutionMediaItemsCount,
    mediaFilesCount,
    missingMediaUrlCount,
    duplicateCount,
  };
}

async function upsertSolutionGroups(input: {
  context: MigrationContext;
  counts: CountableWrite;
  solution: Record<string, unknown>;
  solutionId: number;
  solutionSlug: string;
}): Promise<{
  solutionGroupsCount: number;
  solutionMediaItemsCount: number;
  mediaFilesCount: number;
  missingMediaUrlCount: number;
  duplicateCount: number;
}> {
  const groups = buildSolutionGroupEntries(input.solution);
  const seenMediaKeys = new Set<string>();
  let solutionGroupsCount = 0;
  let solutionMediaItemsCount = 0;
  let mediaFilesCount = 0;
  let missingMediaUrlCount = 0;
  let duplicateCount = 0;

  for (const [index, group] of groups.entries()) {
    const title = asString(group.title ?? group.name).trim();
    const slug = asString(group.slug).trim();

    if (!title || !slug) {
      input.counts.skippedCount += 1;
      addWrite(input.counts.actualWrites, 'solution_groups', 'skipped');
      input.counts.warnings.push({
        code: 'solution_group_missing_required_field',
        level: 'warning',
        message: `Skipped solution group at index ${index} for ${input.solutionSlug}; title and slug are required.`,
      });
      continue;
    }

    const sourceId = getSolutionGroupSourceId(group);
    const sceneSlug = firstString(group, 'sceneSlug', 'scene_slug') ?? input.solutionSlug;
    const exists = sourceId
      ? await rowExists(
          input.context.pool,
          `SELECT COUNT(*) AS count
           FROM solution_groups
           WHERE source_id = :sourceId
              OR (solution_id = :solutionId AND slug = :slug)`,
          {
            sourceId,
            solutionId: input.solutionId,
            slug,
          },
        )
      : await rowExists(
          input.context.pool,
          'SELECT COUNT(*) AS count FROM solution_groups WHERE solution_id = :solutionId AND slug = :slug',
          {
            solutionId: input.solutionId,
            slug,
          },
        );

    await input.context.pool.execute(
      `INSERT INTO solution_groups (
        solution_id,
        source_id,
        title,
        slug,
        summary,
        scene_slug,
        sort_order,
        is_enabled
      ) VALUES (
        :solutionId,
        :sourceId,
        :title,
        :slug,
        :summary,
        :sceneSlug,
        :sortOrder,
        :isEnabled
      )
      ON DUPLICATE KEY UPDATE
        solution_id = VALUES(solution_id),
        title = VALUES(title),
        summary = VALUES(summary),
        scene_slug = VALUES(scene_slug),
        sort_order = VALUES(sort_order),
        is_enabled = VALUES(is_enabled),
        deleted_at = NULL`,
      {
        solutionId: input.solutionId,
        sourceId,
        title,
        slug,
        summary: asNullableString(group.summary ?? group.description),
        sceneSlug,
        sortOrder: asNumber(group.sortOrder ?? group.sort_order, index + 1),
        isEnabled: asBoolean(group.enabled ?? group.is_enabled, true) ? 1 : 0,
      },
    );

    input.counts[exists ? 'updatedCount' : 'insertedCount'] += 1;
    addWrite(input.counts.actualWrites, 'solution_groups', exists ? 'updated' : 'inserted');
    solutionGroupsCount += 1;

    const groupId = await findSolutionGroupId(input.context.pool, sourceId, input.solutionId, slug);

    if (!groupId) {
      input.counts.warnings.push({
        code: 'solution_group_id_missing',
        level: 'warning',
        message: `Could not resolve solution group id for "${input.solutionSlug}/${slug}"; media items were skipped.`,
      });
      continue;
    }

    const mediaCounts = await upsertSolutionMediaItems({
      context: input.context,
      counts: input.counts,
      solution: input.solution,
      solutionId: input.solutionId,
      solutionSlug: input.solutionSlug,
      group,
      groupId,
      groupSourceId: sourceId ?? `${input.solutionSlug}/${slug}`,
      seenKeys: seenMediaKeys,
    });

    solutionMediaItemsCount += mediaCounts.solutionMediaItemsCount;
    mediaFilesCount += mediaCounts.mediaFilesCount;
    missingMediaUrlCount += mediaCounts.missingMediaUrlCount;
    duplicateCount += mediaCounts.duplicateCount;
  }

  return {
    solutionGroupsCount,
    solutionMediaItemsCount,
    mediaFilesCount,
    missingMediaUrlCount,
    duplicateCount,
  };
}

async function migrateSolutions(context: MigrationContext): Promise<CountableWrite> {
  const source = await loadSource(context.definition);
  const solutions = Array.isArray(source.data) ? source.data.filter(isRecord) : [];
  const counts = emptyWrites();
  let solutionsCount = 0;
  let solutionGroupsCount = 0;
  let solutionMediaItemsCount = 0;
  let mediaFilesCount = 0;
  let seoCount = 0;
  let faqCount = 0;
  let skippedSolutionCount = 0;
  let missingMediaUrlCount = 0;
  let duplicateCount = 0;

  for (const [index, solution] of solutions.entries()) {
    const title = getSolutionTitle(solution);
    const slug = asString(solution.slug).trim();

    if (!title || !slug) {
      skippedSolutionCount += 1;
      counts.skippedCount += 1;
      addWrite(counts.actualWrites, 'solutions', 'skipped');
      counts.warnings.push({
        code: 'solution_missing_required_field',
        level: 'warning',
        message: `Skipped solution at index ${index}; title/name and slug are required.`,
      });
      continue;
    }

    const sourceId = getSolutionSourceId(solution);
    const ownerSourceId = sourceId ?? slug;
    const status = getEnabledStatus(solution);
    const publishedAt = status === 'published'
      ? asDate(solution.publishedAt ?? solution.published_at ?? solution.updatedAt ?? solution.createdAt)
      : null;
    const coverUrl = normalizeMediaPath(firstString(solution, 'coverUrl', 'cover_url'));
    const coverFileName = firstString(solution, 'coverFileName', 'cover_file_name') ?? normalizeFileName(coverUrl, null);
    const coverMedia = coverUrl
      ? await upsertShadowMediaFile(context, counts, {
          moduleName: 'solutions',
          sourceKey: `${ownerSourceId}:cover`,
          role: 'solution_cover',
          publicUrl: coverUrl,
          filePath: coverUrl,
          fileName: coverFileName,
          originalName: coverFileName,
          displayName: firstString(solution, 'coverDisplayName', 'cover_display_name'),
          category: 'solution-cover',
          altText: title,
          description: asNullableString(solution.summary ?? solution.description),
          status: 'active',
          metadata: {
            ownerType: 'solution',
            ownerSourceId,
            slug,
            sourceRecord: {
              coverUrl,
              coverFileName,
              coverDisplayName: firstString(solution, 'coverDisplayName', 'cover_display_name'),
            },
          },
        })
      : {
          mediaId: null,
          writeKind: 'skipped' as const,
          stableKey: null,
        };

    if (coverMedia.writeKind !== 'skipped') {
      mediaFilesCount += 1;
    }

    const exists = sourceId
      ? await rowExists(
          context.pool,
          'SELECT COUNT(*) AS count FROM solutions WHERE source_id = :sourceId OR slug = :slug',
          { sourceId, slug },
        )
      : await rowExists(context.pool, 'SELECT COUNT(*) AS count FROM solutions WHERE slug = :slug', { slug });

    await context.pool.execute(
      `INSERT INTO solutions (
        source_id,
        title,
        slug,
        summary,
        cover_media_id,
        cover_url,
        raw_json,
        status,
        sort_order,
        published_at
      ) VALUES (
        :sourceId,
        :title,
        :slug,
        :summary,
        :coverMediaId,
        :coverUrl,
        :rawJson,
        :status,
        :sortOrder,
        :publishedAt
      )
      ON DUPLICATE KEY UPDATE
        source_id = VALUES(source_id),
        title = VALUES(title),
        summary = VALUES(summary),
        cover_media_id = VALUES(cover_media_id),
        cover_url = VALUES(cover_url),
        raw_json = VALUES(raw_json),
        status = VALUES(status),
        sort_order = VALUES(sort_order),
        published_at = VALUES(published_at),
        deleted_at = NULL`,
      {
        sourceId,
        title,
        slug,
        summary: asNullableString(solution.summary ?? solution.description),
        coverMediaId: coverMedia.mediaId,
        coverUrl,
        rawJson: JSON.stringify(solution),
        status,
        sortOrder: asNumber(solution.sortOrder ?? solution.sort_order, index + 1),
        publishedAt,
      },
    );

    counts[exists ? 'updatedCount' : 'insertedCount'] += 1;
    addWrite(counts.actualWrites, 'solutions', exists ? 'updated' : 'inserted');
    solutionsCount += 1;

    const solutionId = await findSolutionId(context.pool, sourceId, slug);

    if (!solutionId) {
      counts.warnings.push({
        code: 'solution_id_missing',
        level: 'warning',
        message: `Could not resolve solution id for slug "${slug}"; groups, media, SEO, and FAQ rows were skipped.`,
      });
      continue;
    }

    const groupCounts = await upsertSolutionGroups({
      context,
      counts,
      solution,
      solutionId,
      solutionSlug: slug,
    });

    solutionGroupsCount += groupCounts.solutionGroupsCount;
    solutionMediaItemsCount += groupCounts.solutionMediaItemsCount;
    mediaFilesCount += groupCounts.mediaFilesCount;
    missingMediaUrlCount += groupCounts.missingMediaUrlCount;
    duplicateCount += groupCounts.duplicateCount;
    seoCount += await upsertOwnerSeo({
      context,
      counts,
      ownerType: 'solution',
      sourceRecord: solution,
      ownerId: solutionId,
      ownerSourceId,
      publishedAt,
    });
    faqCount += await upsertOwnerFaqItems({
      context,
      counts,
      ownerType: 'solution',
      sourceRecord: solution,
      ownerId: solutionId,
      ownerSourceId,
    });
  }

  if (seoCount === 0) {
    counts.warnings.push({
      code: 'solutions_seo_empty',
      level: 'info',
      message: 'No solution SEO fields were found; seo_settings was skipped for solutions.',
    });
  }

  if (faqCount === 0) {
    counts.warnings.push({
      code: 'solutions_faq_empty',
      level: 'info',
      message: 'No solution FAQ items were found; faq_items was skipped for solutions.',
    });
  }

  counts.details = {
    sourceCount: context.plan.sourceCount,
    solutionCount: solutionsCount,
    solutionsCount,
    solutionGroupCount: solutionGroupsCount,
    solutionGroupsCount,
    solutionMediaItemCount: solutionMediaItemsCount,
    solutionMediaItemsCount,
    mediaFilesCount,
    seoCount,
    faqCount,
    skippedSolutionCount,
    missingMediaUrlCount,
    duplicateCount,
    duplicate: {
      solution_media_items: duplicateCount,
      media_files: 0,
    },
    dedupeStrategy: {
      solutions: ['source_id', 'slug'],
      solutionGroups: ['source_id', 'solution_id+slug'],
      solutionMediaItems: ['source_id', 'group_id+media_url+sort_order'],
      mediaFiles: ['public_url', 'file_path', 'file_name+file_size'],
    },
    inserted: {
      solutions: tableWriteCount(counts, 'solutions', 'inserted'),
      solution_groups: tableWriteCount(counts, 'solution_groups', 'inserted'),
      solution_media_items: tableWriteCount(counts, 'solution_media_items', 'inserted'),
      media_files: tableWriteCount(counts, 'media_files', 'inserted'),
      seo_settings: tableWriteCount(counts, 'seo_settings', 'inserted'),
      faq_items: tableWriteCount(counts, 'faq_items', 'inserted'),
    },
    updated: {
      solutions: tableWriteCount(counts, 'solutions', 'updated'),
      solution_groups: tableWriteCount(counts, 'solution_groups', 'updated'),
      solution_media_items: tableWriteCount(counts, 'solution_media_items', 'updated'),
      media_files: tableWriteCount(counts, 'media_files', 'updated'),
      seo_settings: tableWriteCount(counts, 'seo_settings', 'updated'),
      faq_items: tableWriteCount(counts, 'faq_items', 'updated'),
    },
    skipped: {
      solutions: tableWriteCount(counts, 'solutions', 'skipped'),
      solution_groups: tableWriteCount(counts, 'solution_groups', 'skipped'),
      solution_media_items: tableWriteCount(counts, 'solution_media_items', 'skipped'),
      media_files: tableWriteCount(counts, 'media_files', 'skipped'),
      seo_settings: tableWriteCount(counts, 'seo_settings', 'skipped'),
      faq_items: tableWriteCount(counts, 'faq_items', 'skipped'),
    },
    faqSkippedReason: faqCount === 0 ? 'source_has_no_faq_items' : null,
    seoSkippedReason: seoCount === 0 ? 'source_has_no_seo_fields' : null,
  };

  return counts;
}

function buildScenarioPageEntries(data: unknown): Record<string, unknown>[] {
  return Array.isArray(data) ? data.filter(isRecord) : [];
}

function getScenarioPageSourceId(page: Record<string, unknown>): string | null {
  return asNullableString(page.sourceId ?? page.source_id ?? page.id);
}

function lastRouteSegment(routePath: string | null): string | null {
  if (!routePath) {
    return null;
  }

  return routePath.split('/').filter(Boolean).at(-1) ?? null;
}

async function resolveScenarioPageSolutionId(
  pool: DbExecutor,
  page: Record<string, unknown>,
): Promise<number | null> {
  const solutionSlug = firstString(page, 'solutionSlug', 'solution_slug', 'sceneSlug', 'scene_slug');
  const solutionSourceId = firstString(page, 'solutionSourceId', 'solution_source_id');

  if (solutionSourceId) {
    const bySourceId = await findId(pool, 'SELECT id FROM solutions WHERE source_id = :sourceId LIMIT 1', {
      sourceId: solutionSourceId,
    });

    if (bySourceId) {
      return bySourceId;
    }
  }

  if (solutionSlug) {
    return findId(pool, 'SELECT id FROM solutions WHERE slug = :slug LIMIT 1', { slug: solutionSlug });
  }

  return null;
}

async function findSolutionPageId(input: {
  pool: DbExecutor;
  sourceId: string | null;
  routePath: string | null;
  solutionId: number | null;
  slug: string;
}): Promise<number | null> {
  if (input.sourceId) {
    const bySourceId = await findId(input.pool, 'SELECT id FROM solution_pages WHERE source_id = :sourceId LIMIT 1', {
      sourceId: input.sourceId,
    });

    if (bySourceId) {
      return bySourceId;
    }
  }

  if (input.routePath) {
    const byRoutePath = await findId(input.pool, 'SELECT id FROM solution_pages WHERE route_path = :routePath LIMIT 1', {
      routePath: input.routePath,
    });

    if (byRoutePath) {
      return byRoutePath;
    }
  }

  if (input.solutionId) {
    return findId(
      input.pool,
      'SELECT id FROM solution_pages WHERE solution_id = :solutionId AND slug = :slug LIMIT 1',
      {
        solutionId: input.solutionId,
        slug: input.slug,
      },
    );
  }

  return null;
}

function buildScenarioPageBlocks(page: Record<string, unknown>): Record<string, unknown>[] {
  const rawBlocks = page.blocks
    ?? page.pageBlocks
    ?? page.page_blocks
    ?? page.solutionPageBlocks
    ?? page.solution_page_blocks
    ?? page.contentBlocks
    ?? page.content_blocks
    ?? page.sections;

  return Array.isArray(rawBlocks) ? rawBlocks.filter(isRecord) : [];
}

async function upsertScenarioPageBlocks(input: {
  context: MigrationContext;
  counts: CountableWrite;
  page: Record<string, unknown>;
  solutionPageId: number;
  ownerSourceId: string;
}): Promise<number> {
  const blocks = buildScenarioPageBlocks(input.page);
  let blockCount = 0;

  for (const [index, block] of blocks.entries()) {
    const blockType = firstString(block, 'blockType', 'block_type', 'type') ?? 'content';
    const sortOrder = asNumber(block.sortOrder ?? block.sort_order, index + 1);
    const existingId = await findId(
      input.context.pool,
      `SELECT id
       FROM solution_page_blocks
       WHERE solution_page_id = :solutionPageId
         AND block_type = :blockType
         AND sort_order = :sortOrder
       LIMIT 1`,
      {
        solutionPageId: input.solutionPageId,
        blockType,
        sortOrder,
      },
    );

    if (existingId) {
      await input.context.pool.execute(
        `UPDATE solution_page_blocks
         SET block_data_json = :blockDataJson,
             is_enabled = :isEnabled,
             deleted_at = NULL
         WHERE id = :id`,
        {
          id: existingId,
          blockDataJson: JSON.stringify(block),
          isEnabled: asBoolean(block.enabled ?? block.is_enabled, true) ? 1 : 0,
        },
      );

      input.counts.updatedCount += 1;
      addWrite(input.counts.actualWrites, 'solution_page_blocks', 'updated');
      blockCount += 1;
      continue;
    }

    await input.context.pool.execute(
      `INSERT INTO solution_page_blocks (
        solution_page_id,
        block_type,
        block_data_json,
        sort_order,
        is_enabled
      ) VALUES (
        :solutionPageId,
        :blockType,
        :blockDataJson,
        :sortOrder,
        :isEnabled
      )`,
      {
        solutionPageId: input.solutionPageId,
        blockType,
        blockDataJson: JSON.stringify(block),
        sortOrder,
        isEnabled: asBoolean(block.enabled ?? block.is_enabled, true) ? 1 : 0,
      },
    );

    input.counts.insertedCount += 1;
    addWrite(input.counts.actualWrites, 'solution_page_blocks', 'inserted');
    blockCount += 1;
  }

  if (blocks.length === 0) {
    input.counts.warnings.push({
      code: 'scenario_page_blocks_empty',
      level: 'info',
      message: `Scenario detail page ${input.ownerSourceId} has no explicit blocks; solution_page_blocks was skipped.`,
    });
  }

  return blockCount;
}

async function migrateScenarioDetailPages(context: MigrationContext): Promise<CountableWrite> {
  const source = await loadSource(context.definition);
  const pages = buildScenarioPageEntries(source.data);
  const counts = emptyWrites();
  let solutionPagesCount = 0;
  let solutionPageBlocksCount = 0;
  let mediaFilesCount = 0;
  let seoCount = 0;
  let faqCount = 0;
  let skippedPageCount = 0;

  if (pages.length === 0) {
    counts.warnings.push({
      code: 'scenario_detail_pages_empty_source',
      level: 'info',
      message: 'scenario-detail-pages source is empty; solution_pages and solution_page_blocks were not written.',
    });
    counts.details = {
      sourceCount: context.plan.sourceCount,
      emptySource: true,
      emptySourceWarning: 'scenario-detail-pages source is empty',
      solutionPageCount: solutionPagesCount,
      solutionPagesCount,
      solutionPageBlockCount: solutionPageBlocksCount,
      solutionPageBlocksCount,
      mediaFilesCount,
      seoCount,
      faqCount,
      skippedPageCount,
    };
    return counts;
  }

  for (const [index, page] of pages.entries()) {
    const title = asString(page.title ?? page.name).trim();
    const routePath = normalizeMediaPath(firstString(page, 'routePath', 'route_path', 'path'));
    const slug = asString(page.slug ?? lastRouteSegment(routePath) ?? getScenarioPageSourceId(page)).trim();

    if (!title || !slug) {
      skippedPageCount += 1;
      counts.skippedCount += 1;
      addWrite(counts.actualWrites, 'solution_pages', 'skipped');
      counts.warnings.push({
        code: 'scenario_page_missing_required_field',
        level: 'warning',
        message: `Skipped scenario detail page at index ${index}; title and slug are required.`,
      });
      continue;
    }

    const sourceId = getScenarioPageSourceId(page);
    const ownerSourceId = sourceId ?? routePath ?? slug;
    const solutionId = await resolveScenarioPageSolutionId(context.pool, page);
    const status = getEnabledStatus(page, 'published');
    const publishedAt = status === 'published'
      ? asDate(page.publishedAt ?? page.published_at ?? page.updatedAt ?? page.createdAt)
      : null;
    const coverUrl = normalizeMediaPath(firstString(page, 'coverUrl', 'cover_url'));
    const coverFileName = firstString(page, 'coverFileName', 'cover_file_name') ?? normalizeFileName(coverUrl, null);
    const coverMedia = coverUrl
      ? await upsertShadowMediaFile(context, counts, {
          moduleName: 'scenario-detail-pages',
          sourceKey: `${ownerSourceId}:cover`,
          role: 'solution_page_cover',
          publicUrl: coverUrl,
          filePath: coverUrl,
          fileName: coverFileName,
          originalName: coverFileName,
          displayName: firstString(page, 'coverDisplayName', 'cover_display_name'),
          category: 'solution-page-cover',
          altText: title,
          description: asNullableString(page.summary ?? page.description),
          status: 'active',
          metadata: {
            ownerType: 'solution_page',
            ownerSourceId,
            routePath,
            slug,
          },
        })
      : {
          mediaId: null,
          writeKind: 'skipped' as const,
          stableKey: null,
        };

    if (coverMedia.writeKind !== 'skipped') {
      mediaFilesCount += 1;
    }

    const existingId = await findSolutionPageId({
      pool: context.pool,
      sourceId,
      routePath,
      solutionId,
      slug,
    });

    await context.pool.execute(
      `INSERT INTO solution_pages (
        solution_id,
        source_id,
        title,
        slug,
        route_path,
        summary,
        cover_media_id,
        cover_url,
        status,
        sort_order,
        published_at
      ) VALUES (
        :solutionId,
        :sourceId,
        :title,
        :slug,
        :routePath,
        :summary,
        :coverMediaId,
        :coverUrl,
        :status,
        :sortOrder,
        :publishedAt
      )
      ON DUPLICATE KEY UPDATE
        solution_id = VALUES(solution_id),
        title = VALUES(title),
        route_path = VALUES(route_path),
        summary = VALUES(summary),
        cover_media_id = VALUES(cover_media_id),
        cover_url = VALUES(cover_url),
        status = VALUES(status),
        sort_order = VALUES(sort_order),
        published_at = VALUES(published_at),
        deleted_at = NULL`,
      {
        solutionId,
        sourceId,
        title,
        slug,
        routePath,
        summary: asNullableString(page.summary ?? page.description),
        coverMediaId: coverMedia.mediaId,
        coverUrl,
        status,
        sortOrder: asNumber(page.sortOrder ?? page.sort_order, index + 1),
        publishedAt,
      },
    );

    counts[existingId ? 'updatedCount' : 'insertedCount'] += 1;
    addWrite(counts.actualWrites, 'solution_pages', existingId ? 'updated' : 'inserted');
    solutionPagesCount += 1;

    const solutionPageId = await findSolutionPageId({
      pool: context.pool,
      sourceId,
      routePath,
      solutionId,
      slug,
    });

    if (!solutionPageId) {
      counts.warnings.push({
        code: 'scenario_page_id_missing',
        level: 'warning',
        message: `Could not resolve solution page id for "${ownerSourceId}"; blocks, SEO, and FAQ rows were skipped.`,
      });
      continue;
    }

    solutionPageBlocksCount += await upsertScenarioPageBlocks({
      context,
      counts,
      page,
      solutionPageId,
      ownerSourceId,
    });
    seoCount += await upsertOwnerSeo({
      context,
      counts,
      ownerType: 'solution_page',
      sourceRecord: page,
      ownerId: solutionPageId,
      ownerSourceId,
      publishedAt,
    });
    faqCount += await upsertOwnerFaqItems({
      context,
      counts,
      ownerType: 'solution_page',
      sourceRecord: page,
      ownerId: solutionPageId,
      ownerSourceId,
    });
  }

  if (seoCount === 0) {
    counts.warnings.push({
      code: 'scenario_detail_pages_seo_empty',
      level: 'info',
      message: 'No scenario detail page SEO fields were found; seo_settings was skipped for solution pages.',
    });
  }

  if (faqCount === 0) {
    counts.warnings.push({
      code: 'scenario_detail_pages_faq_empty',
      level: 'info',
      message: 'No scenario detail page FAQ items were found; faq_items was skipped for solution pages.',
    });
  }

  counts.details = {
    sourceCount: context.plan.sourceCount,
    emptySource: false,
    solutionPageCount: solutionPagesCount,
    solutionPagesCount,
    solutionPageBlockCount: solutionPageBlocksCount,
    solutionPageBlocksCount,
    mediaFilesCount,
    seoCount,
    faqCount,
    skippedPageCount,
    dedupeStrategy: {
      solutionPages: ['source_id', 'route_path', 'solution_id+slug'],
      solutionPageBlocks: ['solution_page_id', 'block_type', 'sort_order'],
    },
    inserted: {
      solution_pages: tableWriteCount(counts, 'solution_pages', 'inserted'),
      solution_page_blocks: tableWriteCount(counts, 'solution_page_blocks', 'inserted'),
      media_files: tableWriteCount(counts, 'media_files', 'inserted'),
      seo_settings: tableWriteCount(counts, 'seo_settings', 'inserted'),
      faq_items: tableWriteCount(counts, 'faq_items', 'inserted'),
    },
    updated: {
      solution_pages: tableWriteCount(counts, 'solution_pages', 'updated'),
      solution_page_blocks: tableWriteCount(counts, 'solution_page_blocks', 'updated'),
      media_files: tableWriteCount(counts, 'media_files', 'updated'),
      seo_settings: tableWriteCount(counts, 'seo_settings', 'updated'),
      faq_items: tableWriteCount(counts, 'faq_items', 'updated'),
    },
    skipped: {
      solution_pages: tableWriteCount(counts, 'solution_pages', 'skipped'),
      solution_page_blocks: tableWriteCount(counts, 'solution_page_blocks', 'skipped'),
      media_files: tableWriteCount(counts, 'media_files', 'skipped'),
      seo_settings: tableWriteCount(counts, 'seo_settings', 'skipped'),
      faq_items: tableWriteCount(counts, 'faq_items', 'skipped'),
    },
    faqSkippedReason: faqCount === 0 ? 'source_has_no_faq_items' : null,
    seoSkippedReason: seoCount === 0 ? 'source_has_no_seo_fields' : null,
  };

  return counts;
}

async function migratePages(context: MigrationContext): Promise<CountableWrite> {
  const source = await loadSource(context.definition);
  const pages = Array.isArray(source.data) ? source.data.filter(isRecord) : [];
  const counts = emptyWrites();

  for (const page of pages) {
    const title = asString(page.title).trim();
    const slug = asString(page.slug).trim();

    if (!title || !slug) {
      counts.skippedCount += 1;
      addWrite(counts.actualWrites, 'pages', 'skipped');
      continue;
    }

    const sourceId = asNullableString(page.sourceId ?? page.source_id ?? page.id);
    const exists = sourceId
      ? await rowExists(
          context.pool,
          'SELECT COUNT(*) AS count FROM pages WHERE source_id = :sourceId OR slug = :slug',
          { sourceId, slug },
        )
      : await rowExists(context.pool, 'SELECT COUNT(*) AS count FROM pages WHERE slug = :slug', { slug });

    await context.pool.execute(
      `INSERT INTO pages (
        source_id,
        title,
        slug,
        summary,
        status,
        sort_order,
        is_system_page
      ) VALUES (
        :sourceId,
        :title,
        :slug,
        :summary,
        :status,
        :sortOrder,
        :isSystemPage
      )
      ON DUPLICATE KEY UPDATE
        source_id = VALUES(source_id),
        title = VALUES(title),
        summary = VALUES(summary),
        status = VALUES(status),
        sort_order = VALUES(sort_order),
        is_system_page = VALUES(is_system_page),
        deleted_at = NULL`,
      {
        sourceId,
        title,
        slug,
        summary: asNullableString(page.summary),
        status: asString(page.status, 'draft'),
        sortOrder: asNumber(page.sortOrder ?? page.sort_order, 0),
        isSystemPage: asBoolean(page.isSystemPage ?? page.is_system_page, false) ? 1 : 0,
      },
    );

    counts[exists ? 'updatedCount' : 'insertedCount'] += 1;
    addWrite(counts.actualWrites, 'pages', exists ? 'updated' : 'inserted');
  }

  return counts;
}

async function migrateContactInfo(context: MigrationContext): Promise<CountableWrite> {
  const source = await loadSource(context.definition);
  const counts = emptyWrites();
  const exists = await rowExists(
    context.pool,
    'SELECT COUNT(*) AS count FROM contact_info WHERE singleton_key = :singletonKey',
    { singletonKey: 'contact_info' },
  );
  const isEnabled = isRecord(source.data) ? asBoolean(source.data.enabled ?? source.data.is_enabled, true) : true;

  await context.pool.execute(
    `INSERT INTO contact_info (
      singleton_key,
      content_json,
      is_enabled
    ) VALUES (
      'contact_info',
      :contentJson,
      :isEnabled
    )
    ON DUPLICATE KEY UPDATE
      content_json = VALUES(content_json),
      is_enabled = VALUES(is_enabled),
      deleted_at = NULL`,
    {
      contentJson: JSON.stringify(source.data ?? {}),
      isEnabled: isEnabled ? 1 : 0,
    },
  );

  counts[exists ? 'updatedCount' : 'insertedCount'] = 1;
  addWrite(counts.actualWrites, 'contact_info', exists ? 'updated' : 'inserted');

  return counts;
}

async function migrateCompanyAssets(context: MigrationContext): Promise<CountableWrite> {
  const source = await loadSource(context.definition);
  const assets = Array.isArray(source.data) ? source.data.filter(isRecord) : [];
  const counts = emptyWrites();

  for (const asset of assets) {
    const assetKey = asString(asset.assetKey ?? asset.asset_key ?? asset.id).trim();

    if (!assetKey) {
      counts.skippedCount += 1;
      addWrite(counts.actualWrites, 'company_assets', 'skipped');
      continue;
    }

    const mediaUrl = asNullableString(asset.mediaUrl ?? asset.media_url ?? asset.imageUrl ?? asset.image_url);
    const mediaId = await upsertMediaFile({
      pool: context.pool,
      writes: counts.actualWrites,
      publicUrl: mediaUrl,
      fileName: asNullableString(asset.mediaFileName ?? asset.fileName),
      altText: asNullableString(asset.altText ?? asset.imageAlt),
      description: asNullableString(asset.description ?? asset.summary),
      category: 'company-assets',
      metadata: { moduleName: context.plan.moduleName, assetKey },
    });
    const exists = await rowExists(
      context.pool,
      'SELECT COUNT(*) AS count FROM company_assets WHERE asset_key = :assetKey',
      { assetKey },
    );

    await context.pool.execute(
      `INSERT INTO company_assets (
        asset_key,
        media_id,
        media_url,
        alt_text,
        description,
        sort_order,
        is_enabled,
        raw_json
      ) VALUES (
        :assetKey,
        :mediaId,
        :mediaUrl,
        :altText,
        :description,
        :sortOrder,
        :isEnabled,
        :rawJson
      )
      ON DUPLICATE KEY UPDATE
        media_id = VALUES(media_id),
        media_url = VALUES(media_url),
        alt_text = VALUES(alt_text),
        description = VALUES(description),
        sort_order = VALUES(sort_order),
        is_enabled = VALUES(is_enabled),
        raw_json = VALUES(raw_json),
        deleted_at = NULL`,
      {
        assetKey,
        mediaId,
        mediaUrl,
        altText: asNullableString(asset.altText ?? asset.imageAlt),
        description: asNullableString(asset.description ?? asset.summary),
        sortOrder: asNumber(asset.sortOrder ?? asset.sort_order, 0),
        isEnabled: asBoolean(asset.enabled ?? asset.is_enabled, true) ? 1 : 0,
        rawJson: JSON.stringify(asset),
      },
    );

    counts[exists ? 'updatedCount' : 'insertedCount'] += 1;
    addWrite(counts.actualWrites, 'company_assets', exists ? 'updated' : 'inserted');
  }

  return counts;
}

async function migrateHomeVideo(context: MigrationContext): Promise<CountableWrite> {
  const source = await loadSource(context.definition);
  const data = isRecord(source.data) ? source.data : {};
  const counts = emptyWrites();
  const videoUrl = asNullableString(data.videoUrl ?? data.video_url);
  const posterUrl = asNullableString(data.posterUrl ?? data.poster_url);
  const videoMediaId = await upsertMediaFile({
    pool: context.pool,
    writes: counts.actualWrites,
    publicUrl: videoUrl,
    fileName: asNullableString(data.videoFileName),
    originalName: asNullableString(data.videoDisplayName),
    altText: asNullableString(data.title),
    description: asNullableString(data.description),
    category: 'home-video',
    metadata: { moduleName: context.plan.moduleName, mediaRole: 'video' },
  });
  const posterMediaId = await upsertMediaFile({
    pool: context.pool,
    writes: counts.actualWrites,
    publicUrl: posterUrl,
    fileName: asNullableString(data.posterFileName),
    originalName: asNullableString(data.posterDisplayName),
    altText: asNullableString(data.title),
    description: asNullableString(data.description),
    category: 'home-video',
    metadata: { moduleName: context.plan.moduleName, mediaRole: 'poster' },
  });
  const exists = await rowExists(
    context.pool,
    'SELECT COUNT(*) AS count FROM home_video WHERE singleton_key = :singletonKey',
    { singletonKey: 'home_video' },
  );

  await context.pool.execute(
    `INSERT INTO home_video (
      singleton_key,
      video_media_id,
      poster_media_id,
      video_url,
      poster_url,
      title,
      description,
      is_enabled
    ) VALUES (
      'home_video',
      :videoMediaId,
      :posterMediaId,
      :videoUrl,
      :posterUrl,
      :title,
      :description,
      :isEnabled
    )
    ON DUPLICATE KEY UPDATE
      video_media_id = VALUES(video_media_id),
      poster_media_id = VALUES(poster_media_id),
      video_url = VALUES(video_url),
      poster_url = VALUES(poster_url),
      title = VALUES(title),
      description = VALUES(description),
      is_enabled = VALUES(is_enabled),
      deleted_at = NULL`,
    {
      videoMediaId,
      posterMediaId,
      videoUrl,
      posterUrl,
      title: asNullableString(data.title),
      description: asNullableString(data.description),
      isEnabled: asBoolean(data.enabled ?? data.is_enabled, true) ? 1 : 0,
    },
  );

  counts[exists ? 'updatedCount' : 'insertedCount'] += 1;
  addWrite(counts.actualWrites, 'home_video', exists ? 'updated' : 'inserted');

  return counts;
}

function validateHomeInteractiveImages(images: Record<string, unknown>[]): MigrationWarning[] {
  const warnings: MigrationWarning[] = [];
  const slots = images.map((image) => asNumber(image.slotNo ?? image.slot_number, -1));

  if (images.length !== 12) {
    warnings.push({
      code: 'home_interactive_images_count_not_12',
      level: 'warning',
      message: `home-interactive-images.json contains ${images.length} records; expected exactly 12.`,
    });
  }

  for (const slot of slots) {
    if (!Number.isInteger(slot) || slot < 1 || slot > 12) {
      warnings.push({
        code: 'home_interactive_images_invalid_slot',
        level: 'error',
        message: `Invalid slot_number "${slot}". Expected 1-12.`,
      });
    }
  }

  if (new Set(slots).size !== slots.length) {
    warnings.push({
      code: 'home_interactive_images_duplicate_slot',
      level: 'error',
      message: 'home-interactive-images.json contains duplicate slot numbers.',
    });
  }

  return warnings;
}

async function migrateHomeInteractiveImages(context: MigrationContext): Promise<CountableWrite> {
  const source = await loadSource(context.definition);
  const images = Array.isArray(source.data) ? source.data.filter(isRecord) : [];
  const validationWarnings = validateHomeInteractiveImages(images);
  const blockingWarning = validationWarnings.find((warning) => warning.level === 'error');

  if (blockingWarning) {
    throw new Error(blockingWarning.message);
  }

  const counts = emptyWrites();
  counts.warnings.push(...validationWarnings);

  for (const image of images) {
    const slotNumber = asNumber(image.slotNo ?? image.slot_number, -1);
    const imageUrl = asNullableString(image.mediaUrl ?? image.imageUrl ?? image.image_url);
    const mediaId = await upsertMediaFile({
      pool: context.pool,
      writes: counts.actualWrites,
      publicUrl: imageUrl,
      fileName: asNullableString(image.mediaFileName ?? image.fileName),
      altText: asNullableString(image.alt ?? image.altText),
      category: 'home-interactive-images',
      metadata: { moduleName: context.plan.moduleName, slotNumber },
    });
    const exists = await rowExists(
      context.pool,
      'SELECT COUNT(*) AS count FROM home_interactive_images WHERE slot_number = :slotNumber',
      { slotNumber },
    );

    await context.pool.execute(
      `INSERT INTO home_interactive_images (
        slot_number,
        media_id,
        image_url,
        alt_text,
        sort_order,
        is_enabled
      ) VALUES (
        :slotNumber,
        :mediaId,
        :imageUrl,
        :altText,
        :sortOrder,
        :isEnabled
      )
      ON DUPLICATE KEY UPDATE
        media_id = VALUES(media_id),
        image_url = VALUES(image_url),
        alt_text = VALUES(alt_text),
        sort_order = VALUES(sort_order),
        is_enabled = VALUES(is_enabled),
        deleted_at = NULL`,
      {
        slotNumber,
        mediaId,
        imageUrl,
        altText: asNullableString(image.alt ?? image.altText),
        sortOrder: asNumber(image.sortOrder ?? image.sort_order, slotNumber),
        isEnabled: asBoolean(image.enabled ?? image.is_enabled, true) ? 1 : 0,
      },
    );

    counts[exists ? 'updatedCount' : 'insertedCount'] += 1;
    addWrite(counts.actualWrites, 'home_interactive_images', exists ? 'updated' : 'inserted');
  }

  return counts;
}

type PublishLogManifestEntry = {
  fileName: string;
};

function getPublishLogManifestEntries(data: unknown): PublishLogManifestEntry[] {
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

function getPublishVersion(log: Record<string, unknown>, fileName: string): {
  publishVersion: string;
  usedFileNameFallback: boolean;
} {
  const fromLog = stableVersionValue(log.version)
    ?? stableVersionValue(log.publishVersion)
    ?? stableVersionValue(log.publish_version)
    ?? stableVersionValue(log.publishId)
    ?? stableVersionValue(log.publish_id)
    ?? stableVersionValue(log.timestamp)
    ?? stableVersionValue(log.generatedAt)
    ?? stableVersionValue(log.generated_at);

  return {
    publishVersion: (fromLog ?? fileNameWithoutExt(fileName)).slice(0, 120),
    usedFileNameFallback: !fromLog,
  };
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

function getPublishType(log: Record<string, unknown>, status: string): string {
  return (firstString(log, 'publishType', 'publish_type', 'type') ?? (status === 'rollback' ? 'rollback' : 'full'))
    .slice(0, 40);
}

function getJsonArrayString(value: unknown): string | null {
  return Array.isArray(value) ? JSON.stringify(value) : null;
}

function getSourceStatsJson(log: Record<string, unknown>, fileName: string): string | null {
  const sourceStats = log.sourceStats ?? log.source_stats;

  if (sourceStats !== undefined) {
    return JSON.stringify(sourceStats);
  }

  const stats: Record<string, unknown> = {
    fileName,
  };
  const knownStatKeys = [
    'totalRoutes',
    'skippedRoutes',
    'sitemapPath',
    'robotsPath',
    'manifestPath',
    'triggeredBy',
  ];
  let hasStats = false;

  for (const key of knownStatKeys) {
    if (log[key] !== undefined) {
      stats[key] = log[key] as SqlValue;
      hasStats = true;
    }
  }

  return hasStats ? JSON.stringify(stats) : null;
}

function getPublishSummary(log: Record<string, unknown>): string | null {
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

function getPublishErrorMessage(log: Record<string, unknown>): string | null {
  const directError = firstString(log, 'errorMessage', 'error_message', 'error');

  if (directError) {
    return directError;
  }

  if (Array.isArray(log.errors) && log.errors.length > 0) {
    return JSON.stringify(log.errors);
  }

  return null;
}

function getPublishStartedAt(log: Record<string, unknown>): Date | null {
  return asDate(log.startedAt ?? log.started_at ?? log.generatedAt ?? log.generated_at ?? log.createdAt ?? log.created_at);
}

function getPublishFinishedAt(log: Record<string, unknown>): Date | null {
  return asDate(log.finishedAt ?? log.finished_at ?? log.completedAt ?? log.completed_at ?? log.generatedAt ?? log.generated_at);
}

async function migratePublishLogs(context: MigrationContext): Promise<CountableWrite> {
  const source = await loadSource(context.definition);
  const entries = getPublishLogManifestEntries(source.data);
  const counts = emptyWrites();
  const seenVersions = new Set<string>();
  const duplicateVersions = new Set<string>();
  let publishLogsCount = 0;
  let invalidJsonCount = 0;
  let missingVersionCount = 0;
  let missingStartedAtCount = 0;
  let missingFinishedAtCount = 0;
  let duplicateCount = 0;
  let successLogCount = 0;
  let failedLogCount = 0;
  let rollbackLogCount = 0;
  let unknownLogCount = 0;

  for (const entry of entries) {
    const absolutePath = path.join(source.absolutePath, entry.fileName);
    let log: Record<string, unknown>;

    try {
      const rawContent = await readFile(absolutePath, 'utf8');
      const parsed = JSON.parse(rawContent) as unknown;

      if (!isRecord(parsed)) {
        throw new Error('Publish log JSON root is not an object.');
      }

      log = parsed;
    } catch (error) {
      invalidJsonCount += 1;
      counts.skippedCount += 1;
      addWrite(counts.actualWrites, 'publish_logs', 'skipped');
      counts.warnings.push({
        code: 'publish_log_invalid_json',
        level: 'warning',
        message: `Skipped publish log ${entry.fileName}: ${error instanceof Error ? error.message : 'invalid JSON'}.`,
      });
      continue;
    }

    const { publishVersion, usedFileNameFallback } = getPublishVersion(log, entry.fileName);

    if (usedFileNameFallback) {
      missingVersionCount += 1;
    }

    if (seenVersions.has(publishVersion)) {
      duplicateCount += 1;
      duplicateVersions.add(publishVersion);
      counts.skippedCount += 1;
      addWrite(counts.actualWrites, 'publish_logs', 'skipped');
      continue;
    }

    seenVersions.add(publishVersion);

    const status = normalizePublishStatus(log);
    const startedAt = getPublishStartedAt(log);
    const finishedAt = getPublishFinishedAt(log);

    if (!startedAt) {
      missingStartedAtCount += 1;
    }

    if (!finishedAt) {
      missingFinishedAtCount += 1;
    }

    if (status === 'success') {
      successLogCount += 1;
    } else if (status === 'failed') {
      failedLogCount += 1;
    } else if (status === 'rollback') {
      rollbackLogCount += 1;
    } else {
      unknownLogCount += 1;
    }

    const exists = await rowExists(
      context.pool,
      'SELECT COUNT(*) AS count FROM publish_logs WHERE publish_version = :publishVersion',
      { publishVersion },
    );

    await context.pool.execute(
      `INSERT INTO publish_logs (
        publish_version,
        publish_type,
        target_type,
        target_id,
        status,
        release_dir,
        previous_version,
        rollback_to_version,
        summary,
        error_message,
        source_stats_json,
        failed_routes_json,
        routes_json,
        raw_log_json,
        started_at,
        finished_at
      ) VALUES (
        :publishVersion,
        :publishType,
        :targetType,
        :targetId,
        :status,
        :releaseDir,
        :previousVersion,
        :rollbackToVersion,
        :summary,
        :errorMessage,
        :sourceStatsJson,
        :failedRoutesJson,
        :routesJson,
        :rawLogJson,
        :startedAt,
        :finishedAt
      )
      ON DUPLICATE KEY UPDATE
        publish_type = VALUES(publish_type),
        target_type = VALUES(target_type),
        target_id = VALUES(target_id),
        status = VALUES(status),
        release_dir = VALUES(release_dir),
        previous_version = VALUES(previous_version),
        rollback_to_version = VALUES(rollback_to_version),
        summary = VALUES(summary),
        error_message = VALUES(error_message),
        source_stats_json = VALUES(source_stats_json),
        failed_routes_json = VALUES(failed_routes_json),
        routes_json = VALUES(routes_json),
        raw_log_json = VALUES(raw_log_json),
        started_at = VALUES(started_at),
        finished_at = VALUES(finished_at),
        deleted_at = NULL`,
      {
        publishVersion,
        publishType: getPublishType(log, status),
        targetType: firstString(log, 'targetType', 'target_type'),
        targetId: asOptionalUnsignedInteger(log.targetId ?? log.target_id),
        status,
        releaseDir: firstString(log, 'releaseDir', 'release_dir', 'outputDir', 'outDir'),
        previousVersion: firstString(log, 'previousVersion', 'previous_version'),
        rollbackToVersion: firstString(log, 'rollbackToVersion', 'rollback_to_version'),
        summary: getPublishSummary(log),
        errorMessage: getPublishErrorMessage(log),
        sourceStatsJson: getSourceStatsJson(log, entry.fileName),
        failedRoutesJson: getJsonArrayString(log.failedRoutes ?? log.failed_routes),
        routesJson: getJsonArrayString(log.routes ?? log.generatedRoutes ?? log.generated_routes),
        rawLogJson: JSON.stringify(log),
        startedAt,
        finishedAt,
      },
    );

    counts[exists ? 'updatedCount' : 'insertedCount'] += 1;
    addWrite(counts.actualWrites, 'publish_logs', exists ? 'updated' : 'inserted');
    publishLogsCount += 1;
  }

  if (missingVersionCount > 0) {
    counts.warnings.push({
      code: 'publish_log_missing_version',
      level: 'info',
      message: `${missingVersionCount} publish logs had no explicit version field; publish_version was derived from file name.`,
    });
  }

  if (missingStartedAtCount > 0 || missingFinishedAtCount > 0) {
    counts.warnings.push({
      code: 'publish_log_missing_time_field',
      level: 'info',
      message: `${missingStartedAtCount} publish logs have no parseable started_at and ${missingFinishedAtCount} have no parseable finished_at.`,
    });
  }

  if (duplicateCount > 0) {
    counts.warnings.push({
      code: 'publish_log_duplicate_version',
      level: 'warning',
      message: `${duplicateCount} publish log source entries were skipped across ${duplicateVersions.size} duplicate publish_version values.`,
    });
  }

  counts.details = {
    sourceCount: context.plan.sourceCount,
    publishLogCount: publishLogsCount,
    publishLogsCount,
    invalidJsonCount,
    missingVersionCount,
    missingStartedAtCount,
    missingFinishedAtCount,
    duplicateCount,
    duplicate: {
      publish_logs: duplicateCount,
    },
    successLogCount,
    failedLogCount,
    rollbackLogCount,
    unknownLogCount,
    dedupeStrategy: {
      publishLogs: ['publish_version'],
    },
    inserted: {
      publish_logs: tableWriteCount(counts, 'publish_logs', 'inserted'),
    },
    updated: {
      publish_logs: tableWriteCount(counts, 'publish_logs', 'updated'),
    },
    skipped: {
      publish_logs: tableWriteCount(counts, 'publish_logs', 'skipped'),
    },
    jsonPrimarySource: true,
    shadowIndexOnly: true,
  };

  return counts;
}

const migrators: Record<WritableContentModuleName, (context: MigrationContext) => Promise<CountableWrite>> = {
  articles: migrateArticles,
  cases: migrateCases,
  solutions: migrateSolutions,
  'scenario-detail-pages': migrateScenarioDetailPages,
  pages: migratePages,
  'contact-info': migrateContactInfo,
  'company-assets': migrateCompanyAssets,
  'home-video': migrateHomeVideo,
  'home-interactive-images': migrateHomeInteractiveImages,
  'media-library': migrateMediaLibrary,
  'publish-logs': migratePublishLogs,
};

export function isWritableContentModule(moduleName: MigrationModuleName): moduleName is WritableContentModuleName {
  return writableContentModules.includes(moduleName as WritableContentModuleName);
}

export async function migrateLowRiskModule(context: MigrationContext): Promise<ModuleMigrationResult> {
  const startedAt = new Date();

  if (!isWritableContentModule(context.plan.moduleName)) {
    return finishResult({
      plan: context.plan,
      status: 'not_implemented',
      counts: {
        insertedCount: 0,
        updatedCount: 0,
        skippedCount: context.plan.sourceCount,
        actualWrites: [],
        warnings: [],
      },
      startedAt,
      skippedReason: context.plan.skippedReason ?? 'not_implemented_in_22_3B_9',
    });
  }

  if (await hasSuccessfulSourceHash(context.pool, context.plan)) {
    return finishResult({
      plan: context.plan,
      status: 'skipped',
      counts: {
        insertedCount: 0,
        updatedCount: 0,
        skippedCount: context.plan.sourceCount,
        actualWrites: [],
        warnings: [],
      },
      startedAt,
      skippedReason: 'source_hash_already_successfully_migrated',
    });
  }

  try {
    const counts = await migrators[context.plan.moduleName](context);

    return finishResult({
      plan: context.plan,
      status: 'success',
      counts,
      startedAt,
      warnings: [...context.plan.warnings, ...counts.warnings],
    });
  } catch (error) {
    const warning: MigrationWarning = {
      code: 'business_write_failed',
      level: 'error',
      message: error instanceof Error ? error.message : 'Business table write failed.',
    };

    return finishResult({
      plan: context.plan,
      status: 'failed',
      counts: {
        insertedCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        actualWrites: [],
        warnings: [],
      },
      startedAt,
      warnings: [...context.plan.warnings, warning],
      errorMessage: warning.message,
    });
  }
}
