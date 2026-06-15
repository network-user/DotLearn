import { useEffect, useRef, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { cx } from '@/components/ui/cx';
import { addHighlight, type HighlightColor } from '@/lib/progress-db';

const COLORS: { id: HighlightColor; swatch: string }[] = [
  { id: 'yellow', swatch: 'bg-amber-300' },
  { id: 'green', swatch: 'bg-emerald-300' },
  { id: 'blue', swatch: 'bg-sky-300' },
  { id: 'pink', swatch: 'bg-pink-300' },
];

interface TheoryHighlighterProps {
  slug: string;
  conceptId: string;
}

interface ToolbarState {
  x: number;
  y: number;
  text: string;
}

export const TheoryHighlighter = ({ slug, conceptId }: TheoryHighlighterProps) => {
  const { t } = useTranslation('topic');
  const [toolbar, setToolbar] = useState<ToolbarState | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setToolbar(null);
    const container = document.querySelector('[data-toc-root]');
    if (!container) return;

    const compute = (): void => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        setToolbar(null);
        return;
      }
      const text = selection.toString().trim();
      if (text.length < 3) {
        setToolbar(null);
        return;
      }
      const { anchorNode, focusNode } = selection;
      if (
        !anchorNode ||
        !focusNode ||
        !container.contains(anchorNode) ||
        !container.contains(focusNode)
      ) {
        setToolbar(null);
        return;
      }
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        setToolbar(null);
        return;
      }
      const x = Math.min(Math.max(rect.left + rect.width / 2, 84), window.innerWidth - 84);
      setToolbar({ x, y: rect.top, text });
    };

    const onPointerUp = (event: Event): void => {
      const target = event.target as Node | null;
      if (barRef.current && target && barRef.current.contains(target)) return;
      window.setTimeout(compute, 0);
    };
    const onSelectionChange = (): void => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) setToolbar(null);
    };
    const onScroll = (): void => setToolbar(null);

    document.addEventListener('mouseup', onPointerUp);
    document.addEventListener('touchend', onPointerUp);
    document.addEventListener('selectionchange', onSelectionChange);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      document.removeEventListener('mouseup', onPointerUp);
      document.removeEventListener('touchend', onPointerUp);
      document.removeEventListener('selectionchange', onSelectionChange);
      window.removeEventListener('scroll', onScroll);
    };
  }, [conceptId]);

  const save = (color: HighlightColor): void => {
    if (!toolbar) return;
    void addHighlight({ topicSlug: slug, conceptId, text: toolbar.text, color });
    window.getSelection()?.removeAllRanges();
    setToolbar(null);
    toast.success(t('highlight.saved'));
  };

  if (!toolbar) return null;

  return (
    <div
      ref={barRef}
      className="fixed z-[var(--z-tooltip)] -translate-x-1/2 -translate-y-full"
      style={{ left: toolbar.x, top: toolbar.y - 8 }}
    >
      <div className="flex items-center gap-1.5 rounded-full border border-border-base glass-strong shadow-float px-2 py-1.5">
        {COLORS.map((color) => (
          <button
            key={color.id}
            type="button"
            aria-label={t(`highlight.colors.${color.id}`)}
            title={t(`highlight.colors.${color.id}`)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => save(color.id)}
            className={cx(
              'size-6 rounded-full border border-black/10 transition-transform hover:scale-110 dark:border-white/15',
              color.swatch,
            )}
          />
        ))}
      </div>
    </div>
  );
};
