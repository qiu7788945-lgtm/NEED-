import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const outputDir = path.join(projectRoot, 'dist-prerender');
const outputFile = path.join(outputDir, 'index.html');
const targetUrl = process.env.PRERENDER_URL || 'http://localhost:3000/';

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
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('Failed to prerender React home page:', error);
  process.exitCode = 1;
});
