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
  'pages',
  'contact-info',
  'company-assets',
  'home-video',
  'home-interactive-images',
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

const migrators: Record<WritableContentModuleName, (context: MigrationContext) => Promise<CountableWrite>> = {
  articles: migrateArticles,
  pages: migratePages,
  'contact-info': migrateContactInfo,
  'company-assets': migrateCompanyAssets,
  'home-video': migrateHomeVideo,
  'home-interactive-images': migrateHomeInteractiveImages,
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
      skippedReason: context.plan.skippedReason ?? 'not_implemented_in_22_3B_5',
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
