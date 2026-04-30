import type { SolutionGroup, SolutionGroupInput, SolutionItem, SolutionItemInput, SolutionScene } from '../../../shared/types/solution';

const apiBaseUrl = 'http://localhost:4000';

interface ApiResponse<TData> {
  ok: boolean;
  message: string;
  data?: TData;
  code?: string;
}

const friendlyErrorMessages: Record<string, string> = {
  SOLUTION_SCENE_NOT_FOUND: '没有找到这个场景。',
  SOLUTION_GROUP_NOT_FOUND: '没有找到这个案例组。',
  SOLUTION_GROUP_TITLE_REQUIRED: '请先填写案例组标题。',
  SOLUTION_ITEM_NOT_FOUND: '没有找到这个素材。',
  SOLUTION_ITEM_LIMIT: '当前案例组素材数量已达上限，请先删除后再上传。',
  INVALID_SOLUTION_ITEM_TYPE: '素材类型不符合当前场景规则。',
  INVALID_SOLUTION_REORDER: '排序数据格式不正确。',
};

async function readJson<TData>(response: Response): Promise<TData> {
  const body = await response.json() as ApiResponse<TData>;

  if (!response.ok || !body.ok || !body.data) {
    throw new Error((body.code ? friendlyErrorMessages[body.code] : '') || body.message || '操作失败，请稍后再试。');
  }

  return body.data;
}

export async function listSolutions() {
  return readJson<SolutionScene[]>(await fetch(`${apiBaseUrl}/api/solutions`));
}

export async function createSolutionGroup(sceneSlug: string, input: SolutionGroupInput) {
  return readJson<SolutionGroup>(await fetch(`${apiBaseUrl}/api/solutions/${encodeURIComponent(sceneSlug)}/groups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }));
}

export async function updateSolutionGroup(sceneSlug: string, groupId: string, input: SolutionGroupInput) {
  return readJson<SolutionGroup>(await fetch(`${apiBaseUrl}/api/solutions/${encodeURIComponent(sceneSlug)}/groups/${encodeURIComponent(groupId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }));
}

export async function deleteSolutionGroup(sceneSlug: string, groupId: string) {
  return readJson<{ id: string }>(await fetch(`${apiBaseUrl}/api/solutions/${encodeURIComponent(sceneSlug)}/groups/${encodeURIComponent(groupId)}`, {
    method: 'DELETE',
  }));
}

export async function reorderSolutionGroups(sceneSlug: string, items: Array<{ id: string; sortOrder: number }>) {
  return readJson<SolutionGroup[]>(await fetch(`${apiBaseUrl}/api/solutions/${encodeURIComponent(sceneSlug)}/groups/reorder`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  }));
}

export async function addSolutionItem(sceneSlug: string, groupId: string, input: SolutionItemInput) {
  return readJson<SolutionItem>(await fetch(`${apiBaseUrl}/api/solutions/${encodeURIComponent(sceneSlug)}/groups/${encodeURIComponent(groupId)}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }));
}

export async function updateSolutionItem(sceneSlug: string, groupId: string, itemId: string, input: SolutionItemInput) {
  return readJson<SolutionItem>(await fetch(`${apiBaseUrl}/api/solutions/${encodeURIComponent(sceneSlug)}/groups/${encodeURIComponent(groupId)}/items/${encodeURIComponent(itemId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }));
}

export async function deleteSolutionItem(sceneSlug: string, groupId: string, itemId: string) {
  return readJson<{ id: string }>(await fetch(`${apiBaseUrl}/api/solutions/${encodeURIComponent(sceneSlug)}/groups/${encodeURIComponent(groupId)}/items/${encodeURIComponent(itemId)}`, {
    method: 'DELETE',
  }));
}

export async function reorderSolutionItems(sceneSlug: string, groupId: string, items: Array<{ id: string; sortOrder: number }>) {
  return readJson<SolutionItem[]>(await fetch(`${apiBaseUrl}/api/solutions/${encodeURIComponent(sceneSlug)}/groups/${encodeURIComponent(groupId)}/items/reorder`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  }));
}
