import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

interface OnecCoachProps {
  rootRef: RefObject<HTMLElement | null>;
  title: string;
  body: string;
  index: number;
  total: number;
  revision: string;
  onClose?: (() => void) | undefined;
  closeLabel?: string | undefined;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const OnecCoach = ({
  rootRef,
  title,
  body,
  index,
  total,
  revision,
  onClose,
  closeLabel,
}: OnecCoachProps) => {
  const [box, setBox] = useState<Box | null>(null);
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const seenTarget = useRef<Element | null>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const measure = (): void => {
      const host = root.getBoundingClientRect();
      setFrame((prev) =>
        prev.width === host.width && prev.height === host.height
          ? prev
          : { width: host.width, height: host.height },
      );
      const node = root.querySelector('[data-onec-focus]');
      if (!node) {
        seenTarget.current = null;
        setBox((prev) => (prev === null ? prev : null));
        return;
      }
      const rect = node.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) {
        setBox((prev) => (prev === null ? prev : null));
        return;
      }
      const next = {
        x: rect.left - host.left,
        y: rect.top - host.top,
        width: rect.width,
        height: rect.height,
      };
      setBox((prev) =>
        prev &&
        prev.x === next.x &&
        prev.y === next.y &&
        prev.width === next.width &&
        prev.height === next.height
          ? prev
          : next,
      );
      if (node !== seenTarget.current) {
        seenTarget.current = node;
        node.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    };

    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(root);
    const mutationObserver = new MutationObserver(measure);
    mutationObserver.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-onec-focus'],
    });
    window.addEventListener('resize', measure);
    root.addEventListener('scroll', measure, true);
    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', measure);
      root.removeEventListener('scroll', measure, true);
    };
  }, [rootRef, revision, title, index]);

  const cardWidth = Math.min(340, Math.max(160, frame.width - 16));
  const cardHeight = Math.min(220, Math.max(120, frame.height - 16));
  let cardLeft = 8;
  let cardTop = Math.max(8, frame.height - cardHeight - 8);
  if (box && frame.width > 0) {
    const margin = 10;
    const candidates = [
      { left: box.x + box.width + margin, top: Math.max(8, box.y) },
      { left: Math.max(8, box.x), top: box.y + box.height + margin },
      { left: box.x - cardWidth - margin, top: Math.max(8, box.y) },
      { left: Math.max(8, box.x), top: box.y - cardHeight - margin },
    ];
    const fits = candidates.find((candidate) => {
      const left = candidate.left;
      const top = candidate.top;
      if (left < 8 || top < 8) return false;
      if (left + cardWidth > frame.width - 8) return false;
      if (top + cardHeight > frame.height - 8) return false;
      const overlaps =
        left < box.x + box.width &&
        left + cardWidth > box.x &&
        top < box.y + box.height &&
        top + cardHeight > box.y;
      return !overlaps;
    });
    if (fits) {
      cardLeft = fits.left;
      cardTop = fits.top;
    }
    cardLeft = Math.min(Math.max(8, cardLeft), Math.max(8, frame.width - cardWidth - 8));
    cardTop = Math.min(Math.max(8, cardTop), Math.max(8, frame.height - cardHeight - 8));
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {box ? (
        <div
          className="absolute rounded-sm"
          style={{
            left: box.x - 4,
            top: box.y - 4,
            width: box.width + 8,
            height: box.height + 8,
            boxShadow: '0 0 0 9999px rgba(32, 26, 12, 0.55)',
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-[rgba(32,26,12,0.45)]" />
      )}
      <div
        role="note"
        className="pointer-events-auto absolute overflow-auto rounded-md border border-[#e4d48a] bg-white text-[#1f1f1f] shadow-float"
        style={{ left: cardLeft, top: cardTop, width: cardWidth, maxHeight: cardHeight }}
      >
        <div className="border-l-4 border-[#f8d20a] px-3 py-2.5">
          <p className="text-[11px] text-[#6b5a28]">
            Шаг {index + 1} из {total}
          </p>
          <p className="mt-0.5 text-sm font-semibold leading-snug">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-[#3a3a3a]">{body}</p>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="mt-2 inline-flex min-h-11 items-center text-sm text-[#6b5a28] underline-offset-2 hover:underline md:min-h-8"
            >
              {closeLabel ?? 'Закрыть'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
