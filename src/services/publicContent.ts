import type { Page } from '../../shared/types/pages';

const viteEnv = (import.meta as ImportMeta & {
  env?: {
    VITE_PUBLIC_API_BASE_URL?: string;
  };
}).env;

const API_BASE_URL = viteEnv?.VITE_PUBLIC_API_BASE_URL || 'http://localhost:4000';

export interface PublicHomeVideo {
  videoUrl: string;
  enabled: boolean;
}

export interface PublicArticle {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content?: string;
  category?: string;
  sortOrder?: number;
  seoTitle?: string;
  seoDescription?: string;
}

export interface PublicCase {
  id: string;
  slug: string;
  title: string;
  subtitle?: string;
  excerpt: string;
  coverImg?: string;
  tags: string[];
  content?: string;
  clientType?: string;
  eventType?: string;
  location?: string;
  seoTitle?: string;
  seoDescription?: string;
}

export interface PublicSolution {
  id: string;
  slug: string;
  title: string;
  desc: string;
  enabled: boolean;
  groups: PublicSolutionGroup[];
}

export interface PublicSolutionGroup {
  id: string;
  slug: string;
  title: string;
  summary: string;
  sortOrder?: number;
  enabled: boolean;
  items: PublicSolutionItem[];
}

export interface PublicSolutionItem {
  id: string;
  fileType: 'image' | 'video';
  mediaUrl: string;
  mediaFileName: string;
  mediaDisplayName: string;
  alt: string;
  caption: string;
  sortOrder?: number;
  enabled: boolean;
}

export interface ScenarioShowcaseMedia {
  id: string;
  type: 'image' | 'video';
  url: string;
  fileName: string;
  displayName: string;
  alt: string;
  caption: string;
  sortOrder?: number;
}

export interface ScenarioShowcaseProject {
  id: string;
  slug: string;
  title: string;
  summary: string;
  sortOrder?: number;
  media: ScenarioShowcaseMedia[];
  imageMedia: ScenarioShowcaseMedia[];
  videoMedia: ScenarioShowcaseMedia[];
}

export interface ScenarioShowcaseData {
  sceneSlug: string;
  sceneTitle: string;
  sceneDesc: string;
  projects: ScenarioShowcaseProject[];
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toStringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function toBooleanValue(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function toNumberValue(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function normalizeArrayPayload(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (!isRecord(value)) {
    return [];
  }

  const directData = value.data;
  const directItems = value.items;

  if (Array.isArray(directData)) {
    return directData;
  }

  if (Array.isArray(directItems)) {
    return directItems;
  }

  if (isRecord(directData) && Array.isArray(directData.items)) {
    return directData.items;
  }

  return [];
}

function normalizeObjectPayload(value: unknown): UnknownRecord | null {
  if (isRecord(value) && isRecord(value.data)) {
    return value.data;
  }

  return isRecord(value) ? value : null;
}

async function safeFetchJson(path: string): Promise<unknown | null> {
  try {
    const response = await fetch(`${API_BASE_URL}${path}`);

    if (!response.ok) {
      return null;
    }

    try {
      return await response.json();
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

function isPublished(item: UnknownRecord): boolean {
  return item.status === 'published' || item.published === true;
}

function isEnabled(item: UnknownRecord): boolean {
  return item.enabled !== false;
}

function adaptArticle(value: unknown): PublicArticle | null {
  if (!isRecord(value) || !isPublished(value)) {
    return null;
  }

  const title = toStringValue(value.title);
  const slug = toStringValue(value.slug);

  if (!title || !slug) {
    return null;
  }

  return {
    id: toStringValue(value.id) || slug,
    slug,
    title,
    excerpt: toStringValue(value.summary) || toStringValue(value.excerpt) || toStringValue(value.seoDescription),
    content: toStringValue(value.content) || toStringValue(value.body) || toStringValue(value.contentText),
    category: toStringValue(value.category),
    sortOrder: toNumberValue(value.sortOrder),
    seoTitle: toStringValue(value.seoTitle),
    seoDescription: toStringValue(value.seoDescription),
  };
}

function adaptCase(value: unknown): PublicCase | null {
  if (!isRecord(value) || !isPublished(value)) {
    return null;
  }

  const title = toStringValue(value.title);
  const slug = toStringValue(value.slug);

  if (!title || !slug) {
    return null;
  }

  const clientType = toStringValue(value.clientType);
  const eventType = toStringValue(value.eventType);
  const location = toStringValue(value.location);
  const tags = [clientType, eventType, location].filter(Boolean);
  const coverUrl = toStringValue(value.coverUrl);

  return {
    id: toStringValue(value.id) || slug,
    slug,
    title,
    subtitle: [clientType, eventType].filter(Boolean).join(' | '),
    excerpt: toStringValue(value.summary) || toStringValue(value.seoDescription),
    coverImg: resolvePublicAssetUrl(coverUrl),
    tags,
    content: toStringValue(value.contentText) || toStringValue(value.contentHtml),
    clientType,
    eventType,
    location,
    seoTitle: toStringValue(value.seoTitle),
    seoDescription: toStringValue(value.seoDescription),
  };
}

function adaptSolution(value: unknown): PublicSolution | null {
  if (!isRecord(value) || !isEnabled(value)) {
    return null;
  }

  const slug = toStringValue(value.slug);
  const title = toStringValue(value.name) || toStringValue(value.title);

  if (!slug || !title) {
    return null;
  }

  return {
    id: slug,
    slug,
    title,
    desc: toStringValue(value.description) || toStringValue(value.desc),
    enabled: true,
    groups: normalizeArrayPayload(value.groups)
      .map(adaptSolutionGroup)
      .filter((item): item is PublicSolutionGroup => item !== null)
      .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0)),
  };
}

function adaptSolutionGroup(value: unknown): PublicSolutionGroup | null {
  if (!isRecord(value) || !isEnabled(value)) {
    return null;
  }

  const id = toStringValue(value.id) || toStringValue(value.slug);
  const slug = toStringValue(value.slug) || id;
  const title = toStringValue(value.title);

  if (!id || !slug || !title) {
    return null;
  }

  return {
    id,
    slug,
    title,
    summary: toStringValue(value.summary),
    sortOrder: toNumberValue(value.sortOrder),
    enabled: true,
    items: normalizeArrayPayload(value.items)
      .map(adaptSolutionItem)
      .filter((item): item is PublicSolutionItem => item !== null)
      .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0)),
  };
}

function adaptSolutionItem(value: unknown): PublicSolutionItem | null {
  if (!isRecord(value) || !isEnabled(value)) {
    return null;
  }

  const id = toStringValue(value.id);
  const mediaUrl = resolvePublicAssetUrl(value.mediaUrl);
  const fileType = value.fileType === 'video' ? 'video' : 'image';

  if (!id || !mediaUrl) {
    return null;
  }

  return {
    id,
    fileType,
    mediaUrl,
    mediaFileName: toStringValue(value.mediaFileName),
    mediaDisplayName: toStringValue(value.mediaDisplayName),
    alt: toStringValue(value.alt),
    caption: toStringValue(value.caption),
    sortOrder: toNumberValue(value.sortOrder),
    enabled: true,
  };
}

export function adaptSolutionGroupsToShowcaseProjects(solution: PublicSolution | null): ScenarioShowcaseData {
  if (!solution) {
    return {
      sceneSlug: '',
      sceneTitle: '',
      sceneDesc: '',
      projects: [],
    };
  }

  const projects = solution.groups
    .filter((group) => group.enabled)
    .map((group) => {
      const media = group.items
        .filter((item) => item.enabled && item.mediaUrl)
        .map((item) => ({
          id: item.id,
          type: item.fileType,
          url: item.mediaUrl,
          fileName: item.mediaFileName,
          displayName: item.mediaDisplayName,
          alt: item.alt || item.mediaDisplayName || group.title,
          caption: item.caption,
          sortOrder: item.sortOrder,
        }))
        .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));

      return {
        id: group.id || group.slug,
        slug: group.slug || group.id,
        title: group.title,
        summary: group.summary || solution.desc,
        sortOrder: group.sortOrder,
        media,
        imageMedia: media.filter((item) => item.type === 'image'),
        videoMedia: media.filter((item) => item.type === 'video'),
      };
    })
    .filter((project) => project.id && project.slug && project.title && project.summary && project.media.length > 0)
    .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));

  return {
    sceneSlug: solution.slug,
    sceneTitle: solution.title,
    sceneDesc: solution.desc,
    projects,
  };
}

function adaptPage(value: unknown): Page | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = toStringValue(value.id);
  const title = toStringValue(value.title);
  const path = toStringValue(value.path);
  const slug = toStringValue(value.slug);

  if (!id || !title || !path || !slug) {
    return null;
  }

  return value as unknown as Page;
}

function isPublicRenderablePage(page: Page) {
  return page.status === 'published'
    && page.shouldIndex !== false
    && Object.values(page.requiredChecks).every(Boolean);
}

export function resolvePublicAssetUrl(url: unknown): string {
  const value = toStringValue(url).trim();

  if (!value) {
    return '';
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  if (value.startsWith('/uploads/')) {
    return `${API_BASE_URL}${value}`;
  }

  if (value.startsWith('/')) {
    return value;
  }

  return value;
}

export async function fetchHomeVideo(): Promise<PublicHomeVideo | null> {
  const payload = await safeFetchJson('/api/home/video');
  const data = normalizeObjectPayload(payload);

  if (!data) {
    return null;
  }

  const videoUrl = resolvePublicAssetUrl(data.videoUrl);
  const enabled = toBooleanValue(data.enabled);

  if (!enabled || !videoUrl) {
    return null;
  }

  return {
    videoUrl,
    enabled,
  };
}

export async function fetchPublishedArticles(): Promise<PublicArticle[]> {
  const payload = await safeFetchJson('/api/articles');
  return normalizeArrayPayload(payload)
    .map(adaptArticle)
    .filter((item): item is PublicArticle => item !== null);
}

export async function fetchPublishedCases(): Promise<PublicCase[]> {
  const payload = await safeFetchJson('/api/cases');
  return normalizeArrayPayload(payload)
    .map(adaptCase)
    .filter((item): item is PublicCase => item !== null);
}

export async function fetchEnabledSolutions(): Promise<PublicSolution[]> {
  const payload = await safeFetchJson('/api/solutions');
  return normalizeArrayPayload(payload)
    .map(adaptSolution)
    .filter((item): item is PublicSolution => item !== null);
}

export async function fetchEnabledSolutionBySlug(slug: string): Promise<PublicSolution | null> {
  const solutions = await fetchEnabledSolutions();

  return solutions.find((solution) => solution.slug === slug || solution.id === slug) ?? null;
}

export async function fetchPublishedPages(): Promise<Page[]> {
  const payload = await safeFetchJson('/api/pages?status=published');
  return normalizeArrayPayload(payload)
    .map(adaptPage)
    .filter((item): item is Page => item !== null && isPublicRenderablePage(item));
}

export async function fetchPageByPath(path: string): Promise<Page | null> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const pages = await fetchPublishedPages();

  return pages.find((page) => page.path === normalizedPath) ?? null;
}

export async function fetchPageById(id: string): Promise<Page | null> {
  const payload = await safeFetchJson(`/api/pages/${encodeURIComponent(id)}`);
  const page = adaptPage(normalizeObjectPayload(payload));

  return page && isPublicRenderablePage(page) ? page : null;
}

export async function fetchPreviewPageById(id: string): Promise<Page | null> {
  const payload = await safeFetchJson(`/api/pages/${encodeURIComponent(id)}`);

  return adaptPage(normalizeObjectPayload(payload));
}
