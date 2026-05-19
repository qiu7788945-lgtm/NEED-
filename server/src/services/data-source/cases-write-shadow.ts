import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { CaseStudy } from '../../../../shared/types/case.js';
import { getDbPool, getSafeDatabaseConfig } from '../../db/client.js';

type ShadowOperation = 'create' | 'update' | 'status' | 'reorder';
type WarningMeta = Record<string, unknown>;

type CaseIdentityRow = RowDataPacket & {
  id: unknown;
};

type CaseImageIdentityRow = RowDataPacket & {
  id: unknown;
};

function warnShadowSkipped(reason: string, error?: unknown, meta: WarningMeta = {}) {
  console.warn('cases MySQL shadow update skipped.', {
    reason,
    message: error instanceof Error ? error.message : error ? String(error) : undefined,
    ...meta,
  });
}

function isMysqlConfigured() {
  try {
    return getSafeDatabaseConfig().configured;
  } catch (error) {
    warnShadowSkipped('mysql-config-invalid', error);
    return false;
  }
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function toMysqlDateTime(value: string | undefined) {
  const date = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;

  return safeDate.toISOString().slice(0, 19).replace('T', ' ');
}

function publishedAtForCase(caseItem: CaseStudy) {
  if (caseItem.status !== 'published') {
    return null;
  }

  return toMysqlDateTime(caseItem.updatedAt || caseItem.createdAt);
}

function stableKeys(caseItem: CaseStudy) {
  return {
    sourceId: asString(caseItem.id),
    slug: asString(caseItem.slug),
  };
}

function asNumber(value: unknown, fallback: number) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

async function shadowReplaceCaseImages(mysqlCaseId: number, caseItem: CaseStudy) {
  if (!isMysqlConfigured()) {
    return;
  }

  const { sourceId, slug } = stableKeys(caseItem);

  try {
    const pool = getDbPool();
    const images = Array.isArray(caseItem.extractedImages) ? caseItem.extractedImages : [];

    await pool.execute<ResultSetHeader>(
      `UPDATE case_images
       SET deleted_at = NOW(),
           updated_at = NOW()
       WHERE case_id = :mysqlCaseId`,
      { mysqlCaseId },
    );

    for (const [index, image] of images.entries()) {
      const imageUrl = asString(image.url);
      if (!imageUrl) {
        continue;
      }

      const sortOrder = asNumber(image.sortOrder, index + 1);
      const fileName = asString(image.fileName);
      const displayName = asString(image.displayName);
      const altText = asString(image.alt) || displayName || fileName;
      const caption = displayName || fileName;
      const [rows] = await pool.execute<CaseImageIdentityRow[]>(
        `SELECT id
         FROM case_images
         WHERE case_id = :mysqlCaseId
           AND image_url = :imageUrl
         ORDER BY deleted_at ASC, id ASC
         LIMIT 1`,
        {
          mysqlCaseId,
          imageUrl,
        },
      );
      const existingId = Number(rows[0]?.id);

      if (Number.isInteger(existingId) && existingId > 0) {
        await pool.execute<ResultSetHeader>(
          `UPDATE case_images
           SET media_id = NULL,
               image_url = :imageUrl,
               alt_text = :altText,
               caption = :caption,
               sort_order = :sortOrder,
               is_enabled = 1,
               deleted_at = NULL,
               updated_at = NOW()
           WHERE id = :id`,
          {
            id: existingId,
            imageUrl,
            altText,
            caption,
            sortOrder,
          },
        );
        continue;
      }

      await pool.execute<ResultSetHeader>(
        `INSERT INTO case_images (
          case_id,
          media_id,
          image_url,
          alt_text,
          caption,
          sort_order,
          is_enabled
        ) VALUES (
          :mysqlCaseId,
          NULL,
          :imageUrl,
          :altText,
          :caption,
          :sortOrder,
          1
        )`,
        {
          mysqlCaseId,
          imageUrl,
          altText,
          caption,
          sortOrder,
        },
      );
    }
  } catch (error) {
    warnShadowSkipped('case-images-shadow-replace-failed', error, {
      operation: 'case-images',
      mysqlCaseId,
      sourceId,
      slug,
    });
  }
}

async function findExistingCaseId(caseItem: CaseStudy): Promise<number | null> {
  const pool = getDbPool();
  const { sourceId, slug } = stableKeys(caseItem);

  if (sourceId) {
    const [rows] = await pool.execute<CaseIdentityRow[]>(
      `SELECT id
       FROM cases
       WHERE source_id = :sourceId
         AND deleted_at IS NULL
       LIMIT 1`,
      { sourceId },
    );
    const mysqlId = Number(rows[0]?.id);
    if (Number.isInteger(mysqlId) && mysqlId > 0) {
      return mysqlId;
    }
  }

  if (slug) {
    const [rows] = await pool.execute<CaseIdentityRow[]>(
      `SELECT id
       FROM cases
       WHERE slug = :slug
         AND deleted_at IS NULL
       LIMIT 1`,
      { slug },
    );
    const mysqlId = Number(rows[0]?.id);
    if (Number.isInteger(mysqlId) && mysqlId > 0) {
      return mysqlId;
    }
  }

  return null;
}

async function withExistingCaseId(caseItem: CaseStudy, operation: ShadowOperation, task: (mysqlId: number) => Promise<void>) {
  const { sourceId, slug } = stableKeys(caseItem);
  if (!sourceId && !slug) {
    warnShadowSkipped('case-stable-key-missing', undefined, { operation });
    return;
  }

  try {
    const mysqlId = await findExistingCaseId(caseItem);
    if (!mysqlId) {
      warnShadowSkipped('case-row-missing', undefined, {
        operation,
        sourceId,
        slug,
      });
      return;
    }

    await task(mysqlId);
  } catch (error) {
    warnShadowSkipped('mysql-shadow-update-failed', error, {
      operation,
      sourceId,
      slug,
    });
  }
}

export async function shadowCreateCase(caseItem: CaseStudy) {
  if (!isMysqlConfigured()) {
    return;
  }

  const { sourceId, slug } = stableKeys(caseItem);
  if (!sourceId && !slug) {
    warnShadowSkipped('case-stable-key-missing', undefined, { operation: 'create' });
    return;
  }

  try {
    const mysqlId = await findExistingCaseId(caseItem);
    if (mysqlId) {
      await getDbPool().execute<ResultSetHeader>(
        `UPDATE cases
         SET source_id = :sourceId,
             title = :title,
             slug = :slug,
             summary = :summary,
             client_type = :clientType,
             event_type = :eventType,
             event_date = :eventDate,
             location = :location,
             cover_url = :coverUrl,
             cover_file_name = :coverFileName,
             cover_display_name = :coverDisplayName,
             word_file_name = :wordFileName,
             word_original_name = :wordOriginalName,
             content_html = :contentHtml,
             content_text = :contentText,
             status = :status,
             sort_order = :sortOrder,
             published_at = :publishedAt,
             created_at = :createdAt,
             updated_at = :updatedAt,
             raw_json = :rawJson,
             deleted_at = NULL
         WHERE id = :mysqlId`,
        {
          mysqlId,
          sourceId,
          title: caseItem.title,
          slug: caseItem.slug,
          summary: caseItem.summary,
          clientType: caseItem.clientType,
          eventType: caseItem.eventType,
          eventDate: caseItem.eventDate,
          location: caseItem.location,
          coverUrl: caseItem.coverUrl,
          coverFileName: caseItem.coverFileName,
          coverDisplayName: caseItem.coverDisplayName,
          wordFileName: caseItem.wordFileName,
          wordOriginalName: caseItem.wordOriginalName,
          contentHtml: caseItem.contentHtml,
          contentText: caseItem.contentText,
          status: caseItem.status,
          sortOrder: caseItem.sortOrder,
          publishedAt: publishedAtForCase(caseItem),
          createdAt: toMysqlDateTime(caseItem.createdAt),
          updatedAt: toMysqlDateTime(caseItem.updatedAt),
          rawJson: JSON.stringify(caseItem),
        },
      );
      await shadowReplaceCaseImages(mysqlId, caseItem);
      return;
    }

    await getDbPool().execute<ResultSetHeader>(
      `INSERT INTO cases (
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
        published_at,
        created_at,
        updated_at
      ) VALUES (
        :sourceId,
        :title,
        :slug,
        :summary,
        :clientType,
        :eventType,
        :eventDate,
        :location,
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
        :publishedAt,
        :createdAt,
        :updatedAt
      )
      ON DUPLICATE KEY UPDATE
        source_id = VALUES(source_id),
        title = VALUES(title),
        slug = VALUES(slug),
        summary = VALUES(summary),
        client_type = VALUES(client_type),
        event_type = VALUES(event_type),
        event_date = VALUES(event_date),
        location = VALUES(location),
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
        published_at = VALUES(published_at),
        created_at = VALUES(created_at),
        updated_at = VALUES(updated_at),
        deleted_at = NULL`,
      {
        sourceId,
        title: caseItem.title,
        slug: caseItem.slug,
        summary: caseItem.summary,
        clientType: caseItem.clientType,
        eventType: caseItem.eventType,
        eventDate: caseItem.eventDate,
        location: caseItem.location,
        coverUrl: caseItem.coverUrl,
        coverFileName: caseItem.coverFileName,
        coverDisplayName: caseItem.coverDisplayName,
        wordFileName: caseItem.wordFileName,
        wordOriginalName: caseItem.wordOriginalName,
        contentHtml: caseItem.contentHtml,
        contentText: caseItem.contentText,
        status: caseItem.status,
        sortOrder: caseItem.sortOrder,
        publishedAt: publishedAtForCase(caseItem),
        createdAt: toMysqlDateTime(caseItem.createdAt),
        updatedAt: toMysqlDateTime(caseItem.updatedAt),
        rawJson: JSON.stringify(caseItem),
      },
    );
    const nextMysqlId = await findExistingCaseId(caseItem);
    if (!nextMysqlId) {
      warnShadowSkipped('case-row-missing-after-create', undefined, {
        operation: 'create',
        sourceId,
        slug,
      });
      return;
    }

    await shadowReplaceCaseImages(nextMysqlId, caseItem);
  } catch (error) {
    warnShadowSkipped('mysql-shadow-create-failed', error, {
      operation: 'create',
      sourceId,
      slug,
    });
  }
}

export async function shadowUpdateCaseStatus(caseItem: CaseStudy) {
  if (!isMysqlConfigured()) {
    return;
  }

  await withExistingCaseId(caseItem, 'status', async (mysqlId) => {
    await getDbPool().execute<ResultSetHeader>(
      `UPDATE cases
       SET status = :status,
           published_at = :publishedAt,
           updated_at = :updatedAt,
           raw_json = :rawJson
       WHERE id = :mysqlId`,
      {
        mysqlId,
        status: caseItem.status,
        publishedAt: publishedAtForCase(caseItem),
        updatedAt: toMysqlDateTime(caseItem.updatedAt),
        rawJson: JSON.stringify(caseItem),
      },
    );
  });
}

export async function shadowUpdateCase(caseItem: CaseStudy) {
  if (!isMysqlConfigured()) {
    return;
  }

  await withExistingCaseId(caseItem, 'update', async (mysqlId) => {
    await getDbPool().execute<ResultSetHeader>(
      `UPDATE cases
       SET title = :title,
           slug = :slug,
           summary = :summary,
           client_type = :clientType,
           event_type = :eventType,
           event_date = :eventDate,
           location = :location,
           cover_url = :coverUrl,
           cover_file_name = :coverFileName,
           cover_display_name = :coverDisplayName,
           word_file_name = :wordFileName,
           word_original_name = :wordOriginalName,
           content_html = :contentHtml,
           content_text = :contentText,
           status = :status,
           sort_order = :sortOrder,
           published_at = :publishedAt,
           updated_at = :updatedAt,
           raw_json = :rawJson
       WHERE id = :mysqlId`,
      {
        mysqlId,
        title: caseItem.title,
        slug: caseItem.slug,
        summary: caseItem.summary,
        clientType: caseItem.clientType,
        eventType: caseItem.eventType,
        eventDate: caseItem.eventDate,
        location: caseItem.location,
        coverUrl: caseItem.coverUrl,
        coverFileName: caseItem.coverFileName,
        coverDisplayName: caseItem.coverDisplayName,
        wordFileName: caseItem.wordFileName,
        wordOriginalName: caseItem.wordOriginalName,
        contentHtml: caseItem.contentHtml,
        contentText: caseItem.contentText,
        status: caseItem.status,
        sortOrder: caseItem.sortOrder,
        publishedAt: publishedAtForCase(caseItem),
        updatedAt: toMysqlDateTime(caseItem.updatedAt),
        rawJson: JSON.stringify(caseItem),
      },
    );
    await shadowReplaceCaseImages(mysqlId, caseItem);
  });
}

export async function shadowReorderCases(caseItems: CaseStudy[]) {
  if (!isMysqlConfigured()) {
    return;
  }

  for (const caseItem of caseItems) {
    await withExistingCaseId(caseItem, 'reorder', async (mysqlId) => {
      await getDbPool().execute<ResultSetHeader>(
        `UPDATE cases
         SET sort_order = :sortOrder,
             updated_at = :updatedAt,
             raw_json = :rawJson
         WHERE id = :mysqlId`,
        {
          mysqlId,
          sortOrder: caseItem.sortOrder,
          updatedAt: toMysqlDateTime(caseItem.updatedAt),
          rawJson: JSON.stringify(caseItem),
        },
      );
    });
  }
}
