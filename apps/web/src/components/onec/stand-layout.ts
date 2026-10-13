import { useCallback, useEffect, useRef, useState, type RefCallback } from 'react';

export type StandTier = 'compact' | 'medium' | 'wide';

export const STAND_MEDIUM_PX = 600;
export const STAND_WIDE_PX = 960;

export const standTierOf = (
  width: number,
  medium = STAND_MEDIUM_PX,
  wide = STAND_WIDE_PX,
): StandTier => {
  if (width >= wide) return 'wide';
  if (width >= medium) return 'medium';
  return 'compact';
};

/**
 * Width of the stand itself, not the viewport. The window sits in a lesson
 * column, so a viewport `md:` breakpoint turns on side panels that no longer fit.
 */
export const useStandTier = (
  medium = STAND_MEDIUM_PX,
  wide = STAND_WIDE_PX,
): {
  ref: RefCallback<HTMLElement>;
  tier: StandTier;
} => {
  const [tier, setTier] = useState<StandTier>('compact');
  const observerRef = useRef<ResizeObserver | null>(null);

  const ref = useCallback(
    (node: HTMLElement | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      if (!node) return;
      const apply = (width: number) => {
        const next = standTierOf(width, medium, wide);
        setTier((prev) => (prev === next ? prev : next));
      };
      apply(node.getBoundingClientRect().width);
      const observer = new ResizeObserver((entries) => {
        apply(entries[0]?.contentRect.width ?? 0);
      });
      observer.observe(node);
      observerRef.current = observer;
    },
    [medium, wide],
  );

  useEffect(() => () => observerRef.current?.disconnect(), []);

  return { ref, tier };
};

/**
 * A min-width on a table still widens the page in Chromium, even when the
 * stand clips that table. Fixed layout keeps every column inside the window.
 */
export const standTableClass = [
  'w-full table-fixed border-collapse text-left',
  '[&_td]:max-w-0 [&_td]:truncate [&_th]:max-w-0 [&_th]:truncate',
  'group-data-[tier=wide]/stand:table-auto',
  'group-data-[tier=wide]/stand:[&_td]:max-w-none group-data-[tier=wide]/stand:[&_th]:max-w-none',
  'group-data-[tier=wide]/stand:[&_td]:overflow-visible group-data-[tier=wide]/stand:[&_th]:overflow-visible',
  'group-data-[tier=wide]/stand:[&_td]:whitespace-normal group-data-[tier=wide]/stand:[&_th]:whitespace-normal',
  'group-data-[tier=wide]/stand:[&_td]:text-clip group-data-[tier=wide]/stand:[&_th]:text-clip',
].join(' ');

/** Columns past the third, shown only when the stand itself is wide. */
export const standTableLaterClass = 'hidden group-data-[tier=wide]/stand:table-cell';

export const standShellClass =
  'group/stand flex h-[min(44rem,calc(100svh-7.5rem))] min-h-[min(24rem,calc(100svh-7.5rem))] w-full min-w-0 flex-col overflow-hidden border border-[#b5b5b5] bg-white font-[Arial,Helvetica,sans-serif] text-[16px] leading-snug text-[#1f1f1f] shadow-sm data-[tier=wide]:text-[13px]';

export const standBodyClass =
  'flex min-h-0 min-w-0 flex-1 flex-col group-data-[tier=medium]/stand:flex-row group-data-[tier=wide]/stand:flex-row';

export const onecFieldClass =
  'h-11 w-full min-w-0 rounded-sm border border-[#8f8f8f] bg-white px-2 text-[16px] text-[#1f1f1f] outline-none group-data-[tier=wide]/stand:h-7 group-data-[tier=wide]/stand:text-[13px]';

export const onecCmdClass =
  'inline-flex min-h-11 items-center rounded-sm border border-[#bdbdbd] bg-[#f7f7f7] px-2.5 text-[16px] text-[#1f1f1f] group-data-[tier=wide]/stand:min-h-8 group-data-[tier=wide]/stand:text-[13px]';

export const onecCmdPrimary =
  'inline-flex min-h-11 items-center rounded-sm border border-[#d6b000] bg-[#ffe14a] px-2.5 text-[16px] font-medium text-[#1f1f1f] group-data-[tier=wide]/stand:min-h-8 group-data-[tier=wide]/stand:text-[13px]';
