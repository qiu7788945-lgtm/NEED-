const apiBaseUrl = 'http://localhost:4000';

export interface AdminMediaFile {
  fileName: string;
  originalName?: string;
  url: string;
  size: number;
  mimeType: string;
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

export async function uploadImage(file: File) {
  const formData = new FormData();
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

export async function listImages() {
  const data = await readJson<AdminMediaFile[]>(await fetch(`${apiBaseUrl}/api/media/list`));

  return data.map((item) => ({
    ...item,
    url: toAbsoluteUrl(item.url),
  }));
}
