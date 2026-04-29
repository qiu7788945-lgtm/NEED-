const apiBaseUrl = 'http://localhost:4000';

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
}

interface ApiResponse<TData> {
  ok: boolean;
  message: string;
  data?: TData;
  code?: string;
}

function toAbsoluteUrl(url: string) {
  if (url.startsWith('http')) {
    return url;
  }

  return `${apiBaseUrl}${url}`;
}

async function readJson<TData>(response: Response): Promise<TData> {
  const body = await response.json() as ApiResponse<TData>;

  if (!response.ok || !body.ok || !body.data) {
    throw new Error(body.message || 'Request failed');
  }

  return body.data;
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

  return {
    ...data,
    url: toAbsoluteUrl(data.url),
  };
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

  return data.map((item) => ({
    ...item,
    url: toAbsoluteUrl(item.url),
  }));
}

export async function archiveImage(fileName: string) {
  const data = await readJson<AdminMediaFile>(await fetch(`${apiBaseUrl}/api/media/${encodeURIComponent(fileName)}/archive`, {
    method: 'PATCH',
  }));

  return {
    ...data,
    url: toAbsoluteUrl(data.url),
  };
}

export async function restoreImage(fileName: string) {
  const data = await readJson<AdminMediaFile>(await fetch(`${apiBaseUrl}/api/media/${encodeURIComponent(fileName)}/restore`, {
    method: 'PATCH',
  }));

  return {
    ...data,
    url: toAbsoluteUrl(data.url),
  };
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
