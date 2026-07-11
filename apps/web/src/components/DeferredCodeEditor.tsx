import { useCallback, useEffect, useRef, useState } from 'react';

import type { EditorProps } from '@monaco-editor/react';

import { LazyCodeEditor } from '@/components/sandbox/LazyCodeEditor';
import { StaticCode } from '@/components/sandbox/StaticCode';
import type { StaticCodeLang } from '@/lib/shiki';

interface DeferredCodeEditorProps extends EditorProps {
  height: string;
  sqlSchema?: string;
}

const toStaticCodeLang = (language: string | undefined): StaticCodeLang =>
  language === 'sql' ? 'sql' : 'python';

export const DeferredCodeEditor = ({ height, ...editorProps }: DeferredCodeEditorProps) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(() => typeof IntersectionObserver === 'undefined');

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

  const staticValue = typeof editorProps.value === 'string' ? editorProps.value : '';
  const staticLang = toStaticCodeLang(editorProps.language);

  return (
    <div
      ref={wrapperRef}
      onPointerEnter={active ? undefined : activate}
      onTouchStart={active ? undefined : activate}
      onFocus={active ? undefined : activate}
    >
      {active ? (
        <LazyCodeEditor height={height} {...editorProps} />
      ) : (
        <div style={{ height }} className="overflow-hidden bg-code-bg">
          <StaticCode
            code={staticValue}
            lang={staticLang}
            className="m-0 h-full overflow-hidden px-4 py-3 font-mono text-[13px] leading-relaxed text-fg"
          />
        </div>
      )}
    </div>
  );
};
