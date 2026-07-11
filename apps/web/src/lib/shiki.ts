// Lazy singleton Shiki highlighter for runtime (browser) code highlighting
// outside MDX theory content — e.g. predict-output fixtures/snippets and
// solution reveals. Uses shiki's fine-grained core bundle (explicit lang/
// engine imports) rather than the top-level `shiki` package: the latter's
// `createHighlighter` pulls in its bundled index of ~100 languages, which
// Rollup then has to code-split as ~100 separate chunks (harmless at
// runtime since only the requested langs are ever fetched, but it bloats
// the dist/ output by tens of MB for nothing). Fine-grained core only ever
// references the 3 languages we actually use.
import type { HighlighterCore } from 'shiki/core';

import { INK_THEME, PAPER_THEME } from './shiki-themes';

const LANGS = ['python', 'sql', 'bash'] as const;
export type StaticCodeLang = (typeof LANGS)[number];

let highlighterPromise: Promise<HighlighterCore> | null = null;

const getHighlighter = (): Promise<HighlighterCore> => {
  if (!highlighterPromise) {
    highlighterPromise = Promise.all([import('shiki/core'), import('shiki/engine/oniguruma')]).then(
      ([{ createHighlighterCore }, { createOnigurumaEngine }]) =>
        createHighlighterCore({
          themes: [PAPER_THEME, INK_THEME],
          langs: [
            import('shiki/langs/python.mjs'),
            import('shiki/langs/sql.mjs'),
            import('shiki/langs/bash.mjs'),
          ],
          engine: createOnigurumaEngine(import('shiki/wasm')),
        }),
    );
  }
  return highlighterPromise;
};

const renderInline = async (code: string, lang: StaticCodeLang): Promise<string> => {
  const highlighter = await getHighlighter();
  return highlighter.codeToHtml(code, {
    lang,
    themes: { light: 'dotlearn-paper', dark: 'dotlearn-ink' },
    defaultColor: false,
    cssVariablePrefix: '--shiki-',
    structure: 'inline',
  });
};

const CACHE_LIMIT = 100;

const createFifoCache = <V>(): {
  get: (key: string) => V | undefined;
  set: (key: string, value: V) => void;
} => {
  const store = new Map<string, V>();
  return {
    get: (key) => store.get(key),
    set: (key, value) => {
      if (!store.has(key) && store.size >= CACHE_LIMIT) {
        const oldest = store.keys().next().value;
        if (oldest !== undefined) store.delete(oldest);
      }
      store.set(key, value);
    },
  };
};

const htmlCache = createFifoCache<string>();
const linesCache = createFifoCache<(string | null)[]>();

export const highlightStatic = async (code: string, lang: StaticCodeLang): Promise<string> => {
  const key = `${lang}|${code}`;
  const cached = htmlCache.get(key);
  if (cached !== undefined) return cached;
  const html = await renderInline(code, lang);
  htmlCache.set(key, html);
  return html;
};

// Highlights the whole block in a single tokenization pass and returns one HTML
// string per source line (inline structure separates lines with <br>), instead
// of tokenizing each line separately. This preserves cross-line grammar context
// (e.g. triple-quoted strings) and the exact per-token markup Shiki emits, so
// the existing theme CSS variables apply unchanged. Blank/whitespace-only lines
// map to null, mirroring the previous per-line skip.
export const highlightLinesStatic = async (
  code: string,
  lang: StaticCodeLang,
): Promise<(string | null)[]> => {
  const key = `${lang}|${code}`;
  const cached = linesCache.get(key);
  if (cached !== undefined) return cached;
  const whole = await renderInline(code, lang);
  const segments = whole.split(/<br\s*\/?>/);
  const sourceLines = code.split('\n');
  const lines = segments.map((segment, index) =>
    (sourceLines[index] ?? '').trim().length === 0 ? null : segment,
  );
  linesCache.set(key, lines);
  return lines;
};
