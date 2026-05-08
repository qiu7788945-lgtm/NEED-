import type { Page, PageInput, PageStatus, PageType } from '../../../shared/types/pages';

const apiBaseUrl = 'http://localhost:4000';

interface ApiResponse<TData> {
  ok: boolean;
  message: string;
  data?: TData;
  code?: string;
}

const friendlyErrorMessages: Record<string, string> = {
  PAGE_NOT_FOUND: '没有找到这个页面，可能已经被删除。',
  PAGE_TITLE_REQUIRED: '请先填写页面标题。',
  INVALID_PAGE_REORDER: '排序数据格式不正确。',
};

async function readJson<TData>(response: Response): Promise<TData> {
  const body = await response.json() as ApiResponse<TData>;

  if (!response.ok || !body.ok || !body.data) {
    throw new Error((body.code ? friendlyErrorMessages[body.code] : '') || body.message || '页面接口请求失败，请稍后再试。');
  }

  return body.data;
}

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
  return readJson<Page[]>(await fetch(`${apiBaseUrl}/api/pages${query ? `?${query}` : ''}`));
}

export async function getPage(id: string) {
  return readJson<Page>(await fetch(`${apiBaseUrl}/api/pages/${encodeURIComponent(id)}`));
}

export async function createPage(input: PageInput) {
  return readJson<Page>(await fetch(`${apiBaseUrl}/api/pages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  }));
}

export async function updatePage(id: string, input: PageInput) {
  return readJson<Page>(await fetch(`${apiBaseUrl}/api/pages/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  }));
}

export async function updatePageStatus(id: string, status: PageStatus) {
  return readJson<Page>(await fetch(`${apiBaseUrl}/api/pages/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  }));
}

export async function deletePage(id: string) {
  return readJson<{ id: string }>(await fetch(`${apiBaseUrl}/api/pages/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }));
}

export async function duplicatePage(id: string) {
  return readJson<Page>(await fetch(`${apiBaseUrl}/api/pages/${encodeURIComponent(id)}/duplicate`, {
    method: 'POST',
  }));
}

export async function reorderPages(items: Array<{ id: string; sortOrder: number }>) {
  return readJson<Page[]>(await fetch(`${apiBaseUrl}/api/pages/reorder`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ items }),
  }));
}
