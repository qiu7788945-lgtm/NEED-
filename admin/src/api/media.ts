const apiBaseUrl = 'http://localhost:4000';

export interface AdminMediaFile {
  fileName: string;
  originalName?: string;
  url: string;
  size: number;
  mimeType: string;
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
  formData.append('file', file);

  Object.entries(metadata).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      formData.append(key, String(value));
    }
  });

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
}

export async function listImages(params: MediaListParams = {}) {
  const searchParams = new URLSearchParams();

  if (params.category) {
    searchParams.set('category', params.category);
  }

  if (params.keyword) {
    searchParams.set('keyword', params.keyword);
  }

  ['ownerType', 'ownerId', 'ownerSlug', 'groupKey', 'slotNo', 'enabled'].forEach((key) => {
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
