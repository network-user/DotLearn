import typography from '@tailwindcss/typography';
import type { Config } from 'tailwindcss';

const withAlpha = (variable: string) => `rgb(var(${variable}) / <alpha-value>)`;

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx,mdx}', '../../topics/**/*.mdx'],
  darkMode: 'class',
  future: {
    hoverOnlyWhenSupported: true,
  },
  theme: {
    extend: {
      colors: {
        canvas: withAlpha('--canvas'),
        surface: withAlpha('--surface'),
        'surface-2': withAlpha('--surface-2'),
        'surface-3': withAlpha('--surface-3'),
        'border-base': withAlpha('--border'),
        'border-strong': withAlpha('--border-strong'),
        fg: withAlpha('--fg'),
        'fg-muted': withAlpha('--fg-muted'),
        'fg-subtle': withAlpha('--fg-subtle'),
        'code-bg': withAlpha('--code-bg'),
        accent: withAlpha('--accent-1'),
        'accent-2': withAlpha('--accent-2'),
        'accent-3': withAlpha('--accent-3'),
        ok: withAlpha('--ok'),
        warn: withAlpha('--warn'),
        err: withAlpha('--err'),
        info: withAlpha('--info'),
      },
      fontFamily: {
        sans: ['var(--font-stack-system)'],
        serif: ['var(--font-stack-serif)'],
        mono: ['var(--font-stack-mono)'],
        display: ['var(--font-stack-display)'],
      },
      spacing: {
        '4.5': '18px',
        '11': '44px',
        '13': '52px',
        '15': '60px',
      },
      borderRadius: {
        xs: 'var(--r-xs)',
        sm: 'var(--r-sm)',
        md: 'var(--r-md)',
        lg: 'var(--r-lg)',
        xl: 'var(--r-xl)',
        '2xl': 'var(--r-2xl)',
        pill: 'var(--r-pill)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        float: 'var(--shadow-float)',
        sheet: 'var(--shadow-sheet)',
        press: 'var(--shadow-press)',
      },
      transitionTimingFunction: {
        standard: 'var(--ease-standard)',
        emph: 'var(--ease-emph)',
        spring: 'var(--ease-spring)',
        snappy: 'var(--ease-snappy)',
        soft: 'var(--ease-soft)',
        'press-back': 'var(--ease-press-back)',
      },
      transitionDuration: {
        instant: '40ms',
        xfast: '110ms',
        fast: '160ms',
        med: '240ms',
        slow: '360ms',
        xslow: '520ms',
        hero: '680ms',
      },
      letterSpacing: {
        display: 'var(--ls-display)',
        tightish: 'var(--ls-tight)',
        snug: 'var(--ls-snug)',
      },
      maxWidth: {
        prose: '68ch',
        layout: 'var(--layout-max)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        rise: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in var(--dur-med) var(--ease-out)',
        rise: 'rise var(--dur-slow) var(--ease-out)',
      },
    },
  },
  plugins: [typography],
};

export default config;
