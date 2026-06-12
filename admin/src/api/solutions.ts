import type { SolutionGroup, SolutionGroupInput, SolutionItem, SolutionItemInput, SolutionScene } from '../../../shared/types/solution';
import { deleteJson, getJson, patchJson, postJson } from './client';

const friendlyErrorMessages: Record<string, string> = {
  SOLUTION_SCENE_NOT_FOUND: '没有找到这个场景。',
  SOLUTION_GROUP_NOT_FOUND: '没有找到这个案例组。',
  SOLUTION_GROUP_TITLE_REQUIRED: '请先填写案例组标题。',
  SOLUTION_ITEM_NOT_FOUND: '没有找到这个素材。',
  SOLUTION_ITEM_LIMIT: '当前案例组素材数量已达上限，请先删除后再上传。',
  INVALID_SOLUTION_ITEM_TYPE: '素材类型不符合当前场景规则。',
  INVALID_SOLUTION_REORDER: '排序数据格式不正确。',
};

const errorOptions = {
  friendlyErrorMessages,
  fallbackMessage: '操作失败，请稍后再试。',
};

export async function listSolutions() {
  return getJson<SolutionScene[]>('/api/solutions', errorOptions);
}

export async function createSolutionGroup(sceneSlug: string, input: SolutionGroupInput) {
  return postJson<SolutionGroup>(`/api/solutions/${encodeURIComponent(sceneSlug)}/groups`, input, errorOptions);
}

export async function updateSolutionGroup(sceneSlug: string, groupId: string, input: SolutionGroupInput) {
  return patchJson<SolutionGroup>(`/api/solutions/${encodeURIComponent(sceneSlug)}/groups/${encodeURIComponent(groupId)}`, input, errorOptions);
}

export async function deleteSolutionGroup(sceneSlug: string, groupId: string) {
  return deleteJson<{ id: string }>(`/api/solutions/${encodeURIComponent(sceneSlug)}/groups/${encodeURIComponent(groupId)}`, undefined, errorOptions);
}

export async function reorderSolutionGroups(sceneSlug: string, items: Array<{ id: string; sortOrder: number }>) {
  return patchJson<SolutionGroup[]>(`/api/solutions/${encodeURIComponent(sceneSlug)}/groups/reorder`, { items }, errorOptions);
}

export async function addSolutionItem(sceneSlug: string, groupId: string, input: SolutionItemInput) {
  return postJson<SolutionItem>(`/api/solutions/${encodeURIComponent(sceneSlug)}/groups/${encodeURIComponent(groupId)}/items`, input, errorOptions);
}

export async function updateSolutionItem(sceneSlug: string, groupId: string, itemId: string, input: SolutionItemInput) {
  return patchJson<SolutionItem>(`/api/solutions/${encodeURIComponent(sceneSlug)}/groups/${encodeURIComponent(groupId)}/items/${encodeURIComponent(itemId)}`, input, errorOptions);
}

export async function deleteSolutionItem(sceneSlug: string, groupId: string, itemId: string) {
  return deleteJson<{ id: string }>(`/api/solutions/${encodeURIComponent(sceneSlug)}/groups/${encodeURIComponent(groupId)}/items/${encodeURIComponent(itemId)}`, undefined, errorOptions);
}

export async function reorderSolutionItems(sceneSlug: string, groupId: string, items: Array<{ id: string; sortOrder: number }>) {
  return patchJson<SolutionItem[]>(`/api/solutions/${encodeURIComponent(sceneSlug)}/groups/${encodeURIComponent(groupId)}/items/reorder`, { items }, errorOptions);
}
