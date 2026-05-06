import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { getStaticRouteManifest, type RouteManifestItem } from './prerender-route-manifest.js';

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
const manifest = getStaticRouteManifest(SITE_BASE_URL);
const expectedRouteCount = 17;
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

function createRequiredCheck(label: string): RouteConfig['requiredChecks'][number] {
  return {
    label,
    test: (bodyText, html) => bodyText.includes(label) || html.includes(label),
  };
}

function toRouteConfig(route: RouteManifestItem): RouteConfig {
  return {
    path: route.path,
    outputFile: route.outputPath,
    metadata: {
      title: route.title,
      description: route.description,
    },
    requiredChecks: route.requiredChecks.map(createRequiredCheck),
  };
}

const routes = manifest.routes
  .filter((route) => route.shouldGenerate)
  .map(toRouteConfig);

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
  const routeManifestFile = path.join(outputDir, 'route-manifest.json');

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(routeManifestFile, JSON.stringify(manifest, null, 2), 'utf8');
  await fs.writeFile(sitemapFile, renderSitemap(), 'utf8');
  await fs.writeFile(robotsFile, renderRobots(), 'utf8');

  console.log(`Route manifest file: ${routeManifestFile}`);
  console.log(`Sitemap file: ${sitemapFile}`);
  console.log(`Robots file: ${robotsFile}`);

  return { sitemapFile, robotsFile, routeManifestFile };
}

async function getMissingIndexFileChecks(sitemapFile: string, robotsFile: string, routeManifestFile: string) {
  const missingChecks: string[] = [];
  let sitemap = '';
  let robots = '';
  let routeManifestJson = '';

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

  try {
    routeManifestJson = await fs.readFile(routeManifestFile, 'utf8');
  } catch {
    missingChecks.push(`route-manifest.json file: ${routeManifestFile}`);
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

  if (routeManifestJson) {
    try {
      const routeManifest = JSON.parse(routeManifestJson) as Partial<{
        routes: unknown[];
        skippedRoutes: unknown[];
      }>;

      if (!Array.isArray(routeManifest.routes)) {
        missingChecks.push('route-manifest.json routes array');
      } else if (routeManifest.routes.length !== routes.length) {
        missingChecks.push(`route-manifest.json routes.length: expected ${routes.length}, got ${routeManifest.routes.length}`);
      }

      if (!Array.isArray(routeManifest.skippedRoutes)) {
        missingChecks.push('route-manifest.json skippedRoutes array');
      }
    } catch (error) {
      missingChecks.push(`route-manifest.json valid JSON: ${(error as Error).message}`);
    }
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
  console.log(`Manifest routes loaded: ${routes.length}`);

  if (routes.length === 0) {
    console.error('No routes with shouldGenerate=true found in route manifest.');
    process.exitCode = 1;
    return;
  }

  if (routes.length !== expectedRouteCount) {
    console.warn(`Warning: expected ${expectedRouteCount} manifest routes, but loaded ${routes.length}.`);
  }

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

    const { sitemapFile, robotsFile, routeManifestFile } = await writePrerenderIndexFiles();
    const missingIndexFileChecks = await getMissingIndexFileChecks(sitemapFile, robotsFile, routeManifestFile);

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
