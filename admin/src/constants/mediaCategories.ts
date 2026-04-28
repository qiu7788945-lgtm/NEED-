export const mediaCategories = [
  { value: '', label: '\u5168\u90e8\u5206\u7c7b' },
  { value: 'home_interactive', label: '\u9996\u9875\u4ea4\u4e92\u56fe' },
  { value: 'home_video', label: '\u9996\u9875\u89c6\u9891' },
  { value: 'case_image', label: '\u6848\u4f8b\u56fe\u7247' },
  { value: 'article_cover', label: '\u6587\u7ae0\u5c01\u9762' },
  { value: 'solution_image', label: '\u573a\u666f\u65b9\u6848\u56fe' },
  { value: 'solution_video', label: '\u573a\u666f\u65b9\u6848\u89c6\u9891' },
  { value: 'page_editor', label: '\u9875\u9762\u7f16\u8f91\u5668\u7d20\u6750' },
  { value: 'word_import', label: 'Word \u5bfc\u5165\u56fe\u7247' },
  { value: 'temporary', label: '\u4e34\u65f6\u7d20\u6750' },
  { value: 'qrcode', label: '\u4e8c\u7ef4\u7801' },
];

export function getMediaCategoryLabel(value: string) {
  return mediaCategories.find((category) => category.value === value)?.label ?? value;
}

export const mediaOwnerTypes = [
  { value: '', label: '\u5168\u90e8\u5f52\u5c5e' },
  { value: 'home', label: '\u9996\u9875' },
  { value: 'case', label: '\u6848\u4f8b' },
  { value: 'article', label: '\u6587\u7ae0' },
  { value: 'solution', label: '\u573a\u666f\u65b9\u6848' },
  { value: 'page', label: '\u81ea\u5b9a\u4e49\u9875\u9762' },
  { value: 'word_import', label: 'Word \u5bfc\u5165' },
  { value: 'system', label: '\u7cfb\u7edf\u7d20\u6750' },
  { value: 'temporary', label: '\u4e34\u65f6\u7d20\u6750' },
];
