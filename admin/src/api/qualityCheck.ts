import type { QualityCheckResult } from '../../../shared/types/quality-check';

const apiBaseUrl = 'http://localhost:4000';

interface ApiResponse<TData> {
  ok: boolean;
  message: string;
  data?: TData;
  code?: string;
}

async function readJson<TData>(response: Response): Promise<TData> {
  const body = await response.json() as ApiResponse<TData>;

  if (!response.ok || !body.ok || !body.data) {
    throw new Error(body.message || '内容健康检查失败，请稍后再试。');
  }

  return body.data;
}

export async function getQualityCheck() {
  return readJson<QualityCheckResult>(await fetch(`${apiBaseUrl}/api/quality-check`));
}
