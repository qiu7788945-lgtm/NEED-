import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const outputDir = path.join(projectRoot, 'dist-prerender');
const outputFile = path.join(outputDir, 'index.html');
const targetUrl = process.env.PRERENDER_URL || 'http://localhost:3000/';

function normalizeContent(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

async function main() {
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();

    await page.goto(targetUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const html = await page.content();
    const bodyText = await page.locator('body').innerText();

    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(outputFile, html, 'utf8');

    console.log(`Visited URL: ${targetUrl}`);
    console.log(`Output file: ${outputFile}`);
    console.log(`HTML characters: ${html.length}`);
    console.log(`Body text preview: ${bodyText.replace(/\s+/g, ' ').trim().slice(0, 300)}`);

    const normalizedBodyText = normalizeContent(bodyText);
    const normalizedHtml = normalizeContent(html);
    const normalizedBodyTextUpper = normalizedBodyText.toUpperCase();
    const normalizedHtmlUpper = normalizedHtml.toUpperCase();
    const checks = [
      {
        label: 'YOU NEED. WE BUILD.',
        passed: /YOU\s+NEED\.?\s+WE\s+BUILD\.?/i.test(normalizedBodyTextUpper)
          || /YOU\s+NEED\.?\s+WE\s+BUILD\.?/i.test(normalizedHtmlUpper),
      },
      {
        label: '尼德公关',
        passed: normalizedBodyText.includes('尼德公关') || normalizedHtml.includes('尼德公关'),
      },
      {
        label: '怎么选活动公司',
        passed: normalizedBodyText.includes('怎么选活动公司') || normalizedHtml.includes('怎么选活动公司'),
      },
    ];
    const missingTexts = checks.filter((check) => !check.passed).map((check) => check.label);

    if (missingTexts.length > 0) {
      console.error(`Content check failed. Missing: ${missingTexts.join(', ')}`);
      process.exitCode = 1;
    } else {
      console.log('Content check passed');
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('Failed to prerender React home page:', error);
  process.exitCode = 1;
});
