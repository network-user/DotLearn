#!/usr/bin/env node
// Build-time OG image generator: rasterizes 1200x630 PNGs (one per topic plus a
// site-wide default) in the same visual language as docs/cover.svg - dark
// gradient, faint grid, line-art "graduation cap" glyph as a watermark, .learn
// wordmark. prerender.mjs references `${SITE}/og/<slug>.png` and
// `${SITE}/og/default.png` in <meta property="og:image">; this script is what
// actually produces those files under dist/og/.
//
// Font: IBM Plex Sans Regular/Bold TTF (Cyrillic-inclusive), vendored in
// ./og-assets/ under its original SIL OFL 1.1 license (see og-assets/OFL.txt).
// resvg needs real font files to shape text and cannot load the woff2 the app
// itself ships (@fontsource/ibm-plex-sans) - so this is a separate, build-time-only
// copy of the same typeface that never reaches the browser bundle.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Resvg } from '@resvg/resvg-js';

const here = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(here, '..');
const REPO_ROOT = resolve(here, '..', '..', '..');
const TOPICS_ROOT = resolve(REPO_ROOT, 'topics');
const DEFAULT_DIST_DIR = resolve(WEB_ROOT, 'dist');

const FONT_FILES = [
  join(here, 'og-assets', 'IBMPlexSans-Regular.ttf'),
  join(here, 'og-assets', 'IBMPlexSans-Bold.ttf'),
];
const FONT_FAMILY = 'IBM Plex Sans';

const WIDTH = 1200;
const HEIGHT = 630;
const MARGIN_X = 90;

const DIFFICULTY_LABELS = {
  beginner: 'с нуля',
  intermediate: 'средний уровень',
  advanced: 'продвинутый',
};

// Line-art "graduation cap" glyph, lifted verbatim from docs/cover.svg (viewBox 0 0 48 48).
const GLYPH_STROKES = [
  '<path d="M5 19 L24 10 L43 19 L24 28 Z"/>',
  '<path d="M13 22.5 V31 q11 6 22 0 V22.5"/>',
  '<path d="M43 19 V29"/>',
].join('\n      ');

const escapeXml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/** Greedy word-wrap: fills lines up to `maxChars`, never splitting a word. */
const wrapText = (text, maxChars, maxLines) => {
  const words = String(text ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && next.length > maxChars) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1].replace(/[.,;:\s]+$/, '')}…`;
  return kept;
};

// Adaptive title size: fewer lines -> bigger type. Kept inside the 56-84px band.
const TITLE_FONT_SIZE_BY_LINES = { 1: 84, 2: 68, 3: 56 };

const glyphGroup = (color, opacity) =>
  `<g fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"${
    opacity != null ? ` opacity="${opacity}"` : ''
  }>
      ${GLYPH_STROKES}
      <circle cx="43" cy="31.5" r="1.6" fill="${color}" stroke="none"/>
    </g>`;

const sharedDefs = () => `
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0a0b0d"/>
      <stop offset="0.5" stop-color="#14161a"/>
      <stop offset="1" stop-color="#0b0c0e"/>
    </linearGradient>
    <radialGradient id="glow" cx="72%" cy="18%" r="65%">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.14"/>
      <stop offset="0.5" stop-color="#ffffff" stop-opacity="0.04"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="halo" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.1"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  `;

// Background + grid + watermark glyph shared by every OG image.
const sharedBackground = () => `
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>
  <g opacity="0.045" stroke="#ffffff" stroke-width="1">
    <path d="M0 158 H${WIDTH} M0 316 H${WIDTH} M0 474 H${WIDTH} M300 0 V${HEIGHT} M600 0 V${HEIGHT} M900 0 V${HEIGHT}"/>
  </g>
  <circle cx="888" cy="321" r="230" fill="url(#halo)"/>
  <svg x="740" y="141" width="360" height="360" viewBox="0 0 48 48">
    ${glyphGroup('#ffffff', 0.1)}
  </svg>
`;

// Small top-left wordmark (glyph + ".learn"), used on per-topic cards.
const brandMark = () => `
  <svg x="${MARGIN_X}" y="52" width="36" height="36" viewBox="0 0 48 48">
    ${glyphGroup('#f3f3f1')}
  </svg>
  <text x="${MARGIN_X + 50}" y="78" font-family="${FONT_FAMILY}" font-size="26" font-weight="700" fill="#f3f3f1">.learn</text>
`;

/** Topic OG card: brand mark, title (greedy-wrapped, adaptive size), difficulty + tags. */
export const buildTopicSvg = (manifest) => {
  const lines = wrapText(manifest.title, 21, 3);
  const fontSize = TITLE_FONT_SIZE_BY_LINES[lines.length] ?? 56;
  const lineHeight = Math.round(fontSize * 1.15);
  const firstBaseline = Math.round(HEIGHT / 2 - ((lines.length - 1) * lineHeight) / 2 - 6);
  const titleTspans = lines
    .map(
      (line, i) =>
        `<tspan x="${MARGIN_X}" y="${firstBaseline + i * lineHeight}">${escapeXml(line)}</tspan>`,
    )
    .join('');

  const difficulty = DIFFICULTY_LABELS[manifest.difficulty] ?? '';
  const tags = Array.isArray(manifest.tags) ? manifest.tags.slice(0, 3) : [];
  const metaText = [difficulty, ...tags].filter(Boolean).join(' · ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>${sharedDefs()}</defs>
  ${sharedBackground()}
  ${brandMark()}
  <text font-family="${FONT_FAMILY}" font-size="${fontSize}" font-weight="700" fill="#f3f3f1" letter-spacing="-1">${titleTspans}</text>
  <text x="${MARGIN_X}" y="${HEIGHT - 64}" font-family="${FONT_FAMILY}" font-size="28" font-weight="400" fill="#a6a7ab">${escapeXml(metaText)}</text>
</svg>`;
};

/** Site-wide default OG card: big .learn wordmark + tagline. */
export const buildDefaultSvg = () => {
  const subtitleLines = wrapText('Интерактивные курсы Python, SQL, Git и веб-разработки', 34, 2);
  const subtitleTspans = subtitleLines
    .map((line, i) => `<tspan x="${MARGIN_X}" dy="${i === 0 ? 0 : 40}">${escapeXml(line)}</tspan>`)
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>${sharedDefs()}</defs>
  ${sharedBackground()}
  <text x="${MARGIN_X}" y="330" font-family="${FONT_FAMILY}" font-size="108" font-weight="700" fill="#f3f3f1" letter-spacing="-2">.learn</text>
  <text y="378" font-family="${FONT_FAMILY}" font-size="30" font-weight="400" fill="#a6a7ab">${subtitleTspans}</text>
</svg>`;
};

const renderPng = (svg) => {
  const resvg = new Resvg(svg, {
    font: {
      fontFiles: FONT_FILES,
      defaultFontFamily: FONT_FAMILY,
      loadSystemFonts: false,
    },
  });
  return resvg.render().asPng();
};

/** All topic manifests on disk, sorted by slug (mirrors seo-lib.mjs#loadTopics, kept
 * standalone here so this script has no import-time coupling to the SEO pipeline). */
const loadTopicManifests = () => {
  const topics = [];
  for (const entry of readdirSync(TOPICS_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = join(TOPICS_ROOT, entry.name, 'manifest.json');
    if (!existsSync(manifestPath)) continue;
    let manifest;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    } catch {
      continue;
    }
    if (!manifest || typeof manifest.slug !== 'string') continue;
    topics.push(manifest);
  }
  topics.sort((a, b) => a.slug.localeCompare(b.slug));
  return topics;
};

/** Renders every topic PNG + default.png into `${distDir}/og/`. */
export const generateOgImages = async ({ distDir = DEFAULT_DIST_DIR } = {}) => {
  for (const fontFile of FONT_FILES) {
    if (!existsSync(fontFile)) {
      throw new Error(`og: missing font file ${fontFile} (see apps/web/scripts/og-assets/)`);
    }
  }
  const ogDir = join(distDir, 'og');
  mkdirSync(ogDir, { recursive: true });

  const topics = loadTopicManifests();
  for (const manifest of topics) {
    writeFileSync(join(ogDir, `${manifest.slug}.png`), renderPng(buildTopicSvg(manifest)));
  }
  writeFileSync(join(ogDir, 'default.png'), renderPng(buildDefaultSvg()));

  return { count: topics.length + 1, ogDir };
};

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { count, ogDir } = await generateOgImages({ distDir: DEFAULT_DIST_DIR });
  console.log(`[og] wrote ${count} PNG(s) to ${ogDir}`);
}
