import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { chromium } from 'playwright-core';

const BASE_URL = process.env.SMOKE_BASE_URL ?? 'http://localhost:4399';
const OUT_DIR = process.env.SMOKE_OUT_DIR ?? join(process.cwd(), '.smoke');

const VIEWPORTS = [
  { name: 'mobile-375', width: 375, height: 667, isMobile: true, hasTouch: true },
  { name: 'tablet-768', width: 768, height: 1024, isMobile: true, hasTouch: true },
  { name: 'desktop-1280', width: 1280, height: 800, isMobile: false, hasTouch: false },
];

const PAGES = [
  { name: 'home', path: '/' },
  { name: 'topic-sql', path: '/topics/sql-fundamentals' },
  { name: 'progress', path: '/progress' },
  { name: 'proposals', path: '/proposals' },
  { name: 'flashcards', path: '/flashcards' },
  { name: 'submit', path: '/submit' },
];

mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge' });

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    hasTouch: viewport.hasTouch,
    locale: 'ru-RU',
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  for (const target of PAGES) {
    await page.goto(`${BASE_URL}${target.path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    const file = join(OUT_DIR, `${target.name}--${viewport.name}.png`);
    await page.screenshot({ path: file, fullPage: false });
    console.warn(
      `${target.name} @ ${viewport.name}: overflowX=${horizontalOverflow}px -> ${file}`,
    );
  }
  await context.close();
}

await browser.close();
