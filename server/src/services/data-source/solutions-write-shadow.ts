import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type {
  SolutionGroup,
  SolutionScene,
  SolutionSceneSlug,
} from '../../../../shared/types/solution.js';
import { getDbPool, getSafeDatabaseConfig } from '../../db/client.js';

type WarningMeta = Record<string, unknown>;
type ShadowOperation = 'create-group' | 'update-group' | 'reorder-groups';

type SolutionIdentityRow = RowDataPacket & {
  id: unknown;
};

type SolutionGroupIdentityRow = RowDataPacket & {
  id: unknown;
};

function warnShadowSkipped(reason: string, error?: unknown, meta: WarningMeta = {}) {
  console.warn('solutions MySQL shadow update skipped.', {
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

function asNumber(value: unknown, fallback: number) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function toMysqlDateTime(value: string | undefined, fallback = new Date()) {
  const date = value ? new Date(value) : fallback;
  const safeDate = Number.isNaN(date.getTime()) ? fallback : date;

  return safeDate.toISOString().slice(0, 19).replace('T', ' ');
}

function groupStableKeys(group: SolutionGroup) {
  return {
    sourceId: asString(group.id),
    slug: asString(group.slug),
  };
}

async function findSolutionId(sceneSlug: SolutionSceneSlug): Promise<number | null> {
  const [rows] = await getDbPool().execute<SolutionIdentityRow[]>(
    `SELECT id
     FROM solutions
     WHERE slug = :sceneSlug
       AND deleted_at IS NULL
     LIMIT 1`,
    { sceneSlug },
  );
  const solutionId = Number(rows[0]?.id);

  return Number.isInteger(solutionId) && solutionId > 0 ? solutionId : null;
}

async function findSolutionGroupId(
  solutionId: number,
  group: SolutionGroup,
  options: { includeDeleted: boolean },
): Promise<number | null> {
  const { sourceId, slug } = groupStableKeys(group);
  const deletedClause = options.includeDeleted ? '' : ' AND deleted_at IS NULL';

  if (sourceId) {
    const [rows] = await getDbPool().execute<SolutionGroupIdentityRow[]>(
      `SELECT id
       FROM solution_groups
       WHERE source_id = :sourceId${deletedClause}
       ORDER BY deleted_at ASC, id ASC
       LIMIT 1`,
      { sourceId },
    );
    const groupId = Number(rows[0]?.id);
    if (Number.isInteger(groupId) && groupId > 0) {
      return groupId;
    }
  }

  if (slug) {
    const [rows] = await getDbPool().execute<SolutionGroupIdentityRow[]>(
      `SELECT id
       FROM solution_groups
       WHERE solution_id = :solutionId
         AND slug = :slug${deletedClause}
       ORDER BY deleted_at ASC, id ASC
       LIMIT 1`,
      {
        solutionId,
        slug,
      },
    );
    const groupId = Number(rows[0]?.id);
    if (Number.isInteger(groupId) && groupId > 0) {
      return groupId;
    }
  }

  return null;
}

async function updateSceneRawJson(solutionId: number, sceneAfterWrite: SolutionScene) {
  await getDbPool().execute<ResultSetHeader>(
    `UPDATE solutions
     SET raw_json = :rawJson,
         updated_at = NOW()
     WHERE id = :solutionId
       AND deleted_at IS NULL`,
    {
      solutionId,
      rawJson: JSON.stringify(sceneAfterWrite),
    },
  );
}

async function upsertSolutionGroup(solutionId: number, sceneSlug: SolutionSceneSlug, group: SolutionGroup) {
  const { sourceId, slug } = groupStableKeys(group);
  const title = asString(group.title);

  if (!sourceId || !slug || !title) {
    warnShadowSkipped('solution-group-stable-key-missing', undefined, {
      sceneSlug,
      sourceId,
      slug,
    });
    return;
  }

  const groupId = await findSolutionGroupId(solutionId, group, { includeDeleted: true });
  const now = new Date();
  const params = {
    solutionId,
    sourceId,
    title,
    slug,
    summary: asString(group.summary),
    sceneSlug,
    sortOrder: asNumber(group.sortOrder, 0),
    isEnabled: group.enabled ? 1 : 0,
    createdAt: toMysqlDateTime(group.createdAt, now),
    updatedAt: toMysqlDateTime(group.updatedAt, now),
  };

  if (groupId) {
    await getDbPool().execute<ResultSetHeader>(
      `UPDATE solution_groups
       SET solution_id = :solutionId,
           source_id = :sourceId,
           title = :title,
           slug = :slug,
           summary = :summary,
           scene_slug = :sceneSlug,
           sort_order = :sortOrder,
           is_enabled = :isEnabled,
           created_at = :createdAt,
           updated_at = :updatedAt,
           deleted_at = NULL
       WHERE id = :groupId`,
      {
        ...params,
        groupId,
      },
    );
    return;
  }

  await getDbPool().execute<ResultSetHeader>(
    `INSERT INTO solution_groups (
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
    ) VALUES (
      :solutionId,
      :sourceId,
      :title,
      :slug,
      :summary,
      :sceneSlug,
      :sortOrder,
      :isEnabled,
      :createdAt,
      :updatedAt
    )
    ON DUPLICATE KEY UPDATE
      solution_id = VALUES(solution_id),
      source_id = VALUES(source_id),
      title = VALUES(title),
      summary = VALUES(summary),
      scene_slug = VALUES(scene_slug),
      sort_order = VALUES(sort_order),
      is_enabled = VALUES(is_enabled),
      created_at = VALUES(created_at),
      updated_at = VALUES(updated_at),
      deleted_at = NULL`,
    params,
  );
}

async function updateSolutionGroupOrder(solutionId: number, sceneSlug: SolutionSceneSlug, group: SolutionGroup) {
  const { sourceId, slug } = groupStableKeys(group);
  const groupId = await findSolutionGroupId(solutionId, group, { includeDeleted: false });

  if (!groupId) {
    warnShadowSkipped('solution-group-row-missing', undefined, {
      operation: 'reorder-groups',
      sceneSlug,
      sourceId,
      slug,
    });
    return;
  }

  await getDbPool().execute<ResultSetHeader>(
    `UPDATE solution_groups
     SET sort_order = :sortOrder,
         is_enabled = :isEnabled,
         updated_at = :updatedAt
     WHERE id = :groupId
       AND deleted_at IS NULL`,
    {
      groupId,
      sortOrder: asNumber(group.sortOrder, 0),
      isEnabled: group.enabled ? 1 : 0,
      updatedAt: toMysqlDateTime(group.updatedAt),
    },
  );
}

async function withSolutionId(
  sceneSlug: SolutionSceneSlug,
  operation: ShadowOperation,
  task: (solutionId: number) => Promise<void>,
) {
  if (!isMysqlConfigured()) {
    return;
  }

  try {
    const solutionId = await findSolutionId(sceneSlug);
    if (!solutionId) {
      warnShadowSkipped('solution-row-missing', undefined, {
        operation,
        sceneSlug,
      });
      return;
    }

    await task(solutionId);
  } catch (error) {
    warnShadowSkipped('mysql-shadow-update-failed', error, {
      operation,
      sceneSlug,
    });
  }
}

export async function shadowCreateSolutionGroup(
  sceneSlug: SolutionSceneSlug,
  group: SolutionGroup,
  sceneAfterWrite: SolutionScene,
) {
  await withSolutionId(sceneSlug, 'create-group', async (solutionId) => {
    await upsertSolutionGroup(solutionId, sceneSlug, group);
    await updateSceneRawJson(solutionId, sceneAfterWrite);
  });
}

export async function shadowUpdateSolutionGroup(
  sceneSlug: SolutionSceneSlug,
  group: SolutionGroup,
  sceneAfterWrite: SolutionScene,
) {
  await withSolutionId(sceneSlug, 'update-group', async (solutionId) => {
    await upsertSolutionGroup(solutionId, sceneSlug, group);
    await updateSceneRawJson(solutionId, sceneAfterWrite);
  });
}

export async function shadowReorderSolutionGroups(
  sceneSlug: SolutionSceneSlug,
  groups: SolutionGroup[],
  sceneAfterWrite: SolutionScene,
) {
  await withSolutionId(sceneSlug, 'reorder-groups', async (solutionId) => {
    for (const group of groups) {
      await updateSolutionGroupOrder(solutionId, sceneSlug, group);
    }

    await updateSceneRawJson(solutionId, sceneAfterWrite);
  });
}
