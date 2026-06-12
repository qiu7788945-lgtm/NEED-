import type { CaseInput, CaseStatus, CaseStudy } from '../../../shared/types/case';
import { deleteJson, getJson, patchJson, postJson } from './client';

const friendlyErrorMessages: Record<string, string> = {
  CASE_NOT_FOUND: '没有找到这个案例，可能已经被删除。',
  CASE_TITLE_REQUIRED: '请先填写案例标题。',
  INVALID_CASE_REORDER: '排序数据格式不正确。',
  INVALID_WORD_TYPE: '只支持上传 .docx Word 文件，不支持 .doc 或 PDF。',
  WORD_FILE_REQUIRED: '请上传 .docx Word 文件。',
  LIMIT_FILE_SIZE: 'Word 文件太大，默认最大 30MB。',
};

const errorOptions = {
  friendlyErrorMessages,
  fallbackMessage: '操作失败，请稍后再试。',
};

export interface CaseListParams {
  status?: CaseStatus | '';
  keyword?: string;
}

export async function listCases(params: CaseListParams = {}) {
  const searchParams = new URLSearchParams();
  if (params.status) {
    searchParams.set('status', params.status);
  }
  if (params.keyword) {
    searchParams.set('keyword', params.keyword);
  }

  const query = searchParams.toString();
  return getJson<CaseStudy[]>(`/api/cases${query ? `?${query}` : ''}`, errorOptions);
}

export async function createCase(input: CaseInput) {
  return postJson<CaseStudy>('/api/cases', input, errorOptions);
}

export async function updateCase(id: string, input: CaseInput) {
  return patchJson<CaseStudy>(`/api/cases/${encodeURIComponent(id)}`, input, errorOptions);
}

export async function deleteCase(id: string) {
  return deleteJson<{ id: string }>(`/api/cases/${encodeURIComponent(id)}`, undefined, errorOptions);
}

export async function updateCaseStatus(id: string, status: CaseStatus) {
  return patchJson<CaseStudy>(`/api/cases/${encodeURIComponent(id)}/status`, { status }, errorOptions);
}

export async function reorderCases(items: Array<{ id: string; sortOrder: number }>) {
  return patchJson<CaseStudy[]>('/api/cases/reorder', { items }, errorOptions);
}

export async function importCaseWord(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  return postJson<CaseStudy>('/api/cases/import-word', formData, errorOptions);
}
