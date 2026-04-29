import type { HomeInteractiveImageSlot, HomeVideoConfig } from '../../../shared/types/home';

const apiBaseUrl = 'http://localhost:4000';

interface ApiResponse<TData> {
  ok: boolean;
  message: string;
  data?: TData;
}

async function readJson<TData>(response: Response): Promise<TData> {
  const body = await response.json() as ApiResponse<TData>;

  if (!response.ok || !body.ok || !body.data) {
    throw new Error(body.message || 'Request failed');
  }

  return body.data;
}

export async function getHomeInteractiveImages() {
  return readJson<HomeInteractiveImageSlot[]>(
    await fetch(`${apiBaseUrl}/api/home/interactive-images`),
  );
}

export async function saveHomeInteractiveImages(slots: HomeInteractiveImageSlot[]) {
  return readJson<HomeInteractiveImageSlot[]>(
    await fetch(`${apiBaseUrl}/api/home/interactive-images`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(slots),
    }),
  );
}

export async function getHomeVideo() {
  return readJson<HomeVideoConfig>(
    await fetch(`${apiBaseUrl}/api/home/video`),
  );
}

export async function saveHomeVideo(config: HomeVideoConfig) {
  return readJson<HomeVideoConfig>(
    await fetch(`${apiBaseUrl}/api/home/video`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    }),
  );
}
