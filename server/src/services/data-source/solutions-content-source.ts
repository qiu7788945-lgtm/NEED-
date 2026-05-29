import type { RowDataPacket } from 'mysql2/promise';
import type {
  SolutionGroup,
  SolutionItem,
  SolutionItemFileType,
  SolutionScene,
  SolutionSceneSlug,
} from '../../../../shared/types/solution.js';
import { getDbPool, getSafeDatabaseConfig } from '../../db/client.js';
import { logger } from '../../utils/logger.js';

type JsonFallback = () => Promise<SolutionScene[]>;
type SolutionsNormalizer = (value: unknown) => SolutionScene[];
type UnknownRecord = Record<string, unknown>;

type SolutionRow = RowDataPacket & {
  mysql_id: unknown;
  source_id: unknown;
  title: unknown;
  slug: unknown;
  summary: unknown;
  raw_json: unknown;
  status: unknown;
  sort_order: unknown;
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

const sceneSlugs = new Set<SolutionSceneSlug>([
  'family-day',
  'client-appreciation',
  'annual-meeting',
  'commercial-display',
  'video-digital-assets',
  'academic-forum',
  'other',
]);
const warnedFallbacks = new Set<string>();

function warnFallbackOnce(reason: string, message: string, meta?: UnknownRecord) {
  const key = `solutions:${reason}`;
  if (warnedFallbacks.has(key)) {
    return;
  }

  warnedFallbacks.add(key);
  logger.warn(message, {
    moduleName: 'solutions',
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
      'Solutions source is falling back to JSON because MySQL config is invalid.',
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

function asMysqlBoolean(value: unknown, fallback = true) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'enabled', 'active', 'published'].includes(normalized)) {
      return true;
    }
    if (['0', 'false', 'no', 'disabled', 'inactive', 'draft', 'archived', 'offline'].includes(normalized)) {
      return false;
    }
  }

  return fallback;
}

function statusToEnabled(value: unknown, fallback = true) {
  const status = asString(value).toLowerCase();
  if (!status) {
    return fallback;
  }

  return asMysqlBoolean(status, fallback);
}

function inferFileType(fileType: unknown, mediaUrl: string): SolutionItemFileType {
  if (asString(fileType).toLowerCase() === 'video') {
    return 'video';
  }

  if (/\.(mp4|webm)(\?|#|$)/i.test(mediaUrl)) {
    return 'video';
  }

  return 'image';
}

function asSceneSlug(value: unknown): SolutionSceneSlug | null {
  const slug = asString(value);
  return sceneSlugs.has(slug as SolutionSceneSlug) ? slug as SolutionSceneSlug : null;
}

function groupItemsByGroupId(rows: SolutionMediaItemRow[]) {
  const itemsByGroupId = new Map<number, SolutionItem[]>();

  for (const [index, row] of rows.entries()) {
    const groupId = Number(row.group_id);
    if (!Number.isInteger(groupId) || groupId <= 0) {
      throw new Error('Solution media item is missing a valid group id.');
    }

    const sourceId = asString(row.source_id);
    const mediaUrl = asString(row.media_url);
    if (!sourceId || !mediaUrl) {
      throw new Error('Solution media item is missing source_id or media_url.');
    }

    const item: SolutionItem = {
      id: sourceId,
      fileType: inferFileType(row.file_type, mediaUrl),
      mediaUrl,
      mediaFileName: asString(row.media_file_name),
      mediaDisplayName: asString(row.media_display_name),
      alt: asString(row.alt_text),
      caption: asString(row.caption),
      sortOrder: asNumber(row.sort_order, index + 1),
      enabled: asMysqlBoolean(row.is_enabled, true),
      createdAt: asDateTimeString(row.created_at),
    };

    const currentItems = itemsByGroupId.get(groupId) ?? [];
    currentItems.push(item);
    itemsByGroupId.set(groupId, currentItems);
  }

  for (const items of itemsByGroupId.values()) {
    items.sort((left, right) => left.sortOrder - right.sortOrder);
  }

  return itemsByGroupId;
}

function groupGroupsBySolutionId(rows: SolutionGroupRow[], mediaRows: SolutionMediaItemRow[]) {
  const itemsByGroupId = groupItemsByGroupId(mediaRows);
  const groupsBySolutionId = new Map<number, SolutionGroup[]>();

  for (const [index, row] of rows.entries()) {
    const solutionId = Number(row.solution_id);
    const mysqlId = Number(row.mysql_id);
    if (!Number.isInteger(solutionId) || solutionId <= 0 || !Number.isInteger(mysqlId) || mysqlId <= 0) {
      throw new Error('Solution group is missing a valid MySQL id.');
    }

    const sourceId = asString(row.source_id);
    const title = asString(row.title);
    const slug = asString(row.slug);
    const sceneSlug = asSceneSlug(row.scene_slug);

    if (!sourceId || !title || !slug || !sceneSlug) {
      throw new Error('Solution group is missing a required field.');
    }

    const group: SolutionGroup = {
      id: sourceId,
      title,
      slug,
      summary: asString(row.summary),
      sceneSlug,
      sortOrder: asNumber(row.sort_order, index + 1),
      enabled: asMysqlBoolean(row.is_enabled, true),
      items: itemsByGroupId.get(mysqlId) ?? [],
      createdAt: asDateTimeString(row.created_at),
      updatedAt: asDateTimeString(row.updated_at),
    };

    const currentGroups = groupsBySolutionId.get(solutionId) ?? [];
    currentGroups.push(group);
    groupsBySolutionId.set(solutionId, currentGroups);
  }

  for (const groups of groupsBySolutionId.values()) {
    groups.sort((left, right) => left.sortOrder - right.sortOrder);
  }

  return groupsBySolutionId;
}

function validateScenes(scenes: SolutionScene[]) {
  if (scenes.length !== sceneSlugs.size) {
    throw new Error('MySQL solutions scene count does not match the fixed scene list.');
  }

  for (const slug of sceneSlugs) {
    if (!scenes.some((scene) => scene.slug === slug)) {
      throw new Error(`MySQL solutions is missing scene "${slug}".`);
    }
  }

  const videoScene = scenes.find((scene) => scene.slug === 'video-digital-assets');
  if (!videoScene || videoScene.groups.some((group) => group.items.length > 1)) {
    throw new Error('MySQL video-digital-assets structure does not match the one-item group rule.');
  }

  for (const scene of scenes) {
    if (scene.slug === 'video-digital-assets') {
      continue;
    }

    if (scene.groups.some((group) => group.items.some((item) => item.fileType !== 'image'))) {
      throw new Error('MySQL non-video solution scene contains a video media item.');
    }
  }
}

async function readSolutionsFromMysql() {
  const pool = getDbPool();
  const [solutionRows] = await pool.execute<SolutionRow[]>(
    `SELECT id AS mysql_id,
            source_id,
            title,
            slug,
            summary,
            raw_json,
            status,
            sort_order
     FROM solutions
     WHERE deleted_at IS NULL
     ORDER BY sort_order ASC, id ASC`,
  );

  if (solutionRows.length === 0) {
    return null;
  }

  const [groupRows] = await pool.execute<SolutionGroupRow[]>(
    `SELECT id AS mysql_id,
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

  if (groupRows.length === 0) {
    throw new Error('MySQL solution_groups returned no usable rows.');
  }

  const [mediaRows] = await pool.execute<SolutionMediaItemRow[]>(
    `SELECT group_id,
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

  if (mediaRows.length === 0) {
    throw new Error('MySQL solution_media_items returned no usable rows.');
  }

  const groupsBySolutionId = groupGroupsBySolutionId(groupRows, mediaRows);
  const scenes: SolutionScene[] = solutionRows.map((row, index) => {
    const mysqlId = Number(row.mysql_id);
    if (!Number.isInteger(mysqlId) || mysqlId <= 0) {
      throw new Error('Solution scene is missing a valid MySQL id.');
    }

    const rawJson = parseJsonColumn(row.raw_json);
    const rawScene = isRecord(rawJson) ? rawJson : {};
    const slug = asSceneSlug(row.slug || rawScene.slug);
    const name = asString(rawScene.name) || asString(row.title);

    if (!slug || !name) {
      throw new Error('Solution scene is missing slug or title.');
    }

    return {
      slug,
      name,
      description: asString(rawScene.description) || asString(row.summary),
      sortOrder: asNumber(row.sort_order, asNumber(rawScene.sortOrder, index + 1)),
      enabled: statusToEnabled(row.status, asMysqlBoolean(rawScene.enabled, true)),
      groups: groupsBySolutionId.get(mysqlId) ?? [],
    };
  });

  validateScenes(scenes);
  return scenes.sort((left, right) => left.sortOrder - right.sortOrder);
}

export async function readSolutionsWithMysqlFallback(
  readJson: JsonFallback,
  normalize: SolutionsNormalizer,
) {
  if (!canUseMysql()) {
    return readJson();
  }

  try {
    const mysqlSolutions = await readSolutionsFromMysql();
    if (mysqlSolutions === null) {
      warnFallbackOnce(
        'mysql-empty',
        'Solutions source is falling back to JSON because MySQL returned no usable solution rows.',
      );
      return readJson();
    }

    return normalize(mysqlSolutions);
  } catch (error) {
    warnFallbackOnce(
      'mysql-read-failed',
      'Solutions source is falling back to JSON because MySQL read failed.',
      { message: error instanceof Error ? error.message : String(error) },
    );
    return readJson();
  }
}
