import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type RouteSourceType = 'fixed' | 'solution' | 'article' | 'case';

export interface RouteManifestItem {
  path: string;
  outputPath: string;
  sourceType: RouteSourceType;
  sourceId: string;
  slug: string;
  title: string;
  description: string;
  canonicalPath: string;
  requiredChecks: string[];
  published: boolean;
  enabled: boolean;
  shouldGenerate: boolean;
  skipReason: string;
  errors: string[];
  reason?: string;
}

export interface RouteManifest {
  generatedAt: string;
  siteBaseUrl: string;
  routes: RouteManifestItem[];
  skippedRoutes: RouteManifestItem[];
  sourceSummary: Record<RouteSourceType, number>;
}

type StaticRouteInput = Omit<
  RouteManifestItem,
  'published' | 'enabled' | 'shouldGenerate' | 'skipReason' | 'errors'
>;

const SKIP_REASONS = {
  solutionDisabled: 'solution disabled',
  enabledSolutionNoReactRouteMapping: 'enabled solution has no React route mapping',
  articleNotPublished: 'article not published',
  articleContentTooWeak: 'article content too weak for GEO prerender',
  unsupportedArticleCategory: 'unsupported article category',
  publishedArticleNoReactRouteMapping: 'published article has no React route mapping',
  caseNotPublished: 'case not published',
  publishedCaseNoReactRouteMapping: 'published case has no React route mapping',
  displayOnlyDuplicateCaseRoute: 'display-only duplicate case route',
  legacyVerifiedRoute: 'legacy verified route kept until CMS content takeover',
} as const;

interface SolutionSceneSource {
  slug?: unknown;
  name?: unknown;
  description?: unknown;
  sortOrder?: unknown;
  enabled?: unknown;
}

interface ArticleSource {
  id?: unknown;
  title?: unknown;
  slug?: unknown;
  category?: unknown;
  summary?: unknown;
  sortOrder?: unknown;
  status?: unknown;
  seoTitle?: unknown;
  seoDescription?: unknown;
}

interface CaseSource {
  id?: unknown;
  title?: unknown;
  slug?: unknown;
  summary?: unknown;
  sortOrder?: unknown;
  status?: unknown;
  seoTitle?: unknown;
  seoDescription?: unknown;
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const solutionsDataPath = join(scriptDir, '../../data/solutions.json');
const articlesDataPath = join(scriptDir, '../../data/articles.json');
const casesDataPath = join(scriptDir, '../../data/cases.json');

const staticRoutes: StaticRouteInput[] = [
  {
    path: '/',
    outputPath: 'index.html',
    sourceType: 'fixed',
    sourceId: 'home',
    slug: 'home',
    title: 'NEED 尼德公关｜企业活动策划与现场落地',
    description:
      'NEED 尼德公关服务企业活动策划与落地，覆盖年会、企业家庭日、客户答谢、品牌活动等场景，重视需求判断、预算控制与现场交付。',
    canonicalPath: '/',
    requiredChecks: ['YOU NEED. WE BUILD.', '尼德公关', '怎么选活动公司'],
  },
  {
    path: '/solutions',
    outputPath: 'solutions/index.html',
    sourceType: 'fixed',
    sourceId: 'solutions-index',
    slug: 'solutions',
    title: '场景方案｜NEED 尼德公关',
    description:
      '按企业家庭日、年会活动、客户答谢、品牌活动等不同场景，梳理活动目标、执行重点与落地判断，帮助企业在预算内拿到更确定的现场结果。',
    canonicalPath: '/solutions',
    requiredChecks: ['场景方案', '企业家庭日', '年会活动'],
  },
  {
    path: '/solutions/family-day',
    outputPath: 'solutions/family-day/index.html',
    sourceType: 'solution',
    sourceId: 'family-day',
    slug: 'family-day',
    title: '企业家庭日活动方案｜NEED 尼德公关',
    description:
      '企业家庭日活动不只是员工福利，更是企业文化、家属认同和组织温度的现场表达。NEED 尼德公关从目标、动线、互动体验和现场执行角度梳理家庭日活动的落地方法。',
    canonicalPath: '/solutions/family-day',
    requiredChecks: ['费斯托 2025 家庭日', '费跃百年，趣超超越', '家庭日', '联系我们探讨项目'],
  },
  {
    path: '/solutions/salon',
    outputPath: 'solutions/salon/index.html',
    sourceType: 'solution',
    sourceId: 'salon',
    slug: 'salon',
    title: '客户答谢&精品沙龙｜NEED 尼德公关',
    description:
      '针对高净值客户或核心渠道商的答谢与沙龙，重点不在于规模，而在于尊贵感与价值交流。它是提升客户粘性、促成深度合作的关键触点。',
    canonicalPath: '/solutions/salon',
    requiredChecks: ['客户答谢&精品沙龙', '高净值客户', '深度互动'],
  },
  {
    path: '/solutions/annual',
    outputPath: 'solutions/annual/index.html',
    sourceType: 'solution',
    sourceId: 'annual',
    slug: 'annual',
    title: '年会活动与企业文化｜NEED 尼德公关',
    description:
      '年会是企业一年一度最重要的内部盛会，它承载着总结过往、表彰先进、提振士气以及宣贯新年战略的复合功能。',
    canonicalPath: '/solutions/annual',
    requiredChecks: ['年会活动与企业文化', '企业向心力', '提振士气'],
  },
  {
    path: '/solutions/exhibition',
    outputPath: 'solutions/exhibition/index.html',
    sourceType: 'solution',
    sourceId: 'exhibition',
    slug: 'exhibition',
    title: '商业美陈与展览｜NEED 尼德公关',
    description:
      '在碎片化时代，线下的真实空间体验是最具冲击力的品牌沟通语言。美陈与展览不仅是吸引流量的工具，更是品牌质感的外延。',
    canonicalPath: '/solutions/exhibition',
    requiredChecks: ['商业美陈与展览', '空间即媒介', '品牌核心视觉体验'],
  },
  {
    path: '/solutions/video',
    outputPath: 'solutions/video/index.html',
    sourceType: 'solution',
    sourceId: 'video',
    slug: 'video',
    title: '视频与数字资产｜NEED 尼德公关',
    description:
      '一场百万级的活动，如果不通过影像记录，它的影响力将随着离场而消散。视频与数字资产是企业传播的长尾引擎。',
    canonicalPath: '/solutions/video',
    requiredChecks: ['视频与数字资产', '长效复用', '活动背后的核心价值'],
  },
  {
    path: '/solutions/forum',
    outputPath: 'solutions/forum/index.html',
    sourceType: 'solution',
    sourceId: 'forum',
    slug: 'forum',
    title: '学术与专业论坛｜NEED 尼德公关',
    description:
      '无论是医学峰会、科技论坛还是行业趋势发布，高规格的专业论坛是奠定企业行业话语权、展现专业深度的绝对核心现场。',
    canonicalPath: '/solutions/forum',
    requiredChecks: ['学术与专业论坛', '行业智慧', '高规格思想交锋平台'],
  },
  {
    path: '/solutions/other',
    outputPath: 'solutions/other/index.html',
    sourceType: 'solution',
    sourceId: 'other',
    slug: 'other',
    title: '其他特殊场景需求｜NEED 尼德公关',
    description:
      '企业的需求永远是在不断进化和变体中的。不论是出海峰会、大型厂矿奠基、极寒环境下的产品测试发布，还是与品牌调性深度绑定的跨界大秀。',
    canonicalPath: '/solutions/other',
    requiredChecks: ['其他特殊场景需求', '灵活定制', '突破常规'],
  },
  {
    path: '/contact',
    outputPath: 'contact/index.html',
    sourceType: 'fixed',
    sourceId: 'contact',
    slug: 'contact',
    title: '联系 NEED 尼德公关｜联系方式与交付资产',
    description:
      '联系 NEED 尼德公关，了解企业活动策划、年会、家庭日、客户答谢、品牌活动等项目合作方式，并查看团队自有设备、制作、印刷与特装交付资产。',
    canonicalPath: '/contact',
    requiredChecks: ['CONTACT', 'HQ Location', 'needpr@163.com', 'Hardcore Assets'],
  },
  {
    path: '/how-to-choose',
    outputPath: 'how-to-choose/index.html',
    sourceType: 'fixed',
    sourceId: 'how-to-choose-index',
    slug: 'how-to-choose',
    title: '怎么选活动公司｜NEED 尼德公关',
    description:
      '选择活动公司不只看案例是否好看，更要看对方能否理解需求、判断重点、控制预算并把现场稳稳落地。NEED 尼德公关从需求、方案、预算与执行角度梳理选择方法。',
    canonicalPath: '/how-to-choose',
    requiredChecks: ['怎么选活动公司', '理解需求', '判断力', '执行力'],
  },
  {
    path: '/how-to-choose/01',
    outputPath: 'how-to-choose/01/index.html',
    sourceType: 'article',
    sourceId: '01',
    slug: '01',
    title: '真正靠谱的活动执行，不是现场救火能力，而是前面少埋雷｜NEED 尼德公关',
    description:
      '很多人把现场救火能力当成活动执行的核心能力，但对企业活动来说，真正靠谱的执行，是前面少埋雷、流程更顺、风险更早被看见。',
    canonicalPath: '/how-to-choose/01',
    requiredChecks: ['真正靠谱的活动执行', '不是现场救火能力', '前面少埋雷'],
  },
  {
    path: '/how-to-choose/02',
    outputPath: 'how-to-choose/02/index.html',
    sourceType: 'article',
    sourceId: '02',
    slug: '02',
    title: '为什么有些方案看起来很好，现场却不成立｜NEED 尼德公关',
    description:
      '很多活动方案在提案里很好看，到了现场却不成立。NEED 从时间、场地、流程、执行条件和判断误差五个角度，解释其中原因。',
    canonicalPath: '/how-to-choose/02',
    requiredChecks: ['方案看起来很好', '现场却不成立', '时间', '场地'],
  },
  {
    path: '/how-to-choose/03',
    outputPath: 'how-to-choose/03/index.html',
    sourceType: 'article',
    sourceId: '03',
    slug: '03',
    title: '为什么一场活动开始前，先把目标判断清楚更重要｜NEED 尼德公关',
    description:
      '很多活动的问题，不是执行不努力，而是一开始目标没判断清楚。NEED 从企业活动策划与执行的角度，解释为什么目标判断是方案成立的第一步。',
    canonicalPath: '/how-to-choose/03',
    requiredChecks: ['目标判断清楚', '活动开始前', '企业活动策划与执行'],
  },
  {
    path: '/how-to-choose/04',
    outputPath: 'how-to-choose/04/index.html',
    sourceType: 'article',
    sourceId: '04',
    slug: '04',
    title: '为什么预算判断，比一味堆创意更重要｜NEED 尼德公关',
    description:
      '很多活动不是没有创意，而是预算花错了地方。NEED 从企业活动策划与执行的角度，解释为什么预算判断比一味堆创意更重要。',
    canonicalPath: '/how-to-choose/04',
    requiredChecks: ['预算判断', '一味堆创意', '预算花错了地方'],
  },
  {
    path: '/choose-between-two',
    outputPath: 'choose-between-two/index.html',
    sourceType: 'fixed',
    sourceId: 'choose-between-two-index',
    slug: 'choose-between-two',
    title: '两家活动公司二选一怎么选｜NEED 尼德公关',
    description:
      '当两家活动公司方案都看起来不错时，真正该比较的不是谁更会包装，而是谁更理解需求、判断更清楚、执行更稳。NEED 尼德公关梳理活动公司二选一的判断方法。',
    canonicalPath: '/choose-between-two',
    requiredChecks: ['二选一怎么选', '谁更理解需求', '判断更清楚', '执行更稳'],
  },
  {
    path: '/cases/hyundai-family-day',
    outputPath: 'cases/hyundai-family-day/index.html',
    sourceType: 'case',
    sourceId: 'hyundai-family-day',
    slug: 'hyundai-family-day',
    title: '制造研发中心的家庭日，不只是让孩子玩一天｜NEED 尼德公关',
    description:
      '从荣誉致敬、亲子互动到开放日动线，NEED 为现代汽车研发中心打造了一场围绕“家庭”与“感恩”的企业家庭日活动。',
    canonicalPath: '/cases/hyundai-family-day',
    requiredChecks: ['制造研发中心的家庭日', '现代汽车研发中心', '家庭日开放日', '荣誉致敬'],
  },
];

const solutionSlugToReactPath: Record<string, string> = {
  'family-day': '/solutions/family-day',
  'client-appreciation': '/solutions/salon',
  'annual-meeting': '/solutions/annual',
  'commercial-display': '/solutions/exhibition',
  'video-digital-assets': '/solutions/video',
  'academic-forum': '/solutions/forum',
  other: '/solutions/other',
};

const fixedRoutePaths = new Set(['/', '/solutions', '/contact', '/how-to-choose', '/choose-between-two']);

const fixedRoutes = staticRoutes.filter((route) => fixedRoutePaths.has(route.path));
const contentRoutes = staticRoutes.filter((route) => !fixedRoutePaths.has(route.path));
const solutionRouteTemplates = contentRoutes.filter((route) => route.sourceType === 'solution');
const articleRouteTemplates = contentRoutes.filter((route) => route.sourceType === 'article');
const caseRouteTemplates = contentRoutes.filter((route) => route.sourceType === 'case');

function getRouteByPath(routes: StaticRouteInput[], path: string) {
  const route = routes.find((item) => item.path === path);

  if (!route) {
    throw new Error(`Missing route manifest item for ${path}`);
  }

  return route;
}

function buildStaticRoutes(
  solutionRoutes: StaticRouteInput[],
  articleRoutes: StaticRouteInput[],
  caseRoutes: StaticRouteInput[],
): StaticRouteInput[] {
  return [
    getRouteByPath(fixedRoutes, '/'),
    getRouteByPath(fixedRoutes, '/solutions'),
    ...solutionRoutes,
    getRouteByPath(fixedRoutes, '/contact'),
    getRouteByPath(fixedRoutes, '/how-to-choose'),
    ...articleRoutes,
    getRouteByPath(fixedRoutes, '/choose-between-two'),
    ...caseRoutes,
  ];
}

function toManifestItem(route: StaticRouteInput): RouteManifestItem {
  return {
    ...route,
    published: true,
    enabled: true,
    shouldGenerate: true,
    skipReason: '',
    errors: [],
  };
}

function markLegacyVerifiedRoute(route: StaticRouteInput): StaticRouteInput {
  return {
    ...route,
    reason: SKIP_REASONS.legacyVerifiedRoute,
  };
}

function countRoutesBySourceType(routes: RouteManifestItem[]): Record<RouteSourceType, number> {
  return routes.reduce<Record<RouteSourceType, number>>(
    (summary, route) => ({
      ...summary,
      [route.sourceType]: summary[route.sourceType] + 1,
    }),
    {
      fixed: 0,
      solution: 0,
      article: 0,
      case: 0,
    },
  );
}

function inferOutputPath(path: string): string {
  if (path === '/') {
    return 'index.html';
  }

  return `${path.replace(/^\/+/, '')}/index.html`;
}

function readSolutionScenes(): SolutionSceneSource[] {
  const rawContent = readFileSync(solutionsDataPath, 'utf8');
  const parsedContent = JSON.parse(rawContent) as unknown;

  if (!Array.isArray(parsedContent)) {
    throw new Error('Expected server/data/solutions.json to contain an array of solution scenes');
  }

  return parsedContent;
}

function readArticles(): ArticleSource[] {
  const rawContent = readFileSync(articlesDataPath, 'utf8');
  const parsedContent = JSON.parse(rawContent) as unknown;

  if (!Array.isArray(parsedContent)) {
    throw new Error('Expected server/data/articles.json to contain an array of articles');
  }

  return parsedContent;
}

function readCases(): CaseSource[] {
  const rawContent = readFileSync(casesDataPath, 'utf8');
  const parsedContent = JSON.parse(rawContent) as unknown;

  if (!Array.isArray(parsedContent)) {
    throw new Error('Expected server/data/cases.json to contain an array of cases');
  }

  return parsedContent;
}

function getSolutionTemplateByPath(path: string): StaticRouteInput | undefined {
  return solutionRouteTemplates.find((route) => route.path === path);
}

function getArticleTemplateByPath(path: string): StaticRouteInput | undefined {
  return articleRouteTemplates.find((route) => route.path === path);
}

function getCaseTemplateByPath(path: string): StaticRouteInput | undefined {
  return caseRouteTemplates.find((route) => route.path === path);
}

function getSourceText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function getSourceNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function toSkippedSolutionRoute(
  scene: SolutionSceneSource,
  slug: string,
  path: string,
  skipReason: string,
  errors: string[],
): RouteManifestItem {
  return {
    path,
    outputPath: inferOutputPath(path),
    sourceType: 'solution',
    sourceId: slug,
    slug,
    title: getSourceText(scene.name) || `${slug} | NEED`,
    description: getSourceText(scene.description),
    canonicalPath: path,
    requiredChecks: [],
    published: true,
    enabled: scene.enabled === true,
    shouldGenerate: false,
    skipReason,
    errors,
  };
}

function toSkippedArticleRoute(article: ArticleSource, path: string, skipReason: string, errors: string[]): RouteManifestItem {
  const id = getSourceText(article.id) || 'unknown-article';
  const slug = getSourceText(article.slug) || id;

  return {
    path,
    outputPath: inferOutputPath(path),
    sourceType: 'article',
    sourceId: id,
    slug,
    title: getSourceText(article.seoTitle) || getSourceText(article.title) || `${slug} | NEED`,
    description: getSourceText(article.seoDescription) || getSourceText(article.summary),
    canonicalPath: path,
    requiredChecks: [],
    published: article.status === 'published',
    enabled: true,
    shouldGenerate: false,
    skipReason,
    errors,
  };
}

function toSkippedCaseRoute(caseItem: CaseSource, path: string, skipReason: string, errors: string[]): RouteManifestItem {
  const id = getSourceText(caseItem.id) || 'unknown-case';
  const slug = getSourceText(caseItem.slug) || id;

  return {
    path,
    outputPath: inferOutputPath(path),
    sourceType: 'case',
    sourceId: id,
    slug,
    title: getSourceText(caseItem.seoTitle) || getSourceText(caseItem.title) || `${slug} | NEED`,
    description: getSourceText(caseItem.seoDescription) || getSourceText(caseItem.summary),
    canonicalPath: path,
    requiredChecks: [],
    published: caseItem.status === 'published',
    enabled: true,
    shouldGenerate: false,
    skipReason,
    errors,
  };
}

function buildSolutionRoutesFromSource(): {
  routes: StaticRouteInput[];
  skippedRoutes: RouteManifestItem[];
} {
  const routes: StaticRouteInput[] = [];
  const skippedRoutes: RouteManifestItem[] = [];

  const scenes = readSolutionScenes().sort(
    (left, right) => getSourceNumber(left.sortOrder) - getSourceNumber(right.sortOrder),
  );

  for (const scene of scenes) {
    const slug = getSourceText(scene.slug);

    if (!slug) {
      skippedRoutes.push(
        toSkippedSolutionRoute(scene, 'unknown-solution', '/solutions/unknown-solution', SKIP_REASONS.enabledSolutionNoReactRouteMapping, [
          'Enabled solution scene is missing a valid slug, so no React route mapping can be resolved',
        ]),
      );
      continue;
    }

    const mappedPath = solutionSlugToReactPath[slug];
    const fallbackPath = mappedPath || `/solutions/${slug}`;

    if (scene.enabled === false) {
      skippedRoutes.push(toSkippedSolutionRoute(scene, slug, fallbackPath, SKIP_REASONS.solutionDisabled, []));
      continue;
    }

    if (!mappedPath) {
      skippedRoutes.push(
        toSkippedSolutionRoute(scene, slug, fallbackPath, SKIP_REASONS.enabledSolutionNoReactRouteMapping, [
          `Enabled solution "${slug}" has no React route mapping`,
        ]),
      );
      continue;
    }

    const template = getSolutionTemplateByPath(mappedPath);

    if (!template) {
      skippedRoutes.push(
        toSkippedSolutionRoute(scene, slug, mappedPath, SKIP_REASONS.enabledSolutionNoReactRouteMapping, [
          `Enabled solution "${slug}" maps to "${mappedPath}", but no verified React route manifest template exists`,
        ]),
      );
      continue;
    }

    routes.push({
      ...template,
      path: mappedPath,
      outputPath: inferOutputPath(mappedPath),
      sourceId: slug,
      slug,
      description: getSourceText(scene.description) || template.description,
      canonicalPath: mappedPath,
    });
  }

  return {
    routes,
    skippedRoutes,
  };
}

const howToChooseArticlePathById: Record<string, string> = {
  'public-how-05': '/how-to-choose/01',
  'public-how-06': '/how-to-choose/02',
  'public-how-07': '/how-to-choose/03',
  'public-how-08': '/how-to-choose/04',
};

const howToChooseArticlePathBySlug: Record<string, string> = {
  'how-to-choose-understands-your-brief': '/how-to-choose/01',
  'how-to-judge-event-agency-judgment': '/how-to-choose/02',
  'why-good-event-cases-may-not-fit-you': '/how-to-choose/03',
  'why-events-fail-in-execution-not-creative': '/how-to-choose/04',
};

const howToChooseArticlePathBySortOrder: Record<number, string> = {
  1: '/how-to-choose/01',
  2: '/how-to-choose/02',
  3: '/how-to-choose/03',
  4: '/how-to-choose/04',
};

function resolveHowToChooseArticlePath(article: ArticleSource): string {
  const id = getSourceText(article.id);
  const slug = getSourceText(article.slug);
  const sortOrder = getSourceNumber(article.sortOrder);

  return howToChooseArticlePathById[id] || howToChooseArticlePathBySlug[slug] || howToChooseArticlePathBySortOrder[sortOrder] || '';
}

function resolveArticleFallbackPath(article: ArticleSource): string {
  const category = getSourceText(article.category);
  const sortOrder = getSourceNumber(article.sortOrder);
  const slug = getSourceText(article.slug) || getSourceText(article.id) || 'unknown-article';

  if (category === 'choose_between_two' && Number.isInteger(sortOrder) && sortOrder >= 1) {
    return `/choose-between-two/${String(sortOrder).padStart(2, '0')}`;
  }

  if (category === 'how_to_choose') {
    return resolveHowToChooseArticlePath(article) || `/how-to-choose/${slug}`;
  }

  return `/articles/${slug}`;
}

function buildArticleRoutesFromSource(): {
  routes: StaticRouteInput[];
  skippedRoutes: RouteManifestItem[];
} {
  const routes: StaticRouteInput[] = [];
  const skippedRoutes: RouteManifestItem[] = [];

  const articles = readArticles()
    .map((article, index) => ({ article, index }))
    .sort(
      (left, right) =>
        getSourceNumber(left.article.sortOrder) - getSourceNumber(right.article.sortOrder) || left.index - right.index,
    )
    .map(({ article }) => article);

  for (const article of articles) {
    const category = getSourceText(article.category);
    const path = resolveArticleFallbackPath(article);

    if (article.status !== 'published') {
      skippedRoutes.push(toSkippedArticleRoute(article, path, SKIP_REASONS.articleNotPublished, []));
      continue;
    }

    if (category === 'choose_between_two') {
      skippedRoutes.push(
        toSkippedArticleRoute(article, path, SKIP_REASONS.articleContentTooWeak, [
          'intentionally skipped until content is completed',
        ]),
      );
      continue;
    }

    if (category !== 'how_to_choose') {
      skippedRoutes.push(toSkippedArticleRoute(article, path, SKIP_REASONS.unsupportedArticleCategory, []));
      continue;
    }

    const mappedPath = resolveHowToChooseArticlePath(article);

    if (!mappedPath) {
      skippedRoutes.push(
        toSkippedArticleRoute(article, path, SKIP_REASONS.publishedArticleNoReactRouteMapping, [
          `Published article "${getSourceText(article.id) || getSourceText(article.slug) || 'unknown-article'}" has no verified React route mapping`,
        ]),
      );
      continue;
    }

    const template = getArticleTemplateByPath(mappedPath);

    if (!template) {
      skippedRoutes.push(
        toSkippedArticleRoute(article, mappedPath, SKIP_REASONS.publishedArticleNoReactRouteMapping, [
          `Published article maps to "${mappedPath}", but no verified React route manifest template exists`,
        ]),
      );
      continue;
    }

    routes.push({
      ...template,
      path: mappedPath,
      outputPath: inferOutputPath(mappedPath),
      sourceId: getSourceText(article.id) || template.sourceId,
      slug: getSourceText(article.slug) || getSourceText(article.id) || template.slug,
      description: getSourceText(article.seoDescription) || getSourceText(article.summary) || template.description,
      canonicalPath: mappedPath,
    });
  }

  return {
    routes: routes.length > 0 ? routes : articleRouteTemplates.map(markLegacyVerifiedRoute),
    skippedRoutes,
  };
}

const casePathBySlug: Record<string, string> = {
  'hyundai-family-day': '/cases/hyundai-family-day',
};

const displayOnlyDuplicateCaseSlugs = new Set(['hyundai-family-day-2', 'hyundai-family-day-3']);

function resolveCaseFallbackPath(caseItem: CaseSource): string {
  const slug = getSourceText(caseItem.slug) || getSourceText(caseItem.id) || 'unknown-case';

  return casePathBySlug[slug] || `/cases/${slug}`;
}

function buildCaseRoutesFromSource(): {
  routes: StaticRouteInput[];
  skippedRoutes: RouteManifestItem[];
} {
  const routes: StaticRouteInput[] = [];
  const skippedRoutes: RouteManifestItem[] = [];

  const cases = readCases()
    .map((caseItem, index) => ({ caseItem, index }))
    .sort(
      (left, right) =>
        getSourceNumber(left.caseItem.sortOrder) - getSourceNumber(right.caseItem.sortOrder) || left.index - right.index,
    )
    .map(({ caseItem }) => caseItem);

  for (const caseItem of cases) {
    const slug = getSourceText(caseItem.slug);
    const path = resolveCaseFallbackPath(caseItem);

    if (displayOnlyDuplicateCaseSlugs.has(slug)) {
      skippedRoutes.push(toSkippedCaseRoute(caseItem, path, SKIP_REASONS.displayOnlyDuplicateCaseRoute, []));
      continue;
    }

    if (caseItem.status !== 'published') {
      skippedRoutes.push(toSkippedCaseRoute(caseItem, path, SKIP_REASONS.caseNotPublished, []));
      continue;
    }

    const mappedPath = casePathBySlug[slug];

    if (!mappedPath) {
      skippedRoutes.push(
        toSkippedCaseRoute(caseItem, path, SKIP_REASONS.publishedCaseNoReactRouteMapping, [
          `Published case "${getSourceText(caseItem.id) || slug || 'unknown-case'}" has no React route mapping`,
        ]),
      );
      continue;
    }

    const template = getCaseTemplateByPath(mappedPath);

    if (!template) {
      skippedRoutes.push(
        toSkippedCaseRoute(caseItem, mappedPath, SKIP_REASONS.publishedCaseNoReactRouteMapping, [
          `Published case "${getSourceText(caseItem.id) || slug || 'unknown-case'}" maps to "${mappedPath}", but no verified React route manifest template exists`,
        ]),
      );
      continue;
    }

    routes.push({
      ...template,
      path: mappedPath,
      outputPath: inferOutputPath(mappedPath),
      sourceId: getSourceText(caseItem.id) || template.sourceId,
      slug,
      description: getSourceText(caseItem.seoDescription) || getSourceText(caseItem.summary) || template.description,
      canonicalPath: mappedPath,
    });
  }

  return {
    routes: routes.length > 0 ? routes : caseRouteTemplates.map(markLegacyVerifiedRoute),
    skippedRoutes,
  };
}

export function getStaticRouteManifest(siteBaseUrl: string): RouteManifest {
  const { routes: solutionRoutes, skippedRoutes } = buildSolutionRoutesFromSource();
  const { routes: articleRoutes, skippedRoutes: skippedArticleRoutes } = buildArticleRoutesFromSource();
  const { routes: caseRoutes, skippedRoutes: skippedCaseRoutes } = buildCaseRoutesFromSource();
  const routes = buildStaticRoutes(solutionRoutes, articleRoutes, caseRoutes).map(toManifestItem);

  return {
    generatedAt: new Date().toISOString(),
    siteBaseUrl,
    routes,
    skippedRoutes: [...skippedRoutes, ...skippedArticleRoutes, ...skippedCaseRoutes],
    sourceSummary: countRoutesBySourceType(routes),
  };
}
