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
  summary: string;
  excerpt: string;
  coverImg?: string;
  tags: string[];
  content?: string;
  contentHtml?: string;
  contentText?: string;
  clientType?: string;
  eventType?: string;
  eventDate?: string;
  location?: string;
  sortOrder?: number;
  seoTitle?: string;
  seoDescription?: string;
}

export interface PublicSolution {
  id: string;
  slug: string;
  publicSlug: string;
  publicPath: string;
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

export const solutionPublicPathBySourceSlug: Record<string, string> = {
  'family-day': '/solutions/family-day',
  'client-appreciation': '/solutions/salon',
  'annual-meeting': '/solutions/annual',
  'commercial-display': '/solutions/exhibition',
  'video-digital-assets': '/solutions/video',
  'academic-forum': '/solutions/forum',
  other: '/solutions/other',
};

export const solutionSourceSlugByPublicSlug: Record<string, string> = {
  'family-day': 'family-day',
  salon: 'client-appreciation',
  annual: 'annual-meeting',
  exhibition: 'commercial-display',
  video: 'video-digital-assets',
  forum: 'academic-forum',
  other: 'other',
};

function normalizeSolutionSlug(value: string): string {
  return value.trim().replace(/^\/?solutions\//, '').replace(/^\/+|\/+$/g, '');
}

export function getSolutionPublicPath(sourceSlugOrId: string): string {
  const slug = normalizeSolutionSlug(sourceSlugOrId);

  if (!slug) {
    return '/solutions';
  }

  return solutionPublicPathBySourceSlug[slug] ?? `/solutions/${slug}`;
}

export function getSolutionPublicSlug(sourceSlugOrId: string): string {
  return normalizeSolutionSlug(getSolutionPublicPath(sourceSlugOrId));
}

export function getSolutionSourceSlugByPublicSlug(publicSlugOrPath: string): string {
  const publicSlug = normalizeSolutionSlug(publicSlugOrPath);

  return solutionSourceSlugByPublicSlug[publicSlug] ?? publicSlug;
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toStringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizePublicDisplayText(value: unknown): string {
  return toStringValue(value).replace(/\s+/g, ' ').trim();
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

function resolvePublicHtmlAssetUrls(html: string): string {
  return html.replace(
    /(<img\b[^>]*\bsrc=)(["'])(\/uploads\/[^"']+)\2/gi,
    (_match, prefix: string, quote: string, url: string) => `${prefix}${quote}${resolvePublicAssetUrl(url)}${quote}`,
  );
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
  const eventDate = toStringValue(value.eventDate);
  const location = toStringValue(value.location);
  const tags = [clientType, eventType, location].filter(Boolean);
  const coverUrl = toStringValue(value.coverUrl);
  const summary = toStringValue(value.summary) || toStringValue(value.seoDescription);
  const contentText = toStringValue(value.contentText);
  const contentHtml = resolvePublicHtmlAssetUrls(toStringValue(value.contentHtml));

  return {
    id: toStringValue(value.id) || slug,
    slug,
    title,
    subtitle: [clientType, eventType].filter(Boolean).join(' | '),
    summary,
    excerpt: summary,
    coverImg: resolvePublicAssetUrl(coverUrl),
    tags,
    content: contentText || contentHtml,
    contentHtml,
    contentText,
    clientType,
    eventType,
    eventDate,
    location,
    sortOrder: toNumberValue(value.sortOrder),
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
    publicSlug: getSolutionPublicSlug(slug),
    publicPath: getSolutionPublicPath(slug),
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
      const title = normalizePublicDisplayText(group.title);
      const summary = normalizePublicDisplayText(group.summary || solution.desc);
      const media = group.items
        .filter((item) => item.enabled && item.mediaUrl)
        .map((item) => ({
          id: item.id,
          type: item.fileType,
          url: item.mediaUrl,
          fileName: item.mediaFileName,
          displayName: normalizePublicDisplayText(item.mediaDisplayName),
          alt: normalizePublicDisplayText(item.alt || item.mediaDisplayName || title),
          caption: normalizePublicDisplayText(item.caption),
          sortOrder: item.sortOrder,
        }))
        .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));

      return {
        id: group.id || group.slug,
        slug: group.slug || group.id,
        title,
        summary,
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

export function adaptSolutionGroupsToMediaShowcaseProjects(solution: PublicSolution | null): ScenarioShowcaseData {
  const showcase = adaptSolutionGroupsToShowcaseProjects(solution);

  if (!solution) {
    return showcase;
  }

  const validGroupIds = new Set(
    solution.groups
      .filter((group) => group.enabled)
      .filter((group) => normalizePublicDisplayText(group.title) && normalizePublicDisplayText(group.summary))
      .filter((group) => group.items.some((item) => (
        item.enabled
        && item.mediaUrl
        && (item.fileType === 'image' || item.fileType === 'video')
      )))
      .map((group) => group.id || group.slug),
  );

  return {
    ...showcase,
    projects: showcase.projects.filter((project) => validGroupIds.has(project.id)),
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
    .map((value, index) => ({
      item: adaptCase(value),
      index,
    }))
    .filter((entry): entry is { item: PublicCase; index: number } => entry.item !== null)
    .sort((left, right) => (
      (left.item.sortOrder ?? Number.MAX_SAFE_INTEGER) - (right.item.sortOrder ?? Number.MAX_SAFE_INTEGER)
      || left.index - right.index
    ))
    .map(({ item }) => item);
}

export async function fetchPublishedCaseBySlug(slug: string): Promise<PublicCase | null> {
  const normalizedSlug = slug.trim();

  if (!normalizedSlug) {
    return null;
  }

  const cases = await fetchPublishedCases();
  return cases.find((item) => item.slug === normalizedSlug) ?? null;
}

export async function fetchEnabledSolutions(): Promise<PublicSolution[]> {
  const payload = await safeFetchJson('/api/solutions');
  return normalizeArrayPayload(payload)
    .map(adaptSolution)
    .filter((item): item is PublicSolution => item !== null);
}

export async function fetchEnabledSolutionBySlug(slug: string): Promise<PublicSolution | null> {
  const solutions = await fetchEnabledSolutions();
  const sourceSlug = getSolutionSourceSlugByPublicSlug(slug);

  return solutions.find((solution) => solution.slug === sourceSlug || solution.id === sourceSlug) ?? null;
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
