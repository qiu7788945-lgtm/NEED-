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
    startedAt: input.startedAt,
    finishedAt: new Date(),
  };
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
      skippedReason: context.plan.skippedReason ?? 'not_implemented_in_22_3B_3',
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
