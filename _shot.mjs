import { chromium } from 'playwright-core';
const base = 'http://localhost:4173';
const exe = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await chromium.launch({ executablePath: exe });
const shots = [
  { name: 'home-desktop-light', url: '/', w: 1280, h: 900, scheme: 'light' },
  { name: 'home-desktop-dark', url: '/', w: 1280, h: 900, scheme: 'dark' },
  { name: 'home-mobile-light', url: '/', w: 375, h: 760, scheme: 'light' },
  { name: 'topic-desktop-light', url: '/topics/sql-fundamentals', w: 1280, h: 1100, scheme: 'light' },
  { name: 'topic-desktop-dark', url: '/topics/sql-fundamentals', w: 1280, h: 1100, scheme: 'dark' },
  { name: 'topic-mobile-light', url: '/topics/python-oop', w: 375, h: 900, scheme: 'light' },
];
for (const s of shots) {
  const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, colorScheme: s.scheme });
  const page = await ctx.newPage();
  try {
    await page.goto(base + s.url, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (e) { console.log('nav warn', s.name, e.message); }
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `_shots/${s.name}.png` });
  console.log('shot', s.name);
  await ctx.close();
}
await browser.close();
console.log('done');
