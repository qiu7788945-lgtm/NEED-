import type { HomeInteractiveImageSlot, HomeVideoConfig } from '../../../shared/types/home';
import { getJson, putJson } from './client';

const errorOptions = {
  fallbackMessage: 'Request failed',
};

export async function getHomeInteractiveImages() {
  return getJson<HomeInteractiveImageSlot[]>('/api/home/interactive-images', errorOptions);
}

export async function saveHomeInteractiveImages(slots: HomeInteractiveImageSlot[]) {
  return putJson<HomeInteractiveImageSlot[]>('/api/home/interactive-images', slots, errorOptions);
}

export async function getHomeVideo() {
  return getJson<HomeVideoConfig>('/api/home/video', errorOptions);
}

export async function saveHomeVideo(config: HomeVideoConfig) {
  return putJson<HomeVideoConfig>('/api/home/video', config, errorOptions);
}
