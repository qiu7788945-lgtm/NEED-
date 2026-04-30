import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Article, ArticleCategory } from '../../../../shared/types/article.js';
import type { CaseStudy } from '../../../../shared/types/case.js';
import type { HomeInteractiveImageSlot, HomeVideoConfig } from '../../../../shared/types/home.js';
import type {
  QualityCheckItem,
  QualityCheckModule,
  QualityCheckResult,
  QualityCheckSeverity,
  QualityCheckTarget,
} from '../../../../shared/types/quality-check.js';
import type { SolutionScene, SolutionSceneSlug } from '../../../../shared/types/solution.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const projectRoot = path.resolve(serverRoot, '..');
const dataDir = path.join(serverRoot, 'data');
const seedDir = path.join(dataDir, 'seeds');
const publicDir = path.join(projectRoot, 'public');
const mediaIndexPath = path.join(dataDir, 'media-library.json');

const allowedArticleCategories = new Set<ArticleCategory>([
  'how_to_choose',
  'choose_between_two',
  'method_judgment',
]);

const defaultSceneSlugs: SolutionSceneSlug[] = [
  'family-day',
  'client-appreciation',
  'annual-meeting',
  'commercial-display',
  'video-digital-assets',
  'academic-forum',
  'other',
];

interface PublicMediaSeed {
  fileName?: string;
  originalName?: string;
  displayName?: string;
  fileType?: string;
  url?: string;
  category?: string;
  alt?: string;
  description?: string;
  ownerType?: string;
  ownerSlug?: string;
  groupKey?: string;
  slotNo?: number;
  sortOrder?: number;
  status?: string;
}

interface ReadResult<T> {
  data: T | null;
  error: string | null;
  missing: boolean;
}

function normalizeJsonText(text: string) {
  return text.replace(/^\uFEFF/, '').trim();
}

async function readJsonFile<T>(filePath: string): Promise<ReadResult<T>> {
  try {
    const raw = normalizeJsonText(await fs.readFile(filePath, 'utf8'));
    if (!raw) {
      return { data: null, error: '文件为空', missing: false };
    }
    return { data: JSON.parse(raw) as T, error: null, missing: false };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { data: null, error: '文件不存在', missing: true };
    }
    return {
      data: null,
      error: error instanceof Error ? error.message : String(error),
      missing: false,
    };
  }
}

function isBlank(value: unknown) {
  return typeof value !== 'string' || value.trim().length === 0;
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function containsPlaceholder(value: unknown) {
  const text = normalizeText(value);
  return /待补充|占位|待補充/i.test(text);
}

function isShortSeoDescription(value: unknown) {
  const text = normalizeText(value);
  return text.length > 0 && text.length < 50;
}

function hasConfirmingText(value: unknown) {
  return /待确认|未确认|需确认|公开权限|具体城市待确认/i.test(normalizeText(value));
}

function countKeywords(value: unknown) {
  const text = normalizeText(value);
  if (!text) {
    return 0;
  }
  return text.split(/[,，、\s]+/).filter(Boolean).length;
}

function createIssueFactory() {
  const items: QualityCheckItem[] = [];
  let index = 1;

  function addIssue(input: Omit<QualityCheckItem, 'id'> & { idHint?: string }) {
    const idBase = input.idHint
      ? input.idHint.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
      : '';
    const { idHint: _idHint, ...item } = input;
    items.push({
      ...item,
      id: idBase ? `${idBase}-${index}` : `quality-${index}`,
    });
    index += 1;
  }

  return { items, addIssue };
}

function addFileReadIssue(
  addIssue: (input: Omit<QualityCheckItem, 'id'> & { idHint?: string }) => void,
  fileName: string,
  module: QualityCheckModule,
  target: QualityCheckTarget,
  error: string,
) {
  addIssue({
    idHint: `${module}-${fileName}-read-failed`,
    module,
    objectType: '数据文件',
    objectTitle: fileName,
    severity: 'high',
    issue: `无法读取或解析 ${fileName}：${error}`,
    suggestion: '检查该 JSON 文件是否存在、是否为空、是否包含非法字符；修复前不要进入静态发布。',
    blockingPublish: true,
    needsHumanConfirmation: true,
    target,
  });
}

async function pathExistsForUrl(url: string) {
  if (!url.startsWith('/') || url.startsWith('//')) {
    return true;
  }
  const safeUrl = url.split('?')[0]?.split('#')[0] ?? '';
  const filePath = safeUrl.startsWith('/uploads/')
    ? path.join(serverRoot, safeUrl)
    : path.join(publicDir, safeUrl.replace(/^\//, ''));
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function checkHome(addIssue: (input: Omit<QualityCheckItem, 'id'> & { idHint?: string }) => void) {
  const videoResult = await readJsonFile<Partial<HomeVideoConfig>>(path.join(dataDir, 'home-video.json'));
  if (!videoResult.data) {
    addFileReadIssue(addIssue, 'home-video.json', 'home', { type: 'homeVideo' }, videoResult.error ?? '未知错误');
  } else {
    const video = videoResult.data;
    if (video.enabled && isBlank(video.videoUrl)) {
      addIssue({
        idHint: 'home-video-empty-url',
        module: 'home',
        objectType: '首页视频',
        objectTitle: normalizeText(video.title) || '首页视频',
        severity: 'high',
        issue: '首页视频已启用，但视频地址为空。',
        suggestion: '上传或选择正式首页视频；没有视频时先关闭该配置。',
        blockingPublish: true,
        needsHumanConfirmation: true,
        target: { type: 'homeVideo' },
      });
    }
    if (video.enabled && !isBlank(video.videoUrl) && !(await pathExistsForUrl(normalizeText(video.videoUrl)))) {
      addIssue({
        idHint: 'home-video-url-not-found',
        module: 'home',
        objectType: '首页视频',
        objectTitle: normalizeText(video.title) || normalizeText(video.videoUrl),
        severity: 'high',
        issue: '首页视频路径在本地 public/uploads 中无法确认存在。',
        suggestion: '确认视频文件仍存在，或在后台重新上传/选择视频。',
        blockingPublish: true,
        needsHumanConfirmation: true,
        target: { type: 'homeVideo' },
      });
    }
    if (video.enabled && isBlank(video.title)) {
      addIssue({
        idHint: 'home-video-title-empty',
        module: 'home',
        objectType: '首页视频',
        objectTitle: normalizeText(video.videoUrl) || '首页视频',
        severity: 'high',
        issue: '首页视频标题为空。',
        suggestion: '补充后台可识别的视频标题，方便后续 GEO 和发布检查。',
        blockingPublish: true,
        needsHumanConfirmation: false,
        target: { type: 'homeVideo' },
      });
    }
    if (video.enabled && isBlank(video.posterUrl)) {
      addIssue({
        idHint: 'home-video-poster-empty',
        module: 'home',
        objectType: '首页视频',
        objectTitle: normalizeText(video.title) || '首页视频',
        severity: 'medium',
        issue: '首页视频缺少 poster。',
        suggestion: '补一张视频封面图，用于首屏加载、分享和弱网兜底。',
        blockingPublish: false,
        needsHumanConfirmation: true,
        target: { type: 'homeVideo' },
      });
    }
    if (video.enabled && isBlank(video.description)) {
      addIssue({
        idHint: 'home-video-description-empty',
        module: 'home',
        objectType: '首页视频',
        objectTitle: normalizeText(video.title) || '首页视频',
        severity: 'medium',
        issue: '首页视频描述为空。',
        suggestion: '补充一句说明，方便后台识别和未来 GEO 字段生成。',
        blockingPublish: false,
        needsHumanConfirmation: false,
        target: { type: 'homeVideo' },
      });
    }
  }

  const slotsResult = await readJsonFile<HomeInteractiveImageSlot[]>(path.join(dataDir, 'home-interactive-images.json'));
  if (!slotsResult.data) {
    addFileReadIssue(addIssue, 'home-interactive-images.json', 'home', { type: 'homeInteractive' }, slotsResult.error ?? '未知错误');
    return;
  }

  const slots = Array.isArray(slotsResult.data) ? slotsResult.data : [];
  if (slots.length < 12) {
    addIssue({
      idHint: 'home-interactive-less-than-12',
      module: 'home',
      objectType: '首页 12 图',
      objectTitle: '首页交互图槽位',
      severity: 'medium',
      issue: `当前只有 ${slots.length} 个槽位，不足 12 个。`,
      suggestion: '补齐 12 个槽位，或确认发布端允许较少槽位。',
      blockingPublish: false,
      needsHumanConfirmation: true,
      target: { type: 'homeInteractive' },
    });
  }

  const filledSlots = slots.filter((slot) => !isBlank(slot.mediaUrl));
  if (slots.length >= 12 && filledSlots.length === 0) {
    addIssue({
      idHint: 'home-interactive-all-empty',
      module: 'home',
      objectType: '首页 12 图',
      objectTitle: '首页交互图槽位',
      severity: 'high',
      issue: '首页 12 图全部为空。',
      suggestion: '补充真实 NEED 图片，或在静态发布前关闭该模块。',
      blockingPublish: true,
      needsHumanConfirmation: true,
      target: { type: 'homeInteractive' },
    });
  }

  const sortOrders = new Map<number, number>();
  slots.forEach((slot) => {
    if (slot.enabled && isBlank(slot.mediaUrl)) {
      addIssue({
        idHint: `home-interactive-slot-${slot.slotNo}-empty`,
        module: 'home',
        objectType: '首页 12 图',
        objectTitle: `槽位 ${slot.slotNo}`,
        severity: 'high',
        issue: '该槽位已启用，但图片为空。',
        suggestion: '上传图片、选择媒体库图片，或先关闭该槽位。',
        blockingPublish: true,
        needsHumanConfirmation: true,
        target: { type: 'homeInteractive', id: String(slot.slotNo) },
      });
    }
    if (slot.enabled && !isBlank(slot.mediaUrl) && isBlank(slot.alt)) {
      addIssue({
        idHint: `home-interactive-slot-${slot.slotNo}-alt-empty`,
        module: 'home',
        objectType: '首页 12 图',
        objectTitle: `槽位 ${slot.slotNo}`,
        severity: 'high',
        issue: '该槽位有图片但缺少 alt/GEO 描述。',
        suggestion: '补充一句能说明画面内容和业务场景的 alt。',
        blockingPublish: true,
        needsHumanConfirmation: false,
        target: { type: 'homeInteractive', id: String(slot.slotNo) },
      });
    }
    if (!Number.isFinite(slot.sortOrder)) {
      addIssue({
        idHint: `home-interactive-slot-${slot.slotNo}-sort-missing`,
        module: 'home',
        objectType: '首页 12 图',
        objectTitle: `槽位 ${slot.slotNo}`,
        severity: 'medium',
        issue: '该槽位缺少有效排序值。',
        suggestion: '补充 1-12 的排序值。',
        blockingPublish: false,
        needsHumanConfirmation: false,
        target: { type: 'homeInteractive', id: String(slot.slotNo) },
      });
    } else {
      sortOrders.set(slot.sortOrder, (sortOrders.get(slot.sortOrder) ?? 0) + 1);
    }
  });
  for (const [sortOrder, count] of sortOrders.entries()) {
    if (count > 1) {
      addIssue({
        idHint: `home-interactive-sort-${sortOrder}-duplicate`,
        module: 'home',
        objectType: '首页 12 图',
        objectTitle: `排序 ${sortOrder}`,
        severity: 'medium',
        issue: '首页 12 图存在重复排序值。',
        suggestion: '调整槽位排序，避免发布时顺序不稳定。',
        blockingPublish: false,
        needsHumanConfirmation: false,
        target: { type: 'homeInteractive' },
      });
    }
  }
}

function checkDuplicateByCategory<T extends { id: string; slug?: string; sortOrder?: number; category?: string }>(
  records: T[],
  addIssue: (input: Omit<QualityCheckItem, 'id'> & { idHint?: string }) => void,
) {
  const groups = new Map<string, T[]>();
  records.forEach((record) => {
    const category = normalizeText(record.category) || 'unknown';
    groups.set(category, [...(groups.get(category) ?? []), record]);
  });

  groups.forEach((items, category) => {
    const slugs = new Map<string, T[]>();
    const sortOrders = new Map<number, T[]>();
    items.forEach((item) => {
      if (item.slug) {
        slugs.set(item.slug, [...(slugs.get(item.slug) ?? []), item]);
      }
      if (Number.isFinite(item.sortOrder)) {
        sortOrders.set(item.sortOrder as number, [...(sortOrders.get(item.sortOrder as number) ?? []), item]);
      }
    });
    slugs.forEach((sameSlugItems, slug) => {
      if (sameSlugItems.length > 1) {
        addIssue({
          idHint: `articles-${category}-${slug}-duplicate`,
          module: 'articles',
          objectType: '文章',
          objectTitle: `${category} / ${slug}`,
          severity: 'high',
          issue: '同一栏目下 slug 重复。',
          suggestion: '修改重复文章 slug，避免未来静态页面路径冲突。',
          blockingPublish: true,
          needsHumanConfirmation: false,
          target: { type: 'article', slug, category },
        });
      }
    });
    sortOrders.forEach((sameSortItems, sortOrder) => {
      if (sameSortItems.length > 1) {
        addIssue({
          idHint: `articles-${category}-sort-${sortOrder}-duplicate`,
          module: 'articles',
          objectType: '文章',
          objectTitle: `${category} / 排序 ${sortOrder}`,
          severity: 'high',
          issue: '同一栏目下 sortOrder 重复。',
          suggestion: '调整该栏目内部排序，避免列表顺序不稳定。',
          blockingPublish: true,
          needsHumanConfirmation: false,
          target: { type: 'article', category },
        });
      }
    });
  });
}

async function checkArticles(addIssue: (input: Omit<QualityCheckItem, 'id'> & { idHint?: string }) => void) {
  const result = await readJsonFile<Article[]>(path.join(dataDir, 'articles.json'));
  if (!result.data) {
    addFileReadIssue(addIssue, 'articles.json', 'articles', { type: 'article' }, result.error ?? '未知错误');
    return;
  }
  const articles = Array.isArray(result.data) ? result.data : [];
  checkDuplicateByCategory(articles, addIssue);

  articles.forEach((article) => {
    const title = normalizeText(article.title) || `文章 ${article.id}`;
    const target = { type: 'article' as const, id: article.id, slug: article.slug, category: article.category };
    const highChecks: Array<[boolean, string, string, string]> = [
      [isBlank(article.title), '标题为空。', '补充清晰文章标题。', 'title-empty'],
      [isBlank(article.slug), 'slug 为空。', '补充英文 slug，避免静态路径缺失。', 'slug-empty'],
      [isBlank(article.category) || !allowedArticleCategories.has(article.category), '栏目为空或不在允许范围。', '选择正确栏目：怎么选活动公司、二选一怎么选、方法与判断。', 'category-invalid'],
      [isBlank(article.content), '正文为空。', '补充正式正文后再发布。', 'content-empty'],
      [containsPlaceholder(article.content), '正文包含“待补充”或“占位”。', '补完正式正文，尤其是二选一栏目，不要让占位内容进入静态发布。', 'content-placeholder'],
      [isBlank(article.seoTitle), 'SEO 标题为空。', '补充 SEO 标题。', 'seo-title-empty'],
      [isBlank(article.seoDescription), 'SEO 描述为空。', '补充 80-120 字左右的 SEO 描述。', 'seo-description-empty'],
    ];
    highChecks.forEach(([failed, issue, suggestion, idHint]) => {
      if (failed) {
        addIssue({
          idHint: `article-${article.id}-${idHint}`,
          module: 'articles',
          objectType: '文章',
          objectTitle: title,
          severity: 'high',
          issue,
          suggestion,
          blockingPublish: true,
          needsHumanConfirmation: idHint === 'content-placeholder',
          target,
        });
      }
    });

    if (isBlank(article.summary)) {
      addIssue({
        idHint: `article-${article.id}-summary-empty`,
        module: 'articles',
        objectType: '文章',
        objectTitle: title,
        severity: 'medium',
        issue: '摘要为空。',
        suggestion: '补充文章摘要，方便列表页和搜索摘要使用。',
        blockingPublish: false,
        needsHumanConfirmation: false,
        target,
      });
    }
    if (countKeywords(article.keywords) === 0) {
      addIssue({
        idHint: `article-${article.id}-keywords-empty`,
        module: 'articles',
        objectType: '文章',
        objectTitle: title,
        severity: 'medium',
        issue: '关键词为空。',
        suggestion: '补充 NEED、活动策划、栏目关键词等关键词。',
        blockingPublish: false,
        needsHumanConfirmation: false,
        target,
      });
    } else if (countKeywords(article.keywords) < 3) {
      addIssue({
        idHint: `article-${article.id}-keywords-few`,
        module: 'articles',
        objectType: '文章',
        objectTitle: title,
        severity: 'low',
        issue: '关键词数量偏少。',
        suggestion: '发布前可补充 3-6 个更具体的业务关键词。',
        blockingPublish: false,
        needsHumanConfirmation: false,
        target,
      });
    }
    if (!Array.isArray(article.faqItems) || article.faqItems.length === 0) {
      addIssue({
        idHint: `article-${article.id}-faq-empty`,
        module: 'articles',
        objectType: '文章',
        objectTitle: title,
        severity: 'medium',
        issue: 'FAQ 为空。',
        suggestion: '补充 2-4 个问答，提升 GEO 问答覆盖。',
        blockingPublish: false,
        needsHumanConfirmation: true,
        target,
      });
    }
    if (article.status === 'draft') {
      addIssue({
        idHint: `article-${article.id}-draft`,
        module: 'articles',
        objectType: '文章',
        objectTitle: title,
        severity: 'medium',
        issue: '文章仍为草稿。',
        suggestion: '发布前人工校对正文、SEO 和 FAQ 后再上架。',
        blockingPublish: false,
        needsHumanConfirmation: true,
        target,
      });
    }
    if (isShortSeoDescription(article.seoDescription)) {
      addIssue({
        idHint: `article-${article.id}-seo-description-short`,
        module: 'articles',
        objectType: '文章',
        objectTitle: title,
        severity: 'low',
        issue: 'SEO 描述偏短。',
        suggestion: '建议扩展到 80-120 字，说明问题、判断标准和服务场景。',
        blockingPublish: false,
        needsHumanConfirmation: false,
        target,
      });
    }
  });
}

async function checkCases(addIssue: (input: Omit<QualityCheckItem, 'id'> & { idHint?: string }) => void) {
  const result = await readJsonFile<CaseStudy[]>(path.join(dataDir, 'cases.json'));
  if (!result.data) {
    addFileReadIssue(addIssue, 'cases.json', 'cases', { type: 'case' }, result.error ?? '未知错误');
    return;
  }
  const cases = Array.isArray(result.data) ? result.data : [];
  cases.forEach((caseItem) => {
    const title = normalizeText(caseItem.title) || `案例 ${caseItem.id}`;
    const target = { type: 'case' as const, id: caseItem.id, slug: caseItem.slug };
    const highChecks: Array<[boolean, string, string, string, boolean]> = [
      [isBlank(caseItem.title), '标题为空。', '补充案例标题。', 'title-empty', false],
      [isBlank(caseItem.slug), 'slug 为空。', '补充英文 slug，避免案例页路径缺失。', 'slug-empty', false],
      [isBlank(caseItem.summary), '摘要为空。', '补充案例摘要。', 'summary-empty', false],
      [isBlank(caseItem.contentText), '正文纯文本为空。', '补充案例正文或重新导入 Word。', 'content-text-empty', false],
      [isBlank(caseItem.contentHtml), '正文 HTML 为空。', '补充案例正文 HTML 或重新导入 Word。', 'content-html-empty', false],
      [isBlank(caseItem.seoTitle), 'SEO 标题为空。', '补充 SEO 标题。', 'seo-title-empty', false],
      [isBlank(caseItem.seoDescription), 'SEO 描述为空。', '补充 SEO 描述。', 'seo-description-empty', false],
      [isBlank(caseItem.eventDate), '活动日期为空。', '补充活动日期或标注不可公开。', 'event-date-empty', true],
      [isBlank(caseItem.clientType), '客户类型为空。', '补充客户类型。', 'client-type-empty', false],
      [isBlank(caseItem.eventType), '活动类型为空。', '补充活动类型。', 'event-type-empty', false],
      [hasConfirmingText(caseItem.summary) || hasConfirmingText(caseItem.contentText) || hasConfirmingText(caseItem.location), '案例存在待确认信息或公开权限提示。', '发布前确认客户名、日期、地点、图片和公开权限。', 'human-confirmation', true],
    ];
    highChecks.forEach(([failed, issue, suggestion, idHint, human]) => {
      if (failed) {
        addIssue({
          idHint: `case-${caseItem.id}-${idHint}`,
          module: 'cases',
          objectType: '案例解析',
          objectTitle: title,
          severity: 'high',
          issue,
          suggestion,
          blockingPublish: true,
          needsHumanConfirmation: human,
          target,
        });
      }
    });
    if (caseItem.status === 'published' && (isBlank(caseItem.coverUrl) || !caseItem.extractedImages?.length)) {
      addIssue({
        idHint: `case-${caseItem.id}-published-missing-media`,
        module: 'cases',
        objectType: '案例解析',
        objectTitle: title,
        severity: 'high',
        issue: '案例已上架，但缺封面或现场图。',
        suggestion: '补齐真实封面和现场图，或先下架该案例。',
        blockingPublish: true,
        needsHumanConfirmation: true,
        target,
      });
    }
    if (isBlank(caseItem.coverUrl)) {
      addIssue({
        idHint: `case-${caseItem.id}-cover-empty`,
        module: 'cases',
        objectType: '案例解析',
        objectTitle: title,
        severity: 'medium',
        issue: '封面图为空。',
        suggestion: '上传真实案例封面，进入 case_image / cover 分组。',
        blockingPublish: false,
        needsHumanConfirmation: true,
        target,
      });
    }
    if (!Array.isArray(caseItem.extractedImages) || caseItem.extractedImages.length === 0) {
      addIssue({
        idHint: `case-${caseItem.id}-images-empty`,
        module: 'cases',
        objectType: '案例解析',
        objectTitle: title,
        severity: 'medium',
        issue: '现场图为空。',
        suggestion: '补充真实现场图，避免案例缺少图文证据。',
        blockingPublish: false,
        needsHumanConfirmation: true,
        target,
      });
    }
    if (isBlank(caseItem.location)) {
      addIssue({
        idHint: `case-${caseItem.id}-location-empty`,
        module: 'cases',
        objectType: '案例解析',
        objectTitle: title,
        severity: 'medium',
        issue: '地点为空。',
        suggestion: '补充城市或可公开的地点范围。',
        blockingPublish: false,
        needsHumanConfirmation: true,
        target,
      });
    }
    if (countKeywords(caseItem.keywords) === 0) {
      addIssue({
        idHint: `case-${caseItem.id}-keywords-empty`,
        module: 'cases',
        objectType: '案例解析',
        objectTitle: title,
        severity: 'medium',
        issue: '关键词为空。',
        suggestion: '补充客户类型、活动类型、行业、NEED、案例解析等关键词。',
        blockingPublish: false,
        needsHumanConfirmation: false,
        target,
      });
    }
    if (!Array.isArray(caseItem.faqItems) || caseItem.faqItems.length === 0) {
      addIssue({
        idHint: `case-${caseItem.id}-faq-empty`,
        module: 'cases',
        objectType: '案例解析',
        objectTitle: title,
        severity: 'medium',
        issue: 'FAQ 为空。',
        suggestion: '补充案例适用场景、动线、风险控制、预算判断等 FAQ。',
        blockingPublish: false,
        needsHumanConfirmation: true,
        target,
      });
    }
    if (caseItem.status === 'draft') {
      addIssue({
        idHint: `case-${caseItem.id}-draft`,
        module: 'cases',
        objectType: '案例解析',
        objectTitle: title,
        severity: 'medium',
        issue: '案例仍为草稿。',
        suggestion: '补齐素材和关键字段后再上架。',
        blockingPublish: false,
        needsHumanConfirmation: true,
        target,
      });
    }
  });
}

async function checkSolutions(addIssue: (input: Omit<QualityCheckItem, 'id'> & { idHint?: string }) => void) {
  const result = await readJsonFile<SolutionScene[]>(path.join(dataDir, 'solutions.json'));
  if (!result.data) {
    addFileReadIssue(addIssue, 'solutions.json', 'solutions', { type: 'solution' }, result.error ?? '未知错误');
    return;
  }
  const scenes = Array.isArray(result.data) ? result.data : [];
  const sceneSlugSet = new Set(scenes.map((scene) => scene.slug));
  defaultSceneSlugs.forEach((slug) => {
    if (!sceneSlugSet.has(slug)) {
      addIssue({
        idHint: `solution-${slug}-missing`,
        module: 'solutions',
        objectType: '场景',
        objectTitle: slug,
        severity: 'high',
        issue: '默认场景缺失。',
        suggestion: '恢复 7 个默认场景结构后再进入发布流程。',
        blockingPublish: true,
        needsHumanConfirmation: false,
        target: { type: 'solution', slug },
      });
    }
  });

  scenes.forEach((scene) => {
    const sceneTitle = normalizeText(scene.name) || scene.slug;
    if (!defaultSceneSlugs.includes(scene.slug)) {
      addIssue({
        idHint: `solution-${scene.slug}-unknown`,
        module: 'solutions',
        objectType: '场景',
        objectTitle: sceneTitle,
        severity: 'high',
        issue: '场景 slug 不在默认列表中。',
        suggestion: '确认是否需要保留该场景；如保留，需先扩展默认场景规则。',
        blockingPublish: true,
        needsHumanConfirmation: true,
        target: { type: 'solution', slug: scene.slug },
      });
    }
    if (isBlank(scene.name)) {
      addIssue({
        idHint: `solution-${scene.slug}-name-empty`,
        module: 'solutions',
        objectType: '场景',
        objectTitle: scene.slug,
        severity: 'high',
        issue: '场景名称为空。',
        suggestion: '补充后台和未来前台可读的场景名称。',
        blockingPublish: true,
        needsHumanConfirmation: false,
        target: { type: 'solution', slug: scene.slug },
      });
    }
    if (scene.enabled && isBlank(scene.description)) {
      addIssue({
        idHint: `solution-${scene.slug}-description-empty`,
        module: 'solutions',
        objectType: '场景',
        objectTitle: sceneTitle,
        severity: 'high',
        issue: '场景已启用，但说明为空。',
        suggestion: '补充场景说明，或先关闭该场景。',
        blockingPublish: true,
        needsHumanConfirmation: false,
        target: { type: 'solution', slug: scene.slug },
      });
    }
    if (scene.enabled && (!Array.isArray(scene.groups) || scene.groups.length === 0)) {
      addIssue({
        idHint: `solution-${scene.slug}-groups-empty`,
        module: 'solutions',
        objectType: '场景',
        objectTitle: sceneTitle,
        severity: scene.slug === 'video-digital-assets' ? 'high' : 'medium',
        issue: '该场景只有说明，没有案例组。',
        suggestion: scene.slug === 'video-digital-assets'
          ? '至少补 1 个视频或主图案例组，否则不建议发布该场景详情。'
          : '补充可公开案例组和素材；没有真实案例时可先只保留说明。',
        blockingPublish: scene.slug === 'video-digital-assets',
        needsHumanConfirmation: true,
        target: { type: 'solution', slug: scene.slug },
      });
    }
    scene.groups?.forEach((group) => {
      const groupTitle = normalizeText(group.title) || `案例组 ${group.id}`;
      const target = { type: 'solutionGroup' as const, id: group.id, slug: group.slug, category: scene.slug };
      if (group.enabled && isBlank(group.title)) {
        addIssue({
          idHint: `solution-group-${group.id}-title-empty`,
          module: 'solutions',
          objectType: '场景案例组',
          objectTitle: groupTitle,
          severity: 'high',
          issue: '启用的案例组标题为空。',
          suggestion: '补充案例组标题，或先关闭该案例组。',
          blockingPublish: true,
          needsHumanConfirmation: false,
          target,
        });
      }
      if (group.enabled && (!Array.isArray(group.items) || group.items.length === 0)) {
        addIssue({
          idHint: `solution-group-${group.id}-items-empty`,
          module: 'solutions',
          objectType: '场景案例组',
          objectTitle: groupTitle,
          severity: 'high',
          issue: '启用的案例组没有素材。',
          suggestion: '补充真实图片/视频，或先关闭该案例组。',
          blockingPublish: true,
          needsHumanConfirmation: true,
          target,
        });
      }
      if (!group.enabled && (!Array.isArray(group.items) || group.items.length === 0)) {
        addIssue({
          idHint: `solution-group-${group.id}-disabled-empty`,
          module: 'solutions',
          objectType: '场景案例组',
          objectTitle: groupTitle,
          severity: 'medium',
          issue: '该案例组未启用且没有素材。',
          suggestion: '确认后续是补素材启用，还是删除该草稿组。',
          blockingPublish: false,
          needsHumanConfirmation: true,
          target,
        });
      }
      if (scene.slug === 'video-digital-assets' && group.items.length > 1) {
        addIssue({
          idHint: `solution-group-${group.id}-too-many-video-items`,
          module: 'solutions',
          objectType: '场景案例组',
          objectTitle: groupTitle,
          severity: 'high',
          issue: '视频与数字资产场景每组超过 1 个素材。',
          suggestion: '保留 1 个视频或主图，其余拆成新组。',
          blockingPublish: true,
          needsHumanConfirmation: false,
          target,
        });
      }
      if (scene.slug !== 'video-digital-assets' && group.items.length > 7) {
        addIssue({
          idHint: `solution-group-${group.id}-too-many-image-items`,
          module: 'solutions',
          objectType: '场景案例组',
          objectTitle: groupTitle,
          severity: 'high',
          issue: '普通场景案例组超过 7 张图。',
          suggestion: '删减或拆分案例组，普通场景每组最多 7 张图。',
          blockingPublish: true,
          needsHumanConfirmation: false,
          target,
        });
      }
      if (isBlank(group.summary)) {
        addIssue({
          idHint: `solution-group-${group.id}-summary-empty`,
          module: 'solutions',
          objectType: '场景案例组',
          objectTitle: groupTitle,
          severity: 'medium',
          issue: '案例组摘要为空。',
          suggestion: '补充项目背景或图组说明，方便未来场景页展示。',
          blockingPublish: false,
          needsHumanConfirmation: false,
          target,
        });
      }
      group.items.forEach((item) => {
        if (isBlank(item.alt)) {
          addIssue({
            idHint: `solution-item-${item.id}-alt-empty`,
            module: 'solutions',
            objectType: '场景素材',
            objectTitle: item.mediaDisplayName || item.mediaFileName || groupTitle,
            severity: 'medium',
            issue: '素材 alt/GEO 描述为空。',
            suggestion: '补充画面内容和适用场景描述。',
            blockingPublish: false,
            needsHumanConfirmation: false,
            target,
          });
        }
        if (isBlank(item.caption)) {
          addIssue({
            idHint: `solution-item-${item.id}-caption-empty`,
            module: 'solutions',
            objectType: '场景素材',
            objectTitle: item.mediaDisplayName || item.mediaFileName || groupTitle,
            severity: 'medium',
            issue: '素材说明 caption 为空。',
            suggestion: '补充一短句说明图片/视频对应的场景价值。',
            blockingPublish: false,
            needsHumanConfirmation: false,
            target,
          });
        }
      });
    });
  });
}

async function checkMediaSeed(addIssue: (input: Omit<QualityCheckItem, 'id'> & { idHint?: string }) => void) {
  const seedPath = path.join(seedDir, 'public-home-media.seed.json');
  const seedResult = await readJsonFile<PublicMediaSeed[]>(seedPath);
  if (!seedResult.data) {
    addFileReadIssue(addIssue, 'public-home-media.seed.json', 'media', { type: 'mediaSeed' }, seedResult.error ?? '未知错误');
    return;
  }

  const seedItems = Array.isArray(seedResult.data) ? seedResult.data : [];
  const mediaResult = await readJsonFile<Record<string, { fileName?: string; url?: string }>>(mediaIndexPath);
  const mediaRecords = mediaResult.data ? Object.entries(mediaResult.data) : [];

  seedItems.forEach((seed, seedIndex) => {
    const title = normalizeText(seed.displayName) || normalizeText(seed.fileName) || `seed ${seedIndex + 1}`;
    const target = {
      type: 'mediaSeed' as const,
      id: normalizeText(seed.fileName) || String(seedIndex + 1),
      slug: normalizeText(seed.url),
      category: normalizeText(seed.category),
    };
    if (isBlank(seed.url)) {
      addIssue({
        idHint: `media-seed-${seedIndex}-url-empty`,
        module: 'media',
        objectType: 'public 媒体 seed',
        objectTitle: title,
        severity: 'high',
        issue: 'seed 中 url 为空。',
        suggestion: '补充可访问的 public 路径，或移除无效 seed。',
        blockingPublish: true,
        needsHumanConfirmation: true,
        target,
      });
    }
    if (isBlank(seed.fileType)) {
      addIssue({
        idHint: `media-seed-${seedIndex}-file-type-empty`,
        module: 'media',
        objectType: 'public 媒体 seed',
        objectTitle: title,
        severity: 'high',
        issue: 'seed 中 fileType 为空。',
        suggestion: '补充 image 或 video，确保导入媒体库时类型正确。',
        blockingPublish: true,
        needsHumanConfirmation: false,
        target,
      });
    }
    if (normalizeText(seed.category) === 'qrcode') {
      addIssue({
        idHint: `media-seed-${seed.fileName}-qrcode-confirm`,
        module: 'media',
        objectType: '二维码',
        objectTitle: title,
        severity: 'high',
        issue: '二维码资源有效性未确认。',
        suggestion: '发布前扫码确认账号有效、名称正确、适合作为正式对外入口。',
        blockingPublish: true,
        needsHumanConfirmation: true,
        target,
      });
    }
    if (normalizeText(seed.fileName) === 'hero-video.mp4') {
      addIssue({
        idHint: 'media-seed-hero-video-confirm',
        module: 'media',
        objectType: '首页视频 seed',
        objectTitle: title,
        severity: 'medium',
        issue: '首页视频 seed 需要确认是否为最终版本。',
        suggestion: '确认视频文件、大小和内容版本；正式发布前可补 poster。',
        blockingPublish: false,
        needsHumanConfirmation: true,
        target,
      });
    }
    if (normalizeText(seed.fileName) === 'logo.png') {
      addIssue({
        idHint: 'media-seed-logo-confirm',
        module: 'media',
        objectType: 'Logo seed',
        objectTitle: title,
        severity: normalizeText(seed.category) === 'temporary' ? 'medium' : 'low',
        issue: normalizeText(seed.category) === 'temporary'
          ? 'Logo 仍登记为 temporary，缺少站点资产分类。'
          : 'Logo 需要确认是否为最终品牌版本。',
        suggestion: '后续可扩展 site_asset 分类；发布前确认 logo 版本。',
        blockingPublish: false,
        needsHumanConfirmation: true,
        target,
      });
    }
    if (isBlank(seed.alt)) {
      addIssue({
        idHint: `media-seed-${seed.fileName}-alt-empty`,
        module: 'media',
        objectType: 'public 媒体 seed',
        objectTitle: title,
        severity: 'medium',
        issue: 'seed 中 alt 为空。',
        suggestion: '补充媒体 alt，导入媒体库后可直接进入 GEO 检查。',
        blockingPublish: false,
        needsHumanConfirmation: false,
        target,
      });
    }
    if (mediaResult.error || !mediaRecords.some(([fileName, record]) => (
      fileName === seed.fileName || normalizeText(record.fileName) === seed.fileName || normalizeText(record.url) === seed.url
    ))) {
      addIssue({
        idHint: `media-seed-${seed.fileName}-not-imported`,
        module: 'media',
        objectType: 'public 媒体 seed',
        objectTitle: title,
        severity: 'medium',
        issue: 'seed 已生成，但尚未确认进入媒体库。',
        suggestion: '后续通过 seed 导入工具或人工登记，让媒体库能统一管理该资源。',
        blockingPublish: false,
        needsHumanConfirmation: true,
        target,
      });
    }
  });
}

function addSeoCrossModuleIssues(
  items: QualityCheckItem[],
  addIssue: (input: Omit<QualityCheckItem, 'id'> & { idHint?: string }) => void,
) {
  const hasHomeEmpty = items.some((item) => item.id.includes('home-interactive-all-empty'));
  if (hasHomeEmpty) {
    addIssue({
      idHint: 'seo-home-interactive-empty',
      module: 'seo',
      objectType: 'GEO 发布风险',
      objectTitle: '首页视觉内容',
      severity: 'high',
      issue: '首页 12 图为空，首页内容证据不足。',
      suggestion: '补图或关闭模块后再进入静态发布。',
      blockingPublish: true,
      needsHumanConfirmation: true,
      target: { type: 'homeInteractive' },
    });
  }

  const hasPlaceholderArticles = items.some((item) => item.module === 'articles' && item.id.includes('content-placeholder'));
  if (hasPlaceholderArticles) {
    addIssue({
      idHint: 'seo-article-placeholders',
      module: 'seo',
      objectType: 'GEO 发布风险',
      objectTitle: '二选一怎么选栏目',
      severity: 'high',
      issue: '存在占位正文文章，不适合被搜索引擎抓取。',
      suggestion: '补齐正式正文后再发布对应栏目。',
      blockingPublish: true,
      needsHumanConfirmation: true,
      target: { type: 'article', category: 'choose_between_two' },
    });
  }

  const hasCaseMediaRisk = items.some((item) => item.module === 'cases' && (item.id.includes('images-empty') || item.id.includes('event-date-empty')));
  if (hasCaseMediaRisk) {
    addIssue({
      idHint: 'seo-case-evidence-risk',
      module: 'seo',
      objectType: 'GEO 发布风险',
      objectTitle: '案例解析',
      severity: 'high',
      issue: '案例缺真实素材或关键字段，证据链不足。',
      suggestion: '补封面、现场图、日期地点和公开权限后再发布案例页。',
      blockingPublish: true,
      needsHumanConfirmation: true,
      target: { type: 'case' },
    });
  }

  const hasEmptyEnabledGroup = items.some((item) => item.module === 'solutions' && item.id.includes('items-empty'));
  if (hasEmptyEnabledGroup) {
    addIssue({
      idHint: 'seo-solution-empty-enabled-group',
      module: 'seo',
      objectType: 'GEO 发布风险',
      objectTitle: '场景解决方案',
      severity: 'high',
      issue: '存在启用状态的空案例组。',
      suggestion: '补充素材或关闭案例组，避免发布空内容。',
      blockingPublish: true,
      needsHumanConfirmation: true,
      target: { type: 'solutionGroup' },
    });
  }

  const hasQrcodeRisk = items.some((item) => item.module === 'media' && item.objectType === '二维码');
  if (hasQrcodeRisk) {
    addIssue({
      idHint: 'seo-qrcode-confirm',
      module: 'seo',
      objectType: 'GEO 发布风险',
      objectTitle: '联系入口二维码',
      severity: 'high',
      issue: '二维码有效性未确认。',
      suggestion: '发布前确认二维码账号有效，避免正式页面导流错误。',
      blockingPublish: true,
      needsHumanConfirmation: true,
      target: { type: 'mediaSeed', category: 'qrcode' },
    });
  }

  const hasFaqMissing = items.some((item) => item.id.includes('faq-empty'));
  if (hasFaqMissing) {
    addIssue({
      idHint: 'seo-faq-missing',
      module: 'seo',
      objectType: 'GEO 发布建议',
      objectTitle: 'FAQ 覆盖',
      severity: 'medium',
      issue: '文章或案例缺少 FAQ。',
      suggestion: '补充问答后，未来发布系统可生成 FAQPage 结构化数据。',
      blockingPublish: false,
      needsHumanConfirmation: true,
      target: { type: 'article' },
    });
  }

  const hasAltMissing = items.some((item) => item.id.includes('alt-empty'));
  if (hasAltMissing) {
    addIssue({
      idHint: 'seo-alt-missing',
      module: 'seo',
      objectType: 'GEO 发布建议',
      objectTitle: '图片 alt',
      severity: 'medium',
      issue: '部分图片或媒体 seed 缺少 alt。',
      suggestion: '补充图片内容和业务场景描述，提升图片搜索和辅助理解。',
      blockingPublish: false,
      needsHumanConfirmation: false,
      target: { type: 'mediaSeed' },
    });
  }
}

function sortQualityItems(items: QualityCheckItem[]) {
  const severityOrder: Record<QualityCheckSeverity, number> = {
    high: 1,
    medium: 2,
    low: 3,
  };
  return [...items].sort((a, b) => (
    severityOrder[a.severity] - severityOrder[b.severity]
    || Number(b.blockingPublish) - Number(a.blockingPublish)
    || a.module.localeCompare(b.module)
    || a.objectTitle.localeCompare(b.objectTitle)
  ));
}

export async function runQualityCheck(): Promise<QualityCheckResult> {
  const { items, addIssue } = createIssueFactory();

  await checkHome(addIssue);
  await checkArticles(addIssue);
  await checkCases(addIssue);
  await checkSolutions(addIssue);
  await checkMediaSeed(addIssue);
  addSeoCrossModuleIssues(items, addIssue);

  const sortedItems = sortQualityItems(items);
  const summary = sortedItems.reduce((current, item) => ({
    total: current.total + 1,
    high: current.high + (item.severity === 'high' ? 1 : 0),
    medium: current.medium + (item.severity === 'medium' ? 1 : 0),
    low: current.low + (item.severity === 'low' ? 1 : 0),
    blockingPublish: current.blockingPublish + (item.blockingPublish ? 1 : 0),
  }), {
    total: 0,
    high: 0,
    medium: 0,
    low: 0,
    blockingPublish: 0,
  });

  return {
    summary,
    items: sortedItems,
    updatedAt: new Date().toISOString(),
  };
}
