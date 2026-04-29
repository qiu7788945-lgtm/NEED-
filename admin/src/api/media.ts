const apiBaseUrl = 'http://localhost:4000';

export interface AdminMediaUsage {
  type: string;
  label: string;
  detail: string;
}

export interface AdminMediaFile {
  fileName: string;
  originalName?: string;
  displayName: string;
  url: string;
  size: number;
  mimeType: string;
  width: number | null;
  height: number | null;
  category: string;
  alt: string;
  description: string;
  ownerType: string;
  ownerId: number | null;
  ownerSlug: string;
  groupKey: string;
  slotNo: number | null;
  caption: string;
  enabled: boolean;
  sortOrder: number;
  status: 'active' | 'archived';
  createdAt?: string;
  usageCount: number;
  usages: AdminMediaUsage[];
}

interface ApiResponse<TData> {
  ok: boolean;
  message: string;
  data?: TData;
  code?: string;
}

const friendlyErrorMessages: Record<string, string> = {
  FILE_NAMES_REQUIRED: '请选择要操作的素材。',
  INVALID_MEDIA_FILE_NAME: '素材文件名不合法。',
  MEDIA_FILE_NOT_FOUND: '没有找到这张素材，可能已经被删除。',
  MEDIA_NOT_ARCHIVED: '请先归档素材，再执行永久删除。',
  MEDIA_USED_BY_HOME: '这张图片正在首页使用，请先解除引用。',
  NOT_FOUND: '没有找到这张素材，可能已经被删除。',
};

function toAbsoluteUrl(url: string) {
  if (url.startsWith('http')) {
    return url;
  }

  return `${apiBaseUrl}${url}`;
}

async function readJson<TData>(response: Response): Promise<TData> {
  const body = await response.json() as ApiResponse<TData>;

  if (!response.ok || !body.ok || !body.data) {
    throw new Error((body.code ? friendlyErrorMessages[body.code] : '') || body.message || '操作失败，请稍后再试。');
  }

  return body.data;
}

function normalizeMediaFile(data: AdminMediaFile) {
  return {
    ...data,
    url: toAbsoluteUrl(data.url),
    usageCount: data.usageCount ?? 0,
    usages: data.usages ?? [],
  };
}

export interface MediaUploadMetadata {
  category?: string;
  displayName?: string;
  storageName?: string;
  alt?: string;
  description?: string;
  ownerType?: string;
  ownerId?: string;
  ownerSlug?: string;
  groupKey?: string;
  slotNo?: string;
  caption?: string;
  enabled?: boolean;
  sortOrder?: string;
}

export async function uploadImage(file: File, metadata: MediaUploadMetadata = {}) {
  const formData = new FormData();

  Object.entries(metadata).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      formData.append(key, String(value));
    }
  });

  formData.append('file', file);

  const data = await readJson<AdminMediaFile>(await fetch(`${apiBaseUrl}/api/media/upload`, {
    method: 'POST',
    body: formData,
  }));

  return normalizeMediaFile(data);
}

export interface MediaListParams {
  category?: string;
  keyword?: string;
  ownerType?: string;
  ownerId?: string;
  ownerSlug?: string;
  groupKey?: string;
  slotNo?: string;
  enabled?: string;
  status?: 'active' | 'archived' | 'all';
}

export async function listImages(params: MediaListParams = {}) {
  const searchParams = new URLSearchParams();

  if (params.category) {
    searchParams.set('category', params.category);
  }

  if (params.keyword) {
    searchParams.set('keyword', params.keyword);
  }

  ['ownerType', 'ownerId', 'ownerSlug', 'groupKey', 'slotNo', 'enabled', 'status'].forEach((key) => {
    const value = params[key as keyof MediaListParams];
    if (value) {
      searchParams.set(key, value);
    }
  });

  const query = searchParams.toString();
  const data = await readJson<AdminMediaFile[]>(await fetch(`${apiBaseUrl}/api/media/list${query ? `?${query}` : ''}`));

  return data.map((item) => normalizeMediaFile(item));
}

export async function archiveImage(fileName: string) {
  const data = await readJson<AdminMediaFile>(await fetch(`${apiBaseUrl}/api/media/${encodeURIComponent(fileName)}/archive`, {
    method: 'PATCH',
  }));

  return normalizeMediaFile(data);
}

export async function restoreImage(fileName: string) {
  const data = await readJson<AdminMediaFile>(await fetch(`${apiBaseUrl}/api/media/${encodeURIComponent(fileName)}/restore`, {
    method: 'PATCH',
  }));

  return normalizeMediaFile(data);
}

export interface MediaUpdateMetadata {
  displayName?: string;
  category?: string;
  alt?: string;
  caption?: string;
  description?: string;
  ownerType?: string;
  ownerId?: string;
  ownerSlug?: string;
  groupKey?: string;
  slotNo?: string;
  sortOrder?: string;
  enabled?: boolean;
}

export async function updateImage(fileName: string, metadata: MediaUpdateMetadata) {
  const data = await readJson<AdminMediaFile>(await fetch(`${apiBaseUrl}/api/media/${encodeURIComponent(fileName)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  }));

  return normalizeMediaFile(data);
}

export interface DeleteMediaResult {
  fileName: string;
  deletedFile: boolean;
  removedFromIndex: boolean;
  fileMissing: boolean;
}

export async function deleteImage(fileName: string) {
  return readJson<DeleteMediaResult>(await fetch(`${apiBaseUrl}/api/media/${encodeURIComponent(fileName)}`, {
    method: 'DELETE',
  }));
}

export interface BatchMediaResult {
  total: number;
  success: number;
  skipped: number;
  failed: number;
  results: Array<{
    fileName: string;
    status: 'success' | 'skipped' | 'failed';
    reason?: string;
  }>;
}

async function batchRequest(path: string, method: 'PATCH' | 'DELETE', fileNames: string[]) {
  return readJson<BatchMediaResult>(await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileNames }),
  }));
}

export async function batchArchiveImages(fileNames: string[]) {
  return batchRequest('/api/media/batch/archive', 'PATCH', fileNames);
}

export async function batchRestoreImages(fileNames: string[]) {
  return batchRequest('/api/media/batch/restore', 'PATCH', fileNames);
}

export async function batchDeleteImages(fileNames: string[]) {
  return batchRequest('/api/media/batch', 'DELETE', fileNames);
}
