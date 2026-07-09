import { useEffect, useState } from 'react';

import { cx } from '@/components/ui/cx';
import { highlightStatic, type StaticCodeLang } from '@/lib/shiki';

interface StaticCodeProps {
  code: string;
  lang: StaticCodeLang;
  className: string;
}

// Renders read-only code (predict-output fixtures/snippets, solution reveal)
// with Shiki syntax highlighting outside of MDX theory content. Starts as a
// plain <pre> (no regression while the highlighter loads/fails) and swaps in
// highlighted markup once ready.
export const StaticCode = ({ code, lang, className }: StaticCodeProps) => {
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setHtml(null);
    void highlightStatic(code, lang).then((result) => {
      if (!cancelled) setHtml(result);
    });
    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  if (html === null) {
    return <pre className={className}>{code}</pre>;
  }

  return (
    <pre className={cx(className, 'shiki')}>
      <code dangerouslySetInnerHTML={{ __html: html }} />
    </pre>
  );
};
