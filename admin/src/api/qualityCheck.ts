import type { QualityCheckResult } from '../../../shared/types/quality-check';
import { getJson } from './client';

const errorOptions = {
  fallbackMessage: '内容健康检查失败，请稍后再试。',
};

export async function getQualityCheck() {
  return getJson<QualityCheckResult>('/api/quality-check', errorOptions);
}
