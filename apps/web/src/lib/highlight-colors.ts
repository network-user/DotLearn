import type { HighlightColor } from './progress-db';

export interface HighlightColorDef {
  id: HighlightColor;
  swatchClass: string;
  markClass: string;
  borderClass: string;
}

export const HIGHLIGHT_COLORS: readonly HighlightColorDef[] = [
  {
    id: 'yellow',
    swatchClass: 'bg-amber-300',
    markClass: 'bg-amber-200/70 dark:bg-amber-300/25',
    borderClass: 'border-amber-400',
  },
  {
    id: 'green',
    swatchClass: 'bg-emerald-300',
    markClass: 'bg-emerald-200/70 dark:bg-emerald-300/25',
    borderClass: 'border-emerald-400',
  },
  {
    id: 'blue',
    swatchClass: 'bg-sky-300',
    markClass: 'bg-sky-200/70 dark:bg-sky-300/25',
    borderClass: 'border-sky-400',
  },
  {
    id: 'pink',
    swatchClass: 'bg-pink-300',
    markClass: 'bg-pink-200/70 dark:bg-pink-300/25',
    borderClass: 'border-pink-400',
  },
] as const;

const FALLBACK_COLOR = HIGHLIGHT_COLORS[0] as HighlightColorDef;

export const highlightColorOf = (color: HighlightColor): HighlightColorDef =>
  HIGHLIGHT_COLORS.find((entry) => entry.id === color) ?? FALLBACK_COLOR;

const MARK_BASE_CLASS = 'rounded-[2px] text-inherit cursor-pointer transition-colors';

export const highlightMarkClass = (color: HighlightColor): string =>
  `${MARK_BASE_CLASS} ${highlightColorOf(color).markClass}`;
