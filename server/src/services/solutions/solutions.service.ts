import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  SolutionGroup,
  SolutionGroupInput,
  SolutionItem,
  SolutionItemFileType,
  SolutionItemInput,
  SolutionScene,
  SolutionSceneSlug,
} from '../../../../shared/types/solution.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const dataDir = path.join(serverRoot, 'data');
const solutionsPath = path.join(dataDir, 'solutions.json');
let solutionsQueue = Promise.resolve();

const defaultScenes: Array<Omit<SolutionScene, 'groups'>> = [
  { slug: 'family-day', name: '企业家庭日 / 开放日', description: '', sortOrder: 1, enabled: true },
  { slug: 'client-appreciation', name: '客户答谢 & 精品沙龙', description: '', sortOrder: 2, enabled: true },
  { slug: 'annual-meeting', name: '年会活动与企业文化', description: '', sortOrder: 3, enabled: true },
  { slug: 'commercial-display', name: '商业美陈与展览', description: '', sortOrder: 4, enabled: true },
  { slug: 'video-digital-assets', name: '视频与数字资产', description: '', sortOrder: 5, enabled: true },
  { slug: 'academic-forum', name: '学术与专业论坛', description: '', sortOrder: 6, enabled: true },
  { slug: 'other', name: '其他', description: '', sortOrder: 7, enabled: true },
];

const sceneSlugs = new Set<SolutionSceneSlug>(defaultScenes.map((scene) => scene.slug));

interface ReorderItem {
  id: string;
  sortOrder: number;
}

function createSolutionError(message: string, statusCode: number, code: string) {
  return Object.assign(new Error(message), {
    statusCode,
    code,
  });
}

function normalizeJsonText(text: string) {
  return text.replace(/^\uFEFF/, '').trim();
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNumber(value: unknown, fallback: number) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function normalizeBoolean(value: unknown, fallback = true) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeSlug(value: unknown, fallback: string) {
  const raw = normalizeText(value || fallback).toLowerCase();
  const slug = raw
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return slug || fallback;
}

function createUniqueSlug(groups: SolutionGroup[], slug: string, currentId?: string) {
  const baseSlug = normalizeSlug(slug, `group-${Date.now()}`);
  let nextSlug = baseSlug;
  let index = 2;

  while (groups.some((group) => group.id !== currentId && group.slug === nextSlug)) {
    nextSlug = `${baseSlug}-${index}`;
    index += 1;
  }

  return nextSlug;
}

function assertSceneSlug(sceneSlug: string): asserts sceneSlug is SolutionSceneSlug {
  if (!sceneSlugs.has(sceneSlug as SolutionSceneSlug)) {
    throw createSolutionError('没有找到这个场景。', 404, 'SOLUTION_SCENE_NOT_FOUND');
  }
}

function createDefaultScenes(): SolutionScene[] {
  return defaultScenes.map((scene) => ({
    ...scene,
    groups: [],
  }));
}

function normalizeFileType(value: unknown, fallback: SolutionItemFileType): SolutionItemFileType {
  return value === 'video' ? 'video' : fallback;
}

function inferFileTypeFromMediaPath(item: Partial<SolutionItem>): SolutionItemFileType | null {
  const source = `${normalizeText(item.mediaFileName)} ${normalizeText(item.mediaUrl)}`.toLowerCase();
  if (/\.(mp4|webm)(\?|#|$)/i.test(source)) {
    return 'video';
  }
  if (/\.(jpe?g|png|webp)(\?|#|$)/i.test(source)) {
    return 'image';
  }
  return null;
}

function normalizeItem(item: Partial<SolutionItem>, index: number, sceneSlug: SolutionSceneSlug): SolutionItem {
  const fileType = normalizeFileType(item.fileType, inferFileTypeFromMediaPath(item) ?? 'image');
  return {
    id: normalizeText(item.id) || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fileType,
    mediaUrl: normalizeText(item.mediaUrl),
    mediaFileName: normalizeText(item.mediaFileName),
    mediaDisplayName: normalizeText(item.mediaDisplayName),
    alt: normalizeText(item.alt),
    caption: normalizeText(item.caption),
    sortOrder: normalizeNumber(item.sortOrder, index + 1),
    enabled: normalizeBoolean(item.enabled, true),
    createdAt: normalizeText(item.createdAt) || new Date().toISOString(),
  };
}

function normalizeGroup(group: Partial<SolutionGroup>, sceneSlug: SolutionSceneSlug, index: number): SolutionGroup {
  const now = new Date().toISOString();
  const title = normalizeText(group.title) || '未命名案例组';
  return {
    id: normalizeText(group.id) || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    slug: normalizeSlug(group.slug || title, `group-${index + 1}`),
    summary: normalizeText(group.summary),
    sceneSlug,
    sortOrder: normalizeNumber(group.sortOrder, index + 1),
    enabled: normalizeBoolean(group.enabled, true),
    items: Array.isArray(group.items)
      ? group.items.map((item, itemIndex) => normalizeItem(item, itemIndex, sceneSlug))
        .sort((a, b) => a.sortOrder - b.sortOrder)
      : [],
    createdAt: normalizeText(group.createdAt) || now,
    updatedAt: normalizeText(group.updatedAt) || now,
  };
}

function normalizeScenes(value: unknown): SolutionScene[] {
  const inputScenes = Array.isArray(value) ? value as Partial<SolutionScene>[] : [];

  return defaultScenes.map((defaultScene) => {
    const existing = inputScenes.find((scene) => scene.slug === defaultScene.slug);
    return {
      ...defaultScene,
      description: normalizeText(existing?.description) || defaultScene.description,
      sortOrder: normalizeNumber(existing?.sortOrder, defaultScene.sortOrder),
      enabled: normalizeBoolean(existing?.enabled, defaultScene.enabled),
      groups: Array.isArray(existing?.groups)
        ? existing.groups.map((group, index) => normalizeGroup(group, defaultScene.slug, index))
          .sort((a, b) => a.sortOrder - b.sortOrder)
        : [],
    };
  }).sort((a, b) => a.sortOrder - b.sortOrder);
}

async function writeSolutions(scenes: SolutionScene[]) {
  await fs.mkdir(dataDir, { recursive: true });
  const tmpPath = `${solutionsPath}.${Date.now()}.${Math.random().toString(36).slice(2, 10)}.tmp`;
  await fs.writeFile(tmpPath, `${JSON.stringify(scenes, null, 2)}\n`, 'utf8');
  await fs.rename(tmpPath, solutionsPath);
}

function withSolutionsLock<T>(task: () => Promise<T>): Promise<T> {
  const run = solutionsQueue.then(task, task);
  solutionsQueue = run.then(() => undefined, () => undefined);
  return run;
}

async function readSolutions(): Promise<SolutionScene[]> {
  await fs.mkdir(dataDir, { recursive: true });

  try {
    const raw = normalizeJsonText(await fs.readFile(solutionsPath, 'utf8'));
    if (!raw) {
      return createDefaultScenes();
    }

    return normalizeScenes(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      const scenes = createDefaultScenes();
      await writeSolutions(scenes);
      return scenes;
    }

    if (error instanceof SyntaxError) {
      return createDefaultScenes();
    }

    throw error;
  }
}

async function updateSolutions(updater: (scenes: SolutionScene[]) => SolutionScene[] | Promise<SolutionScene[]>) {
  return withSolutionsLock(async () => {
    const scenes = await readSolutions();
    const nextScenes = normalizeScenes(await updater(scenes));
    await writeSolutions(nextScenes);
    return nextScenes;
  });
}

function getSceneFromList(scenes: SolutionScene[], sceneSlug: SolutionSceneSlug) {
  const scene = scenes.find((item) => item.slug === sceneSlug);
  if (!scene) {
    throw createSolutionError('没有找到这个场景。', 404, 'SOLUTION_SCENE_NOT_FOUND');
  }
  return scene;
}

function assertItemRules(sceneSlug: SolutionSceneSlug, group: SolutionGroup, item?: SolutionItemInput) {
  if (sceneSlug === 'video-digital-assets') {
    if (group.items.length >= 1) {
      throw createSolutionError('当前组已绑定 1 个素材，请先删除或替换。', 400, 'SOLUTION_ITEM_LIMIT');
    }
    if (item?.fileType !== 'image' && item?.fileType !== 'video') {
      throw createSolutionError('视频与数字资产只支持 1 个视频或 1 张主图。', 400, 'INVALID_SOLUTION_ITEM_TYPE');
    }
    return;
  }

  if (group.items.length >= 7) {
    throw createSolutionError('普通案例组最多 7 张图，可删除后再上传。', 400, 'SOLUTION_ITEM_LIMIT');
  }
  if (item?.fileType && item.fileType !== 'image') {
    throw createSolutionError('普通场景案例组只能上传图片。', 400, 'INVALID_SOLUTION_ITEM_TYPE');
  }
}

export async function listSolutions() {
  return readSolutions();
}

export async function getSolutionScene(sceneSlug: string) {
  assertSceneSlug(sceneSlug);
  return getSceneFromList(await readSolutions(), sceneSlug);
}

export async function createSolutionGroup(sceneSlug: string, input: SolutionGroupInput) {
  assertSceneSlug(sceneSlug);
  const now = new Date().toISOString();
  let createdGroupId = '';
  const scenes = await updateSolutions((currentScenes) => currentScenes.map((scene) => {
    if (scene.slug !== sceneSlug) {
      return scene;
    }
    const title = normalizeText(input.title) || '未命名案例组';
    const group: SolutionGroup = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      slug: createUniqueSlug(scene.groups, input.slug || title),
      summary: normalizeText(input.summary),
      sceneSlug,
      sortOrder: normalizeNumber(input.sortOrder, scene.groups.length + 1),
      enabled: normalizeBoolean(input.enabled, true),
      items: [],
      createdAt: now,
      updatedAt: now,
    };
    createdGroupId = group.id;
    return {
      ...scene,
      groups: [...scene.groups, group],
    };
  }));
  const createdGroup = getSceneFromList(scenes, sceneSlug).groups.find((group) => group.id === createdGroupId);
  if (!createdGroup) {
    throw createSolutionError('案例组创建失败。', 500, 'SOLUTION_GROUP_CREATE_FAILED');
  }
  return createdGroup;
}

export async function updateSolutionGroup(sceneSlug: string, groupId: string, input: SolutionGroupInput) {
  assertSceneSlug(sceneSlug);
  let updatedGroup: SolutionGroup | undefined;
  await updateSolutions((scenes) => scenes.map((scene) => {
    if (scene.slug !== sceneSlug) {
      return scene;
    }
    return {
      ...scene,
      groups: scene.groups.map((group) => {
        if (group.id !== groupId) {
          return group;
        }
        const title = input.title === undefined ? group.title : normalizeText(input.title);
        if (!title) {
          throw createSolutionError('案例组标题不能为空。', 400, 'SOLUTION_GROUP_TITLE_REQUIRED');
        }
        updatedGroup = {
          ...group,
          title,
          slug: input.slug === undefined ? group.slug : createUniqueSlug(scene.groups, input.slug || title, group.id),
          summary: input.summary === undefined ? group.summary : normalizeText(input.summary),
          sortOrder: input.sortOrder === undefined ? group.sortOrder : normalizeNumber(input.sortOrder, group.sortOrder),
          enabled: input.enabled === undefined ? group.enabled : normalizeBoolean(input.enabled, group.enabled),
          updatedAt: new Date().toISOString(),
        };
        return updatedGroup;
      }),
    };
  }));

  if (!updatedGroup) {
    throw createSolutionError('没有找到这个案例组。', 404, 'SOLUTION_GROUP_NOT_FOUND');
  }

  return updatedGroup;
}

export async function deleteSolutionGroup(sceneSlug: string, groupId: string) {
  assertSceneSlug(sceneSlug);
  let deleted = false;
  await updateSolutions((scenes) => scenes.map((scene) => {
    if (scene.slug !== sceneSlug) {
      return scene;
    }
    deleted = scene.groups.some((group) => group.id === groupId);
    return {
      ...scene,
      groups: scene.groups.filter((group) => group.id !== groupId),
    };
  }));

  if (!deleted) {
    throw createSolutionError('没有找到这个案例组。', 404, 'SOLUTION_GROUP_NOT_FOUND');
  }

  return { id: groupId };
}

export async function reorderSolutionGroups(sceneSlug: string, items: ReorderItem[]) {
  assertSceneSlug(sceneSlug);
  if (!Array.isArray(items)) {
    throw createSolutionError('排序数据格式不正确。', 400, 'INVALID_SOLUTION_REORDER');
  }
  const sortOrderById = new Map(items.map((item) => [item.id, normalizeNumber(item.sortOrder, 0)]));
  const scenes = await updateSolutions((currentScenes) => currentScenes.map((scene) => (
    scene.slug === sceneSlug
      ? {
        ...scene,
        groups: scene.groups.map((group) => (
          sortOrderById.has(group.id)
            ? { ...group, sortOrder: sortOrderById.get(group.id) ?? group.sortOrder, updatedAt: new Date().toISOString() }
            : group
        )),
      }
      : scene
  )));
  return getSceneFromList(scenes, sceneSlug).groups;
}

export async function addSolutionItem(sceneSlug: string, groupId: string, input: SolutionItemInput) {
  assertSceneSlug(sceneSlug);
  let createdItem: SolutionItem | undefined;
  await updateSolutions((scenes) => scenes.map((scene) => {
    if (scene.slug !== sceneSlug) {
      return scene;
    }
    return {
      ...scene,
      groups: scene.groups.map((group) => {
        if (group.id !== groupId) {
          return group;
        }
        assertItemRules(sceneSlug, group, input);
        const sortOrder = normalizeNumber(input.sortOrder, group.items.length + 1);
        const fileType = sceneSlug === 'video-digital-assets' ? normalizeFileType(input.fileType, 'image') : 'image';
        createdItem = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          fileType,
          mediaUrl: normalizeText(input.mediaUrl),
          mediaFileName: normalizeText(input.mediaFileName),
          mediaDisplayName: normalizeText(input.mediaDisplayName),
          alt: normalizeText(input.alt),
          caption: normalizeText(input.caption),
          sortOrder,
          enabled: normalizeBoolean(input.enabled, true),
          createdAt: new Date().toISOString(),
        };
        return {
          ...group,
          items: [...group.items, createdItem],
          updatedAt: new Date().toISOString(),
        };
      }),
    };
  }));

  if (!createdItem) {
    throw createSolutionError('没有找到这个案例组。', 404, 'SOLUTION_GROUP_NOT_FOUND');
  }

  return createdItem;
}

export async function updateSolutionItem(sceneSlug: string, groupId: string, itemId: string, input: SolutionItemInput) {
  assertSceneSlug(sceneSlug);
  let updatedItem: SolutionItem | undefined;
  await updateSolutions((scenes) => scenes.map((scene) => {
    if (scene.slug !== sceneSlug) {
      return scene;
    }
    return {
      ...scene,
      groups: scene.groups.map((group) => {
        if (group.id !== groupId) {
          return group;
        }
        return {
          ...group,
          items: group.items.map((item) => {
            if (item.id !== itemId) {
              return item;
            }
            updatedItem = {
              ...item,
              alt: input.alt === undefined ? item.alt : normalizeText(input.alt),
              caption: input.caption === undefined ? item.caption : normalizeText(input.caption),
              sortOrder: input.sortOrder === undefined ? item.sortOrder : normalizeNumber(input.sortOrder, item.sortOrder),
              enabled: input.enabled === undefined ? item.enabled : normalizeBoolean(input.enabled, item.enabled),
            };
            return updatedItem;
          }),
          updatedAt: new Date().toISOString(),
        };
      }),
    };
  }));

  if (!updatedItem) {
    throw createSolutionError('没有找到这个素材。', 404, 'SOLUTION_ITEM_NOT_FOUND');
  }

  return updatedItem;
}

export async function deleteSolutionItem(sceneSlug: string, groupId: string, itemId: string) {
  assertSceneSlug(sceneSlug);
  let deleted = false;
  await updateSolutions((scenes) => scenes.map((scene) => {
    if (scene.slug !== sceneSlug) {
      return scene;
    }
    return {
      ...scene,
      groups: scene.groups.map((group) => {
        if (group.id !== groupId) {
          return group;
        }
        deleted = group.items.some((item) => item.id === itemId);
        return {
          ...group,
          items: group.items.filter((item) => item.id !== itemId),
          updatedAt: new Date().toISOString(),
        };
      }),
    };
  }));

  if (!deleted) {
    throw createSolutionError('没有找到这个素材。', 404, 'SOLUTION_ITEM_NOT_FOUND');
  }

  return { id: itemId };
}

export async function reorderSolutionItems(sceneSlug: string, groupId: string, items: ReorderItem[]) {
  assertSceneSlug(sceneSlug);
  if (!Array.isArray(items)) {
    throw createSolutionError('排序数据格式不正确。', 400, 'INVALID_SOLUTION_REORDER');
  }
  const sortOrderById = new Map(items.map((item) => [item.id, normalizeNumber(item.sortOrder, 0)]));
  let nextItems: SolutionItem[] | undefined;
  await updateSolutions((scenes) => scenes.map((scene) => {
    if (scene.slug !== sceneSlug) {
      return scene;
    }
    return {
      ...scene,
      groups: scene.groups.map((group) => {
        if (group.id !== groupId) {
          return group;
        }
        nextItems = group.items.map((item) => (
          sortOrderById.has(item.id)
            ? { ...item, sortOrder: sortOrderById.get(item.id) ?? item.sortOrder }
            : item
        ));
        return {
          ...group,
          items: nextItems,
          updatedAt: new Date().toISOString(),
        };
      }),
    };
  }));

  if (!nextItems) {
    throw createSolutionError('没有找到这个案例组。', 404, 'SOLUTION_GROUP_NOT_FOUND');
  }

  return nextItems;
}
