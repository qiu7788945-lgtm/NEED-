import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

interface RouteConfig {
  path: string;
  outputFile: string;
  metadata: {
    title: string;
    description: string;
  };
  requiredChecks: Array<{
    label: string;
    test: (normalizedBodyText: string, normalizedHtml: string) => boolean;
  }>;
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const outputDir = path.join(projectRoot, 'dist-prerender');
const baseUrl = process.env.PRERENDER_BASE_URL || 'http://localhost:3000';
const SITE_BASE_URL = process.env.SITE_BASE_URL || 'http://localhost:3000';
const serviceChecks = [
  {
    url: 'http://localhost:4000',
    unavailableMessage: 'Backend API is not reachable at http://localhost:4000',
    runCommand: 'Please run: npm.cmd run dev:server',
  },
  {
    url: 'http://localhost:3000',
    unavailableMessage: 'Frontend Vite app is not reachable at http://localhost:3000',
    runCommand: 'Please run: npm.cmd run dev',
  },
];
const routes: RouteConfig[] = [
  {
    path: '/',
    outputFile: 'index.html',
    metadata: {
      title: 'NEED 尼德公关｜企业活动策划与现场落地',
      description:
        'NEED 尼德公关服务企业活动策划与落地，覆盖年会、企业家庭日、客户答谢、品牌活动等场景，重视需求判断、预算控制与现场交付。',
    },
    requiredChecks: [
      {
        label: 'YOU NEED. WE BUILD.',
        test: (bodyText, html) => /YOU\s+NEED\.?\s+WE\s+BUILD\.?/i.test(bodyText) || /YOU\s+NEED\.?\s+WE\s+BUILD\.?/i.test(html),
      },
      {
        label: '尼德公关',
        test: (bodyText, html) => bodyText.includes('尼德公关') || html.includes('尼德公关'),
      },
      {
        label: '怎么选活动公司',
        test: (bodyText, html) => bodyText.includes('怎么选活动公司') || html.includes('怎么选活动公司'),
      },
    ],
  },
  {
    path: '/solutions',
    outputFile: path.join('solutions', 'index.html'),
    metadata: {
      title: '场景方案｜NEED 尼德公关',
      description:
        '按企业家庭日、年会活动、客户答谢、品牌活动等不同场景，梳理活动目标、执行重点与落地判断，帮助企业在预算内拿到更确定的现场结果。',
    },
    requiredChecks: [
      {
        label: '场景方案',
        test: (bodyText, html) => bodyText.includes('场景方案') || html.includes('场景方案'),
      },
      {
        label: '企业家庭日',
        test: (bodyText, html) => bodyText.includes('企业家庭日') || html.includes('企业家庭日'),
      },
      {
        label: '年会活动',
        test: (bodyText, html) => bodyText.includes('年会活动') || html.includes('年会活动'),
      },
    ],
  },
  {
    path: '/solutions/family-day',
    outputFile: path.join('solutions', 'family-day', 'index.html'),
    metadata: {
      title: '企业家庭日活动方案｜NEED 尼德公关',
      description:
        '企业家庭日活动不只是员工福利，更是企业文化、家属认同和组织温度的现场表达。NEED 尼德公关从目标、动线、互动体验和现场执行角度梳理家庭日活动的落地方法。',
    },
    requiredChecks: [
      {
        label: '费斯托 2025 家庭日',
        test: (bodyText, html) => bodyText.includes('费斯托 2025 家庭日') || html.includes('费斯托 2025 家庭日'),
      },
      {
        label: '费跃百年，趣超超越',
        test: (bodyText, html) => bodyText.includes('费跃百年，趣超超越') || html.includes('费跃百年，趣超超越'),
      },
      {
        label: '家庭日',
        test: (bodyText, html) => bodyText.includes('家庭日') || html.includes('家庭日'),
      },
      {
        label: '联系我们探讨项目',
        test: (bodyText, html) => bodyText.includes('联系我们探讨项目') || html.includes('联系我们探讨项目'),
      },
    ],
  },
  {
    path: '/contact',
    outputFile: path.join('contact', 'index.html'),
    metadata: {
      title: '联系 NEED 尼德公关｜联系方式与交付资产',
      description:
        '联系 NEED 尼德公关，了解企业活动策划、年会、家庭日、客户答谢、品牌活动等项目合作方式，并查看团队自有设备、制作、印刷与特装交付资产。',
    },
    requiredChecks: [
      {
        label: 'CONTACT',
        test: (bodyText, html) => bodyText.includes('CONTACT') || html.includes('CONTACT'),
      },
      {
        label: 'HQ Location',
        test: (bodyText, html) => bodyText.includes('HQ Location') || html.includes('HQ Location'),
      },
      {
        label: 'needpr@163.com',
        test: (bodyText, html) => bodyText.includes('needpr@163.com') || html.includes('needpr@163.com'),
      },
      {
        label: 'Hardcore Assets',
        test: (bodyText, html) => bodyText.includes('Hardcore Assets') || html.includes('Hardcore Assets'),
      },
    ],
  },
  {
    path: '/how-to-choose',
    outputFile: path.join('how-to-choose', 'index.html'),
    metadata: {
      title: '怎么选活动公司｜NEED 尼德公关',
      description:
        '选择活动公司不只看案例是否好看，更要看对方能否理解需求、判断重点、控制预算并把现场稳稳落地。NEED 尼德公关从需求、方案、预算与执行角度梳理选择方法。',
    },
    requiredChecks: [
      {
        label: '怎么选活动公司',
        test: (bodyText, html) => bodyText.includes('怎么选活动公司') || html.includes('怎么选活动公司'),
      },
      {
        label: '理解需求',
        test: (bodyText, html) => bodyText.includes('理解需求') || html.includes('理解需求'),
      },
      {
        label: '判断力',
        test: (bodyText, html) => bodyText.includes('判断力') || html.includes('判断力'),
      },
      {
        label: '执行力',
        test: (bodyText, html) => bodyText.includes('执行力') || html.includes('执行力'),
      },
    ],
  },
  {
    path: '/how-to-choose/01',
    outputFile: path.join('how-to-choose', '01', 'index.html'),
    metadata: {
      title: '真正靠谱的活动执行，不是现场救火能力，而是前面少埋雷｜NEED 尼德公关',
      description: '很多人把现场救火能力当成活动执行的核心能力，但对企业活动来说，真正靠谱的执行，是前面少埋雷、流程更顺、风险更早被看见。',
    },
    requiredChecks: [
      {
        label: '真正靠谱的活动执行',
        test: (bodyText, html) => bodyText.includes('真正靠谱的活动执行') || html.includes('真正靠谱的活动执行'),
      },
      {
        label: '不是现场救火能力',
        test: (bodyText, html) => bodyText.includes('不是现场救火能力') || html.includes('不是现场救火能力'),
      },
      {
        label: '前面少埋雷',
        test: (bodyText, html) => bodyText.includes('前面少埋雷') || html.includes('前面少埋雷'),
      },
    ],
  },
  {
    path: '/how-to-choose/02',
    outputFile: path.join('how-to-choose', '02', 'index.html'),
    metadata: {
      title: '为什么有些方案看起来很好，现场却不成立｜NEED 尼德公关',
      description: '很多活动方案在提案里很好看，到了现场却不成立。NEED 从时间、场地、流程、执行条件和判断误差五个角度，解释其中原因。',
    },
    requiredChecks: [
      {
        label: '方案看起来很好',
        test: (bodyText, html) => bodyText.includes('方案看起来很好') || html.includes('方案看起来很好'),
      },
      {
        label: '现场却不成立',
        test: (bodyText, html) => bodyText.includes('现场却不成立') || html.includes('现场却不成立'),
      },
      {
        label: '时间',
        test: (bodyText, html) => bodyText.includes('时间') || html.includes('时间'),
      },
      {
        label: '场地',
        test: (bodyText, html) => bodyText.includes('场地') || html.includes('场地'),
      },
    ],
  },
  {
    path: '/how-to-choose/03',
    outputFile: path.join('how-to-choose', '03', 'index.html'),
    metadata: {
      title: '为什么一场活动开始前，先把目标判断清楚更重要｜NEED 尼德公关',
      description: '很多活动的问题，不是执行不努力，而是一开始目标没判断清楚。NEED 从企业活动策划与执行的角度，解释为什么目标判断是方案成立的第一步。',
    },
    requiredChecks: [
      {
        label: '目标判断清楚',
        test: (bodyText, html) => bodyText.includes('目标判断清楚') || html.includes('目标判断清楚'),
      },
      {
        label: '活动开始前',
        test: (bodyText, html) => bodyText.includes('活动开始前') || html.includes('活动开始前'),
      },
      {
        label: '企业活动策划与执行',
        test: (bodyText, html) => bodyText.includes('企业活动策划与执行') || html.includes('企业活动策划与执行'),
      },
    ],
  },
  {
    path: '/how-to-choose/04',
    outputFile: path.join('how-to-choose', '04', 'index.html'),
    metadata: {
      title: '为什么预算判断，比一味堆创意更重要｜NEED 尼德公关',
      description: '很多活动不是没有创意，而是预算花错了地方。NEED 从企业活动策划与执行的角度，解释为什么预算判断比一味堆创意更重要。',
    },
    requiredChecks: [
      {
        label: '预算判断',
        test: (bodyText, html) => bodyText.includes('预算判断') || html.includes('预算判断'),
      },
      {
        label: '一味堆创意',
        test: (bodyText, html) => bodyText.includes('一味堆创意') || html.includes('一味堆创意'),
      },
      {
        label: '预算花错了地方',
        test: (bodyText, html) => bodyText.includes('预算花错了地方') || html.includes('预算花错了地方'),
      },
    ],
  },
];

function normalizeContent(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function routeUrl(routePath: string) {
  return new URL(routePath, `${baseUrl.replace(/\/+$/, '')}/`).toString();
}

function canonicalUrl(routePath: string) {
  return new URL(routePath, `${SITE_BASE_URL.replace(/\/+$/, '')}/`).toString();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function upsertHeadTag(html: string, existingTagPattern: RegExp, replacementTag: string) {
  if (existingTagPattern.test(html)) {
    return html.replace(existingTagPattern, replacementTag);
  }

  return html.replace(/<\/head>/i, `${replacementTag}\n</head>`);
}

function applyRouteHead(html: string, route: RouteConfig) {
  const title = escapeHtml(route.metadata.title);
  const description = escapeHtml(route.metadata.description);
  const canonical = escapeHtml(canonicalUrl(route.path));

  let nextHtml = upsertHeadTag(html, /<title\b[^>]*>[\s\S]*?<\/title>/i, `<title>${title}</title>`);
  nextHtml = upsertHeadTag(
    nextHtml,
    /<meta\b(?=[^>]*\bname=["']description["'])[^>]*>/i,
    `<meta name="description" content="${description}">`,
  );
  nextHtml = upsertHeadTag(
    nextHtml,
    /<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/i,
    `<link rel="canonical" href="${canonical}">`,
  );

  return nextHtml;
}

function getMissingHeadChecks(html: string, route: RouteConfig) {
  const escapedTitle = escapeHtml(route.metadata.title);
  const escapedDescription = escapeHtml(route.metadata.description);
  const escapedCanonical = escapeHtml(canonicalUrl(route.path));
  const missingChecks: string[] = [];

  if (!html.includes(escapedTitle)) {
    missingChecks.push(`title: ${route.metadata.title}`);
  }

  if (!html.includes(escapedDescription)) {
    missingChecks.push(`description: ${route.metadata.description}`);
  }

  if (!html.includes('rel="canonical"')) {
    missingChecks.push('rel="canonical"');
  }

  if (!html.includes(escapedCanonical)) {
    missingChecks.push(`canonical URL: ${canonicalUrl(route.path)}`);
  }

  return missingChecks;
}

function renderSitemap() {
  const urls = routes
    .map((route) => `  <url><loc>${escapeXml(canonicalUrl(route.path))}</loc></url>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

function renderRobots() {
  return `User-agent: *
Allow: /
Sitemap: ${canonicalUrl('/sitemap.xml')}
`;
}

async function writePrerenderIndexFiles() {
  const sitemapFile = path.join(outputDir, 'sitemap.xml');
  const robotsFile = path.join(outputDir, 'robots.txt');

  await fs.writeFile(sitemapFile, renderSitemap(), 'utf8');
  await fs.writeFile(robotsFile, renderRobots(), 'utf8');

  console.log(`Sitemap file: ${sitemapFile}`);
  console.log(`Robots file: ${robotsFile}`);

  return { sitemapFile, robotsFile };
}

async function getMissingIndexFileChecks(sitemapFile: string, robotsFile: string) {
  const missingChecks: string[] = [];
  let sitemap = '';
  let robots = '';

  try {
    sitemap = await fs.readFile(sitemapFile, 'utf8');
  } catch {
    missingChecks.push(`sitemap.xml file: ${sitemapFile}`);
  }

  try {
    robots = await fs.readFile(robotsFile, 'utf8');
  } catch {
    missingChecks.push(`robots.txt file: ${robotsFile}`);
  }

  if (sitemap) {
    for (const route of routes) {
      const url = canonicalUrl(route.path);

      if (!sitemap.includes(escapeXml(url))) {
        missingChecks.push(`sitemap URL: ${url}`);
      }
    }
  }

  if (robots && !robots.includes(`Sitemap: ${canonicalUrl('/sitemap.xml')}`)) {
    missingChecks.push(`robots Sitemap line: Sitemap: ${canonicalUrl('/sitemap.xml')}`);
  }

  return missingChecks;
}

async function isServiceReachable(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    await response.body?.cancel();
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function checkRequiredServices() {
  const results = await Promise.all(
    serviceChecks.map(async (service) => ({
      service,
      isReachable: await isServiceReachable(service.url),
    })),
  );

  const unreachableServices = results.filter((result) => !result.isReachable);

  for (const { service } of unreachableServices) {
    console.error(service.unavailableMessage);
    console.error(service.runCommand);
  }

  return unreachableServices.length === 0;
}

async function main() {
  const canPrerender = await checkRequiredServices();

  if (!canPrerender) {
    process.exitCode = 1;
    return;
  }

  const browser = await chromium.launch();
  let hasFailedChecks = false;

  try {
    const page = await browser.newPage();

    for (const route of routes) {
      const targetUrl = routeUrl(route.path);
      const outputFile = path.join(outputDir, route.outputFile);

      await page.goto(targetUrl, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      const html = applyRouteHead(await page.content(), route);
      const bodyText = await page.locator('body').innerText();

      await fs.mkdir(path.dirname(outputFile), { recursive: true });
      await fs.writeFile(outputFile, html, 'utf8');

      console.log(`Visited URL: ${targetUrl}`);
      console.log(`Output file: ${outputFile}`);
      console.log(`HTML characters: ${html.length}`);
      console.log(`Body text preview: ${normalizeContent(bodyText).slice(0, 300)}`);

      const normalizedBodyText = normalizeContent(bodyText);
      const normalizedHtml = normalizeContent(html);
      const missingTexts = [
        ...route.requiredChecks
          .filter((check) => !check.test(normalizedBodyText, normalizedHtml))
          .map((check) => check.label),
        ...getMissingHeadChecks(html, route),
      ];

      if (missingTexts.length > 0) {
        hasFailedChecks = true;
        console.error(`Content check failed for ${route.path}. Missing: ${missingTexts.join(', ')}`);
      } else {
        console.log(`Content check passed for ${route.path}`);
      }
    }

    const { sitemapFile, robotsFile } = await writePrerenderIndexFiles();
    const missingIndexFileChecks = await getMissingIndexFileChecks(sitemapFile, robotsFile);

    if (missingIndexFileChecks.length > 0) {
      hasFailedChecks = true;
      console.error(`Prerender index file check failed. Missing: ${missingIndexFileChecks.join(', ')}`);
    }

    if (hasFailedChecks) {
      process.exitCode = 1;
    } else {
      console.log('All prerender content checks passed');
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('Failed to prerender React routes:', error);
  process.exitCode = 1;
});
