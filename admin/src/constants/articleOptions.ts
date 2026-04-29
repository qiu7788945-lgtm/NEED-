import type { ArticleCategory, ArticleStatus } from '../../../shared/types/article';

export const articleCategories: Array<{ value: ArticleCategory | ''; label: string }> = [
  { value: '', label: '全部栏目' },
  { value: 'how_to_choose', label: '怎么选活动公司' },
  { value: 'choose_between_two', label: '二选一怎么选' },
  { value: 'method_judgment', label: '方法与判断' },
];

export const articleStatuses: Array<{ value: ArticleStatus | ''; label: string }> = [
  { value: '', label: '全部状态' },
  { value: 'draft', label: '草稿' },
  { value: 'published', label: '已上架' },
  { value: 'offline', label: '已下架' },
];

export function getArticleCategoryLabel(value: string) {
  return articleCategories.find((category) => category.value === value)?.label ?? value;
}

export function getArticleStatusLabel(value: string) {
  return articleStatuses.find((status) => status.value === value)?.label ?? value;
}
