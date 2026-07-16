import { useCallback, useEffect, useRef, useState } from 'react';

import type { EditorProps } from '@monaco-editor/react';

import { LazyCodeEditor } from '@/components/sandbox/LazyCodeEditor';
import { StaticCode } from '@/components/sandbox/StaticCode';
import { cx } from '@/components/ui/cx';
import type { StaticCodeLang } from '@/lib/shiki';

interface DeferredCodeEditorProps extends EditorProps {
  height: string;
  sqlSchema?: string;
}

const toStaticCodeLang = (language: string | undefined): StaticCodeLang =>
  language === 'sql' ? 'sql' : 'python';

// Нижняя граница высоты редактора при ручном ресайзе - чтобы его нельзя было
// схлопнуть в нечитаемую полоску.
const MIN_EDITOR_HEIGHT = 120;

export const DeferredCodeEditor = ({ height, ...editorProps }: DeferredCodeEditorProps) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(() => typeof IntersectionObserver === 'undefined');
  // null → используем высоту по умолчанию из пропа height; число → пользователь
  // перетащил ручку и зафиксировал свою высоту.
  const [customHeight, setCustomHeight] = useState<number | null>(null);

  useEffect(() => {
    if (active) return;
    const node = wrapperRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setActive(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setActive(true);
          observer.disconnect();
        }
      },
      { rootMargin: '600px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [active]);

  const activate = useCallback(() => setActive(true), []);

  // Тащим нижнюю ручку - меняем высоту вьюпорта редактора. Monaco с height="100%"
  // и automaticLayout сам переразмечается под новый размер. Слушатели вешаем на
  // document, чтобы не терять курсор при быстром движении за пределы ручки.
  const startResize = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.pointerType === 'mouse') return;
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = viewportRef.current?.getBoundingClientRect().height ?? MIN_EDITOR_HEIGHT;
    const onMove = (moveEvent: PointerEvent): void => {
      const next = Math.max(
        MIN_EDITOR_HEIGHT,
        Math.round(startHeight + (moveEvent.clientY - startY)),
      );
      setCustomHeight(next);
    };
    const onUp = (): void => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const staticValue = typeof editorProps.value === 'string' ? editorProps.value : '';
  const staticLang = toStaticCodeLang(editorProps.language);
  const viewportStyle = customHeight != null ? { height: `${customHeight}px` } : { height };

  return (
    <div
      ref={wrapperRef}
      onPointerEnter={active ? undefined : activate}
      onTouchStart={active ? undefined : activate}
      onFocus={active ? undefined : activate}
    >
      <div ref={viewportRef} style={viewportStyle} className="overflow-hidden">
        {active ? (
          <LazyCodeEditor height="100%" {...editorProps} />
        ) : (
          <div className="h-full overflow-hidden bg-[rgb(var(--editor-bg))]">
            <StaticCode
              code={staticValue}
              lang={staticLang}
              className="m-0 h-full overflow-hidden px-4 py-3 font-mono text-[13px] leading-relaxed text-fg"
            />
          </div>
        )}
      </div>
      <div
        role="separator"
        aria-orientation="horizontal"
        aria-label="Изменить высоту редактора"
        onPointerDown={startResize}
        className={cx(
          'group flex h-3.5 shrink-0 cursor-ns-resize touch-none select-none items-center justify-center',
          'border-t border-border-base bg-surface-2/50 hover:bg-surface-2 transition-colors',
        )}
      >
        <span className="h-[3px] w-8 rounded-full bg-fg-subtle/35 transition-colors group-hover:bg-fg-subtle/70" />
      </div>
    </div>
  );
};
