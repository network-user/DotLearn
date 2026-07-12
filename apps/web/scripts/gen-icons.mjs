#!/usr/bin/env node
// One-off PWA icon generator: rasterizes public/favicon.svg into the icon sizes
// referenced by vite.config.ts's VitePWA.manifest.icons. NOT part of the build -
// run manually (`node scripts/gen-icons.mjs`) whenever favicon.svg changes; the
// resulting PNGs are committed under public/icons/.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Resvg } from '@resvg/resvg-js';

const here = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(here, '..');
const FAVICON_SVG = join(WEB_ROOT, 'public', 'favicon.svg');
const ICONS_DIR = join(WEB_ROOT, 'public', 'icons');

// Matches manifest.background_color / theme_color in vite.config.ts, so the
// maskable padding blends into the installed app's chrome instead of showing
// a mismatched edge.
const MASKABLE_BACKGROUND = '#181410';
const MASKABLE_PADDING_RATIO = 0.12; // ~12% per side, inside the OS safe-zone.

const faviconSvg = readFileSync(FAVICON_SVG, 'utf8');
// Pull out everything between the root <svg> tags so the graphic can be
// re-embedded as a nested, repositioned <svg> inside the maskable canvas.
const innerMatch = /<svg[^>]*>([\s\S]*)<\/svg>\s*$/.exec(faviconSvg);
if (!innerMatch) {
  throw new Error(`gen-icons: could not parse ${FAVICON_SVG}`);
}
const faviconInner = innerMatch[1];

const renderPng = (svg, size) => {
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: size } });
  return resvg.render().asPng();
};

const maskableIconSvg = (size) => {
  const contentSize = size * (1 - MASKABLE_PADDING_RATIO * 2);
  const offset = (size - contentSize) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${MASKABLE_BACKGROUND}"/>
  <svg x="${offset}" y="${offset}" width="${contentSize}" height="${contentSize}" viewBox="0 0 32 32">${faviconInner}</svg>
</svg>`;
};

mkdirSync(ICONS_DIR, { recursive: true });

writeFileSync(join(ICONS_DIR, 'icon-192.png'), renderPng(faviconSvg, 192));
writeFileSync(join(ICONS_DIR, 'icon-512.png'), renderPng(faviconSvg, 512));
writeFileSync(join(ICONS_DIR, 'icon-512-maskable.png'), renderPng(maskableIconSvg(512), 512));

console.log(`[gen-icons] wrote icon-192.png, icon-512.png, icon-512-maskable.png to ${ICONS_DIR}`);
