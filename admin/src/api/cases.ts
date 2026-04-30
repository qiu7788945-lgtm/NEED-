import type { CaseInput, CaseStatus, CaseStudy } from '../../../shared/types/case';

const apiBaseUrl = 'http://localhost:4000';

interface ApiResponse<TData> {
  ok: boolean;
  message: string;
  data?: TData;
  code?: string;
}

const friendlyErrorMessages: Record<string, string> = {
  CASE_NOT_FOUND: '没有找到这个案例，可能已经被删除。',
  CASE_TITLE_REQUIRED: '请先填写案例标题。',
  INVALID_CASE_REORDER: '排序数据格式不正确。',
  INVALID_WORD_TYPE: '只支持上传 .docx Word 文件，不支持 .doc 或 PDF。',
  WORD_FILE_REQUIRED: '请上传 .docx Word 文件。',
  LIMIT_FILE_SIZE: 'Word 文件太大，默认最大 30MB。',
};

async function readJson<TData>(response: Response): Promise<TData> {
  const body = await response.json() as ApiResponse<TData>;

  if (!response.ok || !body.ok || !body.data) {
    throw new Error((body.code ? friendlyErrorMessages[body.code] : '') || body.message || '操作失败，请稍后再试。');
  }

  return body.data;
}

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
  return readJson<CaseStudy[]>(await fetch(`${apiBaseUrl}/api/cases${query ? `?${query}` : ''}`));
}

export async function createCase(input: CaseInput) {
  return readJson<CaseStudy>(await fetch(`${apiBaseUrl}/api/cases`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  }));
}

export async function updateCase(id: string, input: CaseInput) {
  return readJson<CaseStudy>(await fetch(`${apiBaseUrl}/api/cases/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  }));
}

export async function deleteCase(id: string) {
  return readJson<{ id: string }>(await fetch(`${apiBaseUrl}/api/cases/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }));
}

export async function updateCaseStatus(id: string, status: CaseStatus) {
  return readJson<CaseStudy>(await fetch(`${apiBaseUrl}/api/cases/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status }),
  }));
}

export async function reorderCases(items: Array<{ id: string; sortOrder: number }>) {
  return readJson<CaseStudy[]>(await fetch(`${apiBaseUrl}/api/cases/reorder`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ items }),
  }));
}

export async function importCaseWord(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  return readJson<CaseStudy>(await fetch(`${apiBaseUrl}/api/cases/import-word`, {
    method: 'POST',
    body: formData,
  }));
}
