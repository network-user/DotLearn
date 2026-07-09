// Custom Shiki themes that reuse the exact 5 hex colors defined for the
// Monaco editor theme (see components/sandbox/LazyCodeEditor.tsx), so static
// code in MDX theory / predict-output / solution-reveal visually matches the
// interactive sandbox editor. Shiki themes are TextMate-scope based (unlike
// Monaco's token-name based rules), so the same colors are re-mapped onto
// the relevant TextMate scopes here.

import type { ThemeRegistration } from 'shiki';

export const PAPER_THEME: ThemeRegistration = {
  name: 'dotlearn-paper',
  type: 'light',
  colors: {
    'editor.background': '#f6f2ea',
    'editor.foreground': '#231e19',
  },
  tokenColors: [
    { scope: ['comment'], settings: { fontStyle: 'italic', foreground: '#92887a' } },
    { scope: ['keyword', 'storage.type', 'storage.modifier'], settings: { foreground: '#bf3c22' } },
    { scope: ['string'], settings: { foreground: '#2d6a40' } },
    { scope: ['constant.numeric'], settings: { foreground: '#a97520' } },
    {
      scope: ['entity.name.type', 'entity.name.class', 'support.type', 'support.class'],
      settings: { foreground: '#344f6e' },
    },
  ],
};

export const INK_THEME: ThemeRegistration = {
  name: 'dotlearn-ink',
  type: 'dark',
  colors: {
    'editor.background': '#1e1914',
    'editor.foreground': '#ebe4d9',
  },
  tokenColors: [
    { scope: ['comment'], settings: { fontStyle: 'italic', foreground: '#8a8072' } },
    { scope: ['keyword', 'storage.type', 'storage.modifier'], settings: { foreground: '#e66546' } },
    { scope: ['string'], settings: { foreground: '#7ab28a' } },
    { scope: ['constant.numeric'], settings: { foreground: '#d19f4d' } },
    {
      scope: ['entity.name.type', 'entity.name.class', 'support.type', 'support.class'],
      settings: { foreground: '#7d9cbe' },
    },
  ],
};
