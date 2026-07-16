import type { ReactNode } from 'react';

import { StaticCode } from '@/components/sandbox/StaticCode';
import type { StaticCodeLang } from '@/lib/shiki';

interface CompareProps {
  leftTitle: string;
  rightTitle: string;
  left: ReactNode;
  right: ReactNode;
  // Язык подсветки для строковых (код) сторон. Указывайте, когда left/right -
  // это настоящий код: тогда он подсвечивается через StaticCode. Без него
  // многострочная строка всё равно отрисуется как структурированный блок.
  lang?: StaticCodeLang | undefined;
  verdict?: ReactNode | undefined;
}

const CODE_BLOCK_CLASS =
  'my-2 rounded-lg border border-border-base bg-code-bg p-3 text-[12px] font-mono text-fg leading-relaxed overflow-x-auto whitespace-pre';

// left/right приходят из MDX либо как JSX (<ul>…</ul>, проза), либо как
// template-литерал с кодом (left={`…`}). Голая многострочная строка в JSX
// схлопывается: HTML съедает переносы и отступы, и код выстраивается в одну
// строку. Поэтому строку с переносами рендерим как блок кода (сохраняя формат),
// а при заданном lang - с подсветкой. Однострочные строки-подписи и готовый
// JSX отдаём как есть.
const renderSide = (content: ReactNode, lang: StaticCodeLang | undefined): ReactNode => {
  if (typeof content === 'string' && content.includes('\n')) {
    return lang ? (
      <StaticCode code={content} lang={lang} className={CODE_BLOCK_CLASS} />
    ) : (
      <pre className={CODE_BLOCK_CLASS}>{content}</pre>
    );
  }
  return content;
};

const CompareColumn = ({
  title,
  lang,
  children,
}: {
  title: string;
  lang: StaticCodeLang | undefined;
  children: ReactNode;
}) => (
  <div className="min-w-0 flex-1 px-4 py-3">
    <div className="eyebrow mb-2">{title}</div>
    <div className="text-[14px] text-fg leading-relaxed [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:text-[12px]">
      {renderSide(children, lang)}
    </div>
  </div>
);

export const Compare = ({ leftTitle, rightTitle, left, right, lang, verdict }: CompareProps) => (
  <aside className="not-prose my-6 rounded-lg border border-border-base bg-surface overflow-hidden">
    <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border-base">
      <CompareColumn title={leftTitle} lang={lang}>
        {left}
      </CompareColumn>
      <CompareColumn title={rightTitle} lang={lang}>
        {right}
      </CompareColumn>
    </div>
    {verdict && (
      <div className="border-t-2 border-accent/60 bg-surface-2/50 px-4 py-2.5 text-[13px] text-fg-muted">
        {verdict}
      </div>
    )}
  </aside>
);
