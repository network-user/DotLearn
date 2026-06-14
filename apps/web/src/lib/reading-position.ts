import type { ConceptScrollRecord } from './progress-db';

export const MEANINGFUL_RATIO = 0.08;

const MIN_SCROLLABLE = 120;
const TOP_THRESHOLD = 24;
const RESTORE_MAX_FRAMES = 40;
const RESTORE_STABLE_FRAMES = 3;

export type CapturedPosition =
  | { kind: 'pos'; ratio: number; anchorOffset: number; anchorId?: string }
  | { kind: 'top' }
  | { kind: 'none' };

let suppressUntil = 0;

export const suppressSaves = (ms = 300): void => {
  suppressUntil = Date.now() + ms;
};

export const isSavingSuppressed = (): boolean => Date.now() < suppressUntil;

export const programmaticScrollTo = (y: number, smooth: boolean): void => {
  suppressSaves(700);
  window.scrollTo({ top: y, behavior: smooth ? 'smooth' : 'auto' });
};

const headerOffset = (): number => (window.innerWidth >= 1024 ? 96 : 144);

const maxScroll = (): number => {
  const docEl = document.documentElement;
  return Math.max(0, docEl.scrollHeight - docEl.clientHeight);
};

export const computePosition = (): CapturedPosition => {
  const max = maxScroll();
  if (max <= MIN_SCROLLABLE) return { kind: 'none' };
  const scrollY = window.scrollY;
  if (scrollY < TOP_THRESHOLD) return { kind: 'top' };

  const ratio = Math.min(1, Math.max(0, scrollY / max));
  const offset = headerOffset();
  const root = document.querySelector('[data-toc-root]');
  let chosen: HTMLElement | null = null;
  if (root) {
    const headings = Array.from(root.querySelectorAll<HTMLElement>('[data-toc]'));
    for (const heading of headings) {
      if (heading.getBoundingClientRect().top - offset <= 1) chosen = heading;
      else break;
    }
  }

  if (chosen && chosen.id) {
    const anchorTopAbs = chosen.getBoundingClientRect().top + scrollY;
    return { kind: 'pos', ratio, anchorOffset: scrollY - anchorTopAbs, anchorId: chosen.id };
  }
  return { kind: 'pos', ratio, anchorOffset: 0 };
};

export const computeTargetY = (record: ConceptScrollRecord): number => {
  const max = maxScroll();
  if (record.anchorId) {
    const el = document.getElementById(record.anchorId);
    if (el) {
      const anchorTopAbs = el.getBoundingClientRect().top + window.scrollY;
      return Math.min(max, Math.max(0, anchorTopAbs + record.anchorOffset));
    }
  }
  return Math.min(max, Math.max(0, record.ratio * max));
};

const ABORT_EVENTS: Array<keyof WindowEventMap> = ['wheel', 'touchstart', 'keydown', 'pointerdown'];

export const runRestore = (record: ConceptScrollRecord): (() => void) => {
  let cancelled = false;
  let frames = 0;
  let stable = 0;
  let lastHeight = -1;
  let rafId = 0;

  const cancel = (): void => {
    if (cancelled) return;
    cancelled = true;
    ABORT_EVENTS.forEach((event) => window.removeEventListener(event, cancel));
    if (rafId) cancelAnimationFrame(rafId);
  };

  const step = (): void => {
    if (cancelled) return;
    suppressSaves(400);
    const height = document.documentElement.scrollHeight;
    window.scrollTo(0, computeTargetY(record));
    frames += 1;
    stable = height === lastHeight ? stable + 1 : 0;
    lastHeight = height;
    if (stable >= RESTORE_STABLE_FRAMES || frames >= RESTORE_MAX_FRAMES) {
      ABORT_EVENTS.forEach((event) => window.removeEventListener(event, cancel));
      return;
    }
    rafId = requestAnimationFrame(step);
  };

  ABORT_EVENTS.forEach((event) => window.addEventListener(event, cancel, { passive: true }));
  rafId = requestAnimationFrame(step);
  return cancel;
};
