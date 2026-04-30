import type { CaseStatus } from '../../../shared/types/case';

export const caseStatuses: Array<{ value: CaseStatus | ''; label: string }> = [
  { value: '', label: '全部状态' },
  { value: 'draft', label: '草稿' },
  { value: 'published', label: '已上架' },
  { value: 'offline', label: '已下架' },
];

export function getCaseStatusLabel(value: string) {
  return caseStatuses.find((status) => status.value === value)?.label ?? value;
}
