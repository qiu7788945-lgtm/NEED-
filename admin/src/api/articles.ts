import type { Article, ArticleCategory, ArticleInput, ArticleStatus } from '../../../shared/types/article';
import { deleteJson, getJson, patchJson, postJson } from './client';

const friendlyErrorMessages: Record<string, string> = {
  ARTICLE_NOT_FOUND: '没有找到这篇文章，可能已经被删除。',
  ARTICLE_TITLE_REQUIRED: '请先填写文章标题。',
  INVALID_ARTICLE_REORDER: '排序数据格式不正确。',
};

const errorOptions = {
  friendlyErrorMessages,
  fallbackMessage: '操作失败，请稍后再试。',
};

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
  return getJson<Article[]>(`/api/articles${query ? `?${query}` : ''}`, errorOptions);
}

export async function getArticle(id: string) {
  return getJson<Article>(`/api/articles/${encodeURIComponent(id)}`, errorOptions);
}

export async function createArticle(input: ArticleInput) {
  return postJson<Article>('/api/articles', input, errorOptions);
}

export async function updateArticle(id: string, input: ArticleInput) {
  return patchJson<Article>(`/api/articles/${encodeURIComponent(id)}`, input, errorOptions);
}

export async function deleteArticle(id: string) {
  return deleteJson<{ id: string }>(`/api/articles/${encodeURIComponent(id)}`, undefined, errorOptions);
}

export async function updateArticleStatus(id: string, status: ArticleStatus) {
  return patchJson<Article>(`/api/articles/${encodeURIComponent(id)}/status`, { status }, errorOptions);
}

export async function reorderArticles(items: Array<{ id: string; sortOrder: number }>) {
  return patchJson<Article[]>('/api/articles/reorder', { items }, errorOptions);
}
