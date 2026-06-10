import { chromium } from 'playwright-core';
const base = 'http://localhost:4173';
const exe = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await chromium.launch({ executablePath: exe });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await page.goto(base + '/', { waitUntil: 'networkidle' });
// wait for service worker to activate
await page.waitForTimeout(3500);
const sw = await page.evaluate(async () => {
  if (!('serviceWorker' in navigator)) return 'no-sw-api';
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? (reg.active ? 'active' : 'registered-not-active') : 'none';
});
console.log('serviceWorker:', sw);
await ctx.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded' }).catch(e => console.log('reload warn', e.message));
await page.waitForTimeout(2500);
const title = await page.title();
const hasContent = await page.evaluate(() => !!document.querySelector('#root') && document.body.innerText.length > 50);
const bodyPeek = await page.evaluate(() => document.body.innerText.slice(0,80).replace(/\n/g,' '));
console.log('offline title:', JSON.stringify(title));
console.log('offline rendered content:', hasContent, '| peek:', JSON.stringify(bodyPeek));
await page.screenshot({ path: '_shots/offline-reload.png' });
await browser.close();
console.log('done');
