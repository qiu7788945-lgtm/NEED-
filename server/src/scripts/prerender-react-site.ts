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
