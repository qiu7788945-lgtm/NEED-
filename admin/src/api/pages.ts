import type { Page, PageInput, PageStatus, PageType } from '../../../shared/types/pages';
import { deleteJson, getJson, patchJson, postJson, putJson } from './client';

const friendlyErrorMessages: Record<string, string> = {
  PAGE_NOT_FOUND: '没有找到这个页面，可能已经被删除。',
  PAGE_TITLE_REQUIRED: '请先填写页面标题。',
  INVALID_PAGE_REORDER: '排序数据格式不正确。',
};

const errorOptions = {
  friendlyErrorMessages,
  fallbackMessage: '页面接口请求失败，请稍后再试。',
};

export interface PageListParams {
  pageType?: PageType | '';
  status?: PageStatus | '';
  keyword?: string;
}

export async function listPages(params: PageListParams = {}) {
  const searchParams = new URLSearchParams();

  if (params.pageType) {
    searchParams.set('pageType', params.pageType);
  }
  if (params.status) {
    searchParams.set('status', params.status);
  }
  if (params.keyword) {
    searchParams.set('keyword', params.keyword);
  }

  const query = searchParams.toString();
  return getJson<Page[]>(`/api/pages${query ? `?${query}` : ''}`, errorOptions);
}

export async function getPage(id: string) {
  return getJson<Page>(`/api/pages/${encodeURIComponent(id)}`, errorOptions);
}

export async function createPage(input: PageInput) {
  return postJson<Page>('/api/pages', input, errorOptions);
}

export async function updatePage(id: string, input: PageInput) {
  return putJson<Page>(`/api/pages/${encodeURIComponent(id)}`, input, errorOptions);
}

export async function updatePageStatus(id: string, status: PageStatus) {
  return patchJson<Page>(`/api/pages/${encodeURIComponent(id)}/status`, { status }, errorOptions);
}

export async function deletePage(id: string) {
  return deleteJson<{ id: string }>(`/api/pages/${encodeURIComponent(id)}`, undefined, errorOptions);
}

export async function duplicatePage(id: string) {
  return postJson<Page>(`/api/pages/${encodeURIComponent(id)}/duplicate`, undefined, errorOptions);
}

export async function reorderPages(items: Array<{ id: string; sortOrder: number }>) {
  return postJson<Page[]>('/api/pages/reorder', { items }, errorOptions);
}
