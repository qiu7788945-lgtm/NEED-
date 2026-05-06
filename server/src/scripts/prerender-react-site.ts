import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

interface RouteConfig {
  path: string;
  outputFile: string;
  requiredChecks: Array<{
    label: string;
    test: (normalizedBodyText: string, normalizedHtml: string) => boolean;
  }>;
}

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const outputDir = path.join(projectRoot, 'dist-prerender');
const baseUrl = process.env.PRERENDER_BASE_URL || 'http://localhost:3000';
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
];

function normalizeContent(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function routeUrl(routePath: string) {
  return new URL(routePath, `${baseUrl.replace(/\/+$/, '')}/`).toString();
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

      const html = await page.content();
      const bodyText = await page.locator('body').innerText();

      await fs.mkdir(path.dirname(outputFile), { recursive: true });
      await fs.writeFile(outputFile, html, 'utf8');

      console.log(`Visited URL: ${targetUrl}`);
      console.log(`Output file: ${outputFile}`);
      console.log(`HTML characters: ${html.length}`);
      console.log(`Body text preview: ${normalizeContent(bodyText).slice(0, 300)}`);

      const normalizedBodyText = normalizeContent(bodyText);
      const normalizedHtml = normalizeContent(html);
      const missingTexts = route.requiredChecks
        .filter((check) => !check.test(normalizedBodyText, normalizedHtml))
        .map((check) => check.label);

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
