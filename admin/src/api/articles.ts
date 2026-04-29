import type { Article, ArticleCategory, ArticleInput, ArticleStatus } from '../../../shared/types/article';

const apiBaseUrl = 'http://localhost:4000';

interface ApiResponse<TData> {
  ok: boolean;
  message: string;
  data?: TData;
  code?: string;
}

const friendlyErrorMessages: Record<string, string> = {
  ARTICLE_NOT_FOUND: '没有找到这篇文章，可能已经被删除。',
  ARTICLE_TITLE_REQUIRED: '请先填写文章标题。',
  INVALID_ARTICLE_REORDER: '排序数据格式不正确。',
};

async function readJson<TData>(response: Response): Promise<TData> {
  const body = await response.json() as ApiResponse<TData>;

  if (!response.ok || !body.ok || !body.data) {
    throw new Error((body.code ? friendlyErrorMessages[body.code] : '') || body.message || '操作失败，请稍后再试。');
  }

  return body.data;
}

export interface ArticleListParams {
  category?: ArticleCategory | '';
  status?: ArticleStatus | '';
  keyword?: string;
}

export async function listArticles(params: ArticleListParams = {}) {
  const searchParams = new URLSearchParams();

  if (params.category) {
    searchParams.set('category', params.category);
  }
  if (params.status) {
    searchParams.set('status', params.status);
  }
  if (params.keyword) {
    searchParams.set('keyword', params.keyword);
  }

  const query = searchParams.toString();
  return readJson<Article[]>(await fetch(`${apiBaseUrl}/api/articles${query ? `?${query}` : ''}`));
}

export async function getArticle(id: string) {
  return readJson<Article>(await fetch(`${apiBaseUrl}/api/articles/${encodeURIComponent(id)}`));
}

export async function createArticle(input: ArticleInput) {
  return readJson<Article>(await fetch(`${apiBaseUrl}/api/articles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  }));
}

export async function updateArticle(id: string, input: ArticleInput) {
  return readJson<Article>(await fetch(`${apiBaseUrl}/api/articles/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  }));
}

export async function deleteArticle(id: string) {
  return readJson<{ id: string }>(await fetch(`${apiBaseUrl}/api/articles/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }));
}

export async function updateArticleStatus(id: string, status: ArticleStatus) {
  return readJson<Article>(await fetch(`${apiBaseUrl}/api/articles/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  }));
}

export async function reorderArticles(items: Array<{ id: string; sortOrder: number }>) {
  return readJson<Article[]>(await fetch(`${apiBaseUrl}/api/articles/reorder`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ items }),
  }));
}
