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

export const highlightStatic = async (code: string, lang: StaticCodeLang): Promise<string> => {
  const highlighter = await getHighlighter();
  return highlighter.codeToHtml(code, {
    lang,
    themes: { light: 'dotlearn-paper', dark: 'dotlearn-ink' },
    defaultColor: false,
    cssVariablePrefix: '--shiki-',
    structure: 'inline',
  });
};
