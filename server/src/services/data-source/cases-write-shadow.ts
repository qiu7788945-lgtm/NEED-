import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { CaseStudy } from '../../../../shared/types/case.js';
import { getDbPool, getSafeDatabaseConfig } from '../../db/client.js';

type ShadowOperation = 'status' | 'reorder';
type WarningMeta = Record<string, unknown>;

type CaseIdentityRow = RowDataPacket & {
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
