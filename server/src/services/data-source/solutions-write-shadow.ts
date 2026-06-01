import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type {
  SolutionGroup,
  SolutionItem,
  SolutionScene,
  SolutionSceneSlug,
} from '../../../../shared/types/solution.js';
import { getDbPool, getSafeDatabaseConfig } from '../../db/client.js';

type WarningMeta = Record<string, unknown>;
type ShadowOperation =
  | 'create-group'
  | 'update-group'
  | 'reorder-groups'
  | 'add-item'
  | 'update-item'
  | 'reorder-items'
  | 'delete-item';

type SolutionIdentityRow = RowDataPacket & {
  id: unknown;
};

type SolutionGroupIdentityRow = RowDataPacket & {
  id: unknown;
};

type SolutionMediaItemIdentityRow = RowDataPacket & {
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

function itemStableKeys(item: SolutionItem) {
  return {
    sourceId: asString(item.id),
    mediaUrl: asString(item.mediaUrl),
    sortOrder: asNumber(item.sortOrder, 0),
  };
}

function toMysqlFileType(item: SolutionItem) {
  return item.fileType === 'video' ? 'video' : 'image';
}

function findGroupAfterWrite(sceneAfterWrite: SolutionScene, groupId: string) {
  return sceneAfterWrite.groups.find((group) => group.id === groupId);
}

function isValidMysqlId(value: unknown): value is number {
  const id = Number(value);
  return Number.isInteger(id) && id > 0;
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

  return isValidMysqlId(solutionId) ? solutionId : null;
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
    if (isValidMysqlId(groupId)) {
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
    if (isValidMysqlId(groupId)) {
      return groupId;
    }
  }

  return null;
}

async function findSolutionMediaItemId(
  groupId: number,
  item: SolutionItem,
  options: { includeDeleted: boolean },
): Promise<number | null> {
  const { sourceId, mediaUrl, sortOrder } = itemStableKeys(item);
  const deletedClause = options.includeDeleted ? '' : ' AND deleted_at IS NULL';

  if (sourceId) {
    const [rows] = await getDbPool().execute<SolutionMediaItemIdentityRow[]>(
      `SELECT id
       FROM solution_media_items
       WHERE source_id = :sourceId${deletedClause}
       ORDER BY deleted_at ASC, id ASC
       LIMIT 1`,
      { sourceId },
    );
    const itemId = Number(rows[0]?.id);
    if (isValidMysqlId(itemId)) {
      return itemId;
    }
  }

  if (mediaUrl) {
    const [rows] = await getDbPool().execute<SolutionMediaItemIdentityRow[]>(
      `SELECT id
       FROM solution_media_items
       WHERE group_id = :groupId
         AND media_url = :mediaUrl
         AND sort_order = :sortOrder${deletedClause}
       ORDER BY deleted_at ASC, id ASC
       LIMIT 1`,
      {
        groupId,
        mediaUrl,
        sortOrder,
      },
    );
    const itemId = Number(rows[0]?.id);
    if (isValidMysqlId(itemId)) {
      return itemId;
    }
  }

  return null;
}

async function findActiveSolutionMediaItemIds(groupId: number) {
  const [rows] = await getDbPool().execute<SolutionMediaItemIdentityRow[]>(
    `SELECT id
     FROM solution_media_items
     WHERE group_id = :groupId
       AND deleted_at IS NULL
     ORDER BY id ASC`,
    { groupId },
  );

  return rows
    .map((row) => Number(row.id))
    .filter(isValidMysqlId);
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

async function updateSolutionGroupUpdatedAt(groupId: number, group: SolutionGroup) {
  await getDbPool().execute<ResultSetHeader>(
    `UPDATE solution_groups
     SET updated_at = :updatedAt
     WHERE id = :groupId
       AND deleted_at IS NULL`,
    {
      groupId,
      updatedAt: toMysqlDateTime(group.updatedAt),
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

async function canWriteVideoSceneItem(
  sceneSlug: SolutionSceneSlug,
  group: SolutionGroup,
  groupId: number,
  itemId: number | null,
  operation: ShadowOperation,
) {
  if (sceneSlug !== 'video-digital-assets') {
    return true;
  }

  if (group.items.length > 1) {
    warnShadowSkipped('video-solution-group-has-multiple-json-items', undefined, {
      operation,
      sceneSlug,
      groupSourceId: group.id,
      itemCount: group.items.length,
    });
    return false;
  }

  const activeItemIds = await findActiveSolutionMediaItemIds(groupId);
  if (activeItemIds.length > 1) {
    warnShadowSkipped('video-solution-group-has-multiple-mysql-items', undefined, {
      operation,
      sceneSlug,
      groupSourceId: group.id,
      itemIds: activeItemIds,
    });
    return false;
  }

  if (!itemId && activeItemIds.length > 0) {
    warnShadowSkipped('video-solution-group-active-item-exists', undefined, {
      operation,
      sceneSlug,
      groupSourceId: group.id,
      itemIds: activeItemIds,
    });
    return false;
  }

  if (itemId && activeItemIds.length === 1 && activeItemIds[0] !== itemId) {
    warnShadowSkipped('video-solution-group-active-item-conflict', undefined, {
      operation,
      sceneSlug,
      groupSourceId: group.id,
      itemId,
      activeItemId: activeItemIds[0],
    });
    return false;
  }

  return true;
}

async function upsertSolutionMediaItem(
  groupId: number,
  sceneSlug: SolutionSceneSlug,
  group: SolutionGroup,
  item: SolutionItem,
  operation: ShadowOperation,
) {
  const { sourceId, mediaUrl, sortOrder } = itemStableKeys(item);

  if (!sourceId || !mediaUrl) {
    warnShadowSkipped('solution-media-item-stable-key-missing', undefined, {
      operation,
      sceneSlug,
      groupSourceId: group.id,
      sourceId,
      mediaUrl,
    });
    return;
  }

  const itemId = await findSolutionMediaItemId(groupId, item, { includeDeleted: true });
  if (!(await canWriteVideoSceneItem(sceneSlug, group, groupId, itemId, operation))) {
    return;
  }

  const now = new Date();
  const params = {
    groupId,
    sourceId,
    mediaId: null,
    fileType: toMysqlFileType(item),
    mediaUrl,
    mediaFileName: asString(item.mediaFileName),
    mediaDisplayName: asString(item.mediaDisplayName),
    altText: asString(item.alt),
    caption: asString(item.caption),
    sortOrder,
    isEnabled: item.enabled ? 1 : 0,
    createdAt: toMysqlDateTime(item.createdAt, now),
    updatedAt: toMysqlDateTime(group.updatedAt, now),
  };

  if (itemId) {
    await getDbPool().execute<ResultSetHeader>(
      `UPDATE solution_media_items
       SET group_id = :groupId,
           source_id = :sourceId,
           media_id = :mediaId,
           file_type = :fileType,
           media_url = :mediaUrl,
           media_file_name = :mediaFileName,
           media_display_name = :mediaDisplayName,
           alt_text = :altText,
           caption = :caption,
           sort_order = :sortOrder,
           is_enabled = :isEnabled,
           created_at = :createdAt,
           updated_at = :updatedAt,
           deleted_at = NULL
       WHERE id = :itemId`,
      {
        ...params,
        itemId,
      },
    );
    return;
  }

  await getDbPool().execute<ResultSetHeader>(
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
      is_enabled,
      created_at,
      updated_at
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
      :isEnabled,
      :createdAt,
      :updatedAt
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

async function updateSolutionMediaItemOrder(
  groupId: number,
  sceneSlug: SolutionSceneSlug,
  group: SolutionGroup,
  item: SolutionItem,
) {
  const { sourceId, mediaUrl, sortOrder } = itemStableKeys(item);
  const itemId = await findSolutionMediaItemId(groupId, item, { includeDeleted: false });

  if (!itemId) {
    warnShadowSkipped('solution-media-item-row-missing', undefined, {
      operation: 'reorder-items',
      sceneSlug,
      groupSourceId: group.id,
      sourceId,
      mediaUrl,
      sortOrder,
    });
    return;
  }

  await getDbPool().execute<ResultSetHeader>(
    `UPDATE solution_media_items
     SET sort_order = :sortOrder,
         is_enabled = :isEnabled,
         updated_at = :updatedAt
     WHERE id = :itemId
       AND deleted_at IS NULL`,
    {
      itemId,
      sortOrder,
      isEnabled: item.enabled ? 1 : 0,
      updatedAt: toMysqlDateTime(group.updatedAt),
    },
  );
}

async function tombstoneSolutionMediaItem(
  groupId: number,
  sceneSlug: SolutionSceneSlug,
  group: SolutionGroup,
  item: SolutionItem,
) {
  const { sourceId, mediaUrl, sortOrder } = itemStableKeys(item);
  const itemId = await findSolutionMediaItemId(groupId, item, { includeDeleted: false });

  if (!itemId) {
    warnShadowSkipped('solution-media-item-row-missing', undefined, {
      operation: 'delete-item',
      sceneSlug,
      groupSourceId: group.id,
      sourceId,
      mediaUrl,
      sortOrder,
    });
    return;
  }

  await getDbPool().execute<ResultSetHeader>(
    `UPDATE solution_media_items
     SET deleted_at = NOW(),
         updated_at = NOW()
     WHERE id = :itemId
       AND deleted_at IS NULL`,
    { itemId },
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

async function withSolutionGroupId(
  solutionId: number,
  sceneSlug: SolutionSceneSlug,
  groupId: string,
  sceneAfterWrite: SolutionScene,
  operation: ShadowOperation,
  task: (groupId: number, group: SolutionGroup) => Promise<void>,
) {
  const group = findGroupAfterWrite(sceneAfterWrite, groupId);
  if (!group) {
    warnShadowSkipped('solution-group-json-row-missing', undefined, {
      operation,
      sceneSlug,
      groupId,
    });
    await updateSceneRawJson(solutionId, sceneAfterWrite);
    return;
  }

  const solutionGroupId = await findSolutionGroupId(solutionId, group, { includeDeleted: false });
  if (!solutionGroupId) {
    warnShadowSkipped('solution-group-row-missing', undefined, {
      operation,
      sceneSlug,
      groupId,
      groupSlug: group.slug,
    });
    await updateSceneRawJson(solutionId, sceneAfterWrite);
    return;
  }

  await task(solutionGroupId, group);
  await updateSolutionGroupUpdatedAt(solutionGroupId, group);
  await updateSceneRawJson(solutionId, sceneAfterWrite);
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

export async function shadowAddSolutionItem(
  sceneSlug: SolutionSceneSlug,
  groupId: string,
  item: SolutionItem,
  sceneAfterWrite: SolutionScene,
) {
  await withSolutionId(sceneSlug, 'add-item', async (solutionId) => {
    await withSolutionGroupId(solutionId, sceneSlug, groupId, sceneAfterWrite, 'add-item', async (
      solutionGroupId,
      group,
    ) => {
      await upsertSolutionMediaItem(solutionGroupId, sceneSlug, group, item, 'add-item');
    });
  });
}

export async function shadowUpdateSolutionItem(
  sceneSlug: SolutionSceneSlug,
  groupId: string,
  item: SolutionItem,
  sceneAfterWrite: SolutionScene,
) {
  await withSolutionId(sceneSlug, 'update-item', async (solutionId) => {
    await withSolutionGroupId(solutionId, sceneSlug, groupId, sceneAfterWrite, 'update-item', async (
      solutionGroupId,
      group,
    ) => {
      await upsertSolutionMediaItem(solutionGroupId, sceneSlug, group, item, 'update-item');
    });
  });
}

export async function shadowReorderSolutionItems(
  sceneSlug: SolutionSceneSlug,
  groupId: string,
  items: SolutionItem[],
  sceneAfterWrite: SolutionScene,
) {
  await withSolutionId(sceneSlug, 'reorder-items', async (solutionId) => {
    await withSolutionGroupId(solutionId, sceneSlug, groupId, sceneAfterWrite, 'reorder-items', async (
      solutionGroupId,
      group,
    ) => {
      if (sceneSlug === 'video-digital-assets' && group.items.length > 1) {
        warnShadowSkipped('video-solution-group-has-multiple-json-items', undefined, {
          operation: 'reorder-items',
          sceneSlug,
          groupSourceId: group.id,
          itemCount: group.items.length,
        });
        return;
      }

      for (const item of items) {
        await updateSolutionMediaItemOrder(solutionGroupId, sceneSlug, group, item);
      }
    });
  });
}

export async function shadowDeleteSolutionItem(
  sceneSlug: SolutionSceneSlug,
  groupId: string,
  deletedItem: SolutionItem,
  sceneAfterWrite: SolutionScene,
) {
  await withSolutionId(sceneSlug, 'delete-item', async (solutionId) => {
    await withSolutionGroupId(solutionId, sceneSlug, groupId, sceneAfterWrite, 'delete-item', async (
      solutionGroupId,
      group,
    ) => {
      await tombstoneSolutionMediaItem(solutionGroupId, sceneSlug, group, deletedItem);
    });
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
