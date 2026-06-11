import { useState, type ComponentType, type ReactNode } from 'react';

import { MDXProvider } from '@mdx-js/react';
import { ChevronRight, Info, Lightbulb, Sparkles, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  AreaChart,
  BarChart,
  Compare,
  DistributionChart,
  Figure,
  FigureProvider,
  FootnoteProvider,
  Footnotes,
  LineChart,
  MarginNote,
  MroFigure,
  NestedQueryFigure,
  ObjectMemoryFigure,
  PipelineFigure,
  PullQuote,
  Ref,
  RowFilterFigure,
  Sketch,
  SketchArrow,
  SketchBox,
  SketchHighlight,
  SketchLabel,
  SortLimitFigure,
} from '@/components/article';
import { PyDemo } from '@/components/sandbox/PyDemo';
import { PyStepper } from '@/components/sandbox/PyStepper';
import { SideSql } from '@/components/sandbox/SideSql';
import { cx } from '@/components/ui/cx';
import { AccessScope } from '@/components/viz/AccessScope';
import { AggregateViz } from '@/components/viz/AggregateViz';
import { CapTheoremFigure } from '@/components/viz/CapTheoremFigure';
import { ClassFactory } from '@/components/viz/ClassFactory';
import { CompositionViz } from '@/components/viz/CompositionViz';
import { DocumentModelFigure } from '@/components/viz/DocumentModelFigure';
import { GraphTraversalFigure } from '@/components/viz/GraphTraversalFigure';
import { GroupByViz } from '@/components/viz/GroupByViz';
import { HashTableViz } from '@/components/viz/HashTableViz';
import { HierarchyTreeFigure } from '@/components/viz/HierarchyTreeFigure';
import { InheritanceTree } from '@/components/viz/InheritanceTree';
import { JoinViz } from '@/components/viz/JoinViz';
import { KeyValueStoreFigure } from '@/components/viz/KeyValueStoreFigure';
import { MergeStepper } from '@/components/viz/MergeStepper';
import { NetworkModelFigure } from '@/components/viz/NetworkModelFigure';
import { RefCountViz } from '@/components/viz/RefCountViz';
import { WideColumnFigure } from '@/components/viz/WideColumnFigure';

interface TheoryContentProps {
  Component: ComponentType<Record<string, unknown>>;
}

const slugify = (children: ReactNode): string => {
  const text =
    typeof children === 'string'
      ? children
      : Array.isArray(children)
        ? children.map((c) => (typeof c === 'string' ? c : '')).join('')
        : '';
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-zа-яё0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 64);
};

type CalloutTone = 'info' | 'warning' | 'success' | 'tip';

const calloutTone: Record<
  CalloutTone,
  { rule: string; text: string; icon: ReactNode; labelKey: string; fallback: string }
> = {
  info: {
    rule: 'border-l-info',
    text: 'text-info',
    icon: <Info size={13} />,
    labelKey: 'callout.info',
    fallback: 'К сведению',
  },
  warning: {
    rule: 'border-l-warn',
    text: 'text-warn',
    icon: <TriangleAlert size={13} />,
    labelKey: 'callout.warning',
    fallback: 'Осторожно',
  },
  success: {
    rule: 'border-l-ok',
    text: 'text-ok',
    icon: <Sparkles size={13} />,
    labelKey: 'callout.success',
    fallback: 'Получилось',
  },
  tip: {
    rule: 'border-l-accent',
    text: 'text-accent',
    icon: <Lightbulb size={13} />,
    labelKey: 'callout.tip',
    fallback: 'Совет',
  },
};

const Callout = ({
  type = 'info',
  title,
  children,
}: {
  type?: CalloutTone;
  title?: string;
  children: ReactNode;
}) => {
  const { t } = useTranslation('viz');
  const tone = calloutTone[type];
  return (
    <aside
      className={cx('not-prose my-6 border-l-2 pl-4 py-1', tone.rule)}
      role="note"
    >
      <div className={cx('flex items-center gap-1.5 eyebrow mb-1.5', tone.text)}>
        {tone.icon}
        {title ?? t(tone.labelKey, { defaultValue: tone.fallback })}
      </div>
      <div className="text-[14.5px] text-fg-muted leading-relaxed [&_p:first-child]:mt-0 [&_p:last-child]:mb-0">
        {children}
      </div>
    </aside>
  );
};

const Detail = ({
  summary,
  children,
  defaultOpen = false,
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="not-prose my-5 border border-border-base rounded-lg bg-surface overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3 min-h-[var(--tap)] sm:min-h-0 flex items-center gap-2 text-left text-fg hover:bg-surface-2/50 transition-colors"
        aria-expanded={open}
      >
        <ChevronRight
          size={16}
          className={cx('shrink-0 transition-transform duration-fast text-accent', open && 'rotate-90')}
        />
        <span className="font-medium text-[14px]">{summary}</span>
      </button>
      <div
        className={cx(
          'grid transition-[grid-template-rows] duration-med ease-standard',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-1 text-[14px] text-fg-muted leading-relaxed border-t border-border-base/60 [&_p:first-child]:mt-2 [&_p:last-child]:mb-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

const Steps = ({ children }: { children: ReactNode }) => (
  <ol className="not-prose my-6 space-y-3 [counter-reset:steps]">
    {Array.isArray(children)
      ? children.map((child, index) => (
          <li
            key={index}
            className="relative pl-10 [counter-increment:steps] before:content-[counter(steps)] before:absolute before:left-0 before:top-0 before:grid before:place-items-center before:size-7 before:rounded-full before:border before:border-accent/50 before:text-accent before:text-[13px] before:font-semibold before:font-display"
          >
            <div className="text-[14.5px] text-fg leading-relaxed [&_p:first-child]:mt-0 [&_p:last-child]:mb-0">
              {child}
            </div>
          </li>
        ))
      : children}
  </ol>
);

const KeyTakeaways = ({ items, title }: { items: string[]; title?: string }) => {
  const { t } = useTranslation('viz');
  return (
    <aside className="not-prose my-8 border-y-[3px] border-double border-border-strong px-1 py-4">
      <div className="eyebrow eyebrow-accent mb-2.5">
        {title ?? t('takeaways.title', { defaultValue: 'Главное' })}
      </div>
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li
            key={index}
            className="relative pl-5 text-[14.5px] font-serif text-fg leading-relaxed before:content-['—'] before:absolute before:left-0 before:text-accent"
          >
            {item}
          </li>
        ))}
      </ul>
    </aside>
  );
};

const SideViz = ({ title, children }: { title?: string; children: ReactNode }) => (
  <aside className="not-prose my-5 lg:float-right lg:clear-right lg:ml-6 lg:mr-[-32px] lg:w-[280px] xl:w-[320px] rounded-lg border border-border-base bg-surface p-4">
    {title && <div className="eyebrow mb-2">{title}</div>}
    <div className="text-[13px] text-fg-muted leading-relaxed">{children}</div>
  </aside>
);

const mdxComponents = {
  h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1
      id={slugify(props.children)}
      {...props}
      className="font-display font-medium text-3xl md:text-[36px] leading-[1.15] tracking-snug text-fg mt-10 mb-5 [text-wrap:balance]"
    />
  ),
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2
      id={slugify(props.children)}
      data-toc="h2"
      {...props}
      className="font-display font-semibold text-2xl md:text-[30px] leading-[1.15] tracking-tightish text-fg mt-14 mb-4 scroll-mt-36 lg:scroll-mt-24 [text-wrap:balance]"
    />
  ),
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3
      id={slugify(props.children)}
      data-toc="h3"
      {...props}
      className="font-display text-[21px] font-semibold tracking-snug text-fg mt-10 mb-3 scroll-mt-36 lg:scroll-mt-24"
    />
  ),
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p {...props} className="font-serif text-fg leading-[1.7] my-5 text-[19px]" />
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul
      {...props}
      className="list-disc pl-6 my-5 font-serif text-fg space-y-2.5 marker:text-fg-subtle"
    />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol
      {...props}
      className="list-decimal pl-6 my-5 font-serif text-fg space-y-2.5 marker:text-fg-subtle marker:font-medium"
    />
  ),
  li: (props: React.HTMLAttributes<HTMLLIElement>) => (
    <li {...props} className="leading-[1.65] text-[18px]" />
  ),
  code: (props: React.HTMLAttributes<HTMLElement>) => {
    const className = props.className ?? '';
    if (className.includes('language-')) {
      return <code {...props} />;
    }
    return (
      <code
        {...props}
        className="rounded-sm bg-code-bg px-1.5 py-0.5 text-[0.82em] text-accent font-mono not-italic"
      />
    );
  },
  pre: (props: React.HTMLAttributes<HTMLPreElement>) => (
    <pre
      {...props}
      className="rounded-lg border border-border-base bg-code-bg p-4 my-6 overflow-x-auto text-[13px] font-mono leading-relaxed"
    />
  ),
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      {...props}
      className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent transition-colors"
      target={props.href?.startsWith('http') ? '_blank' : undefined}
      rel={props.href?.startsWith('http') ? 'noreferrer' : undefined}
    />
  ),
  blockquote: (props: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      {...props}
      className="border-l-2 border-accent pl-4 font-serif italic text-fg-muted my-6 [&_p]:text-[16.5px]"
    />
  ),
  hr: (props: React.HTMLAttributes<HTMLHRElement>) => (
    <hr {...props} className="ornament-divider" />
  ),
  table: (props: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="my-6 overflow-x-auto">
      <table {...props} className="table-print min-w-full text-sm" />
    </div>
  ),
  th: (props: React.HTMLAttributes<HTMLTableCellElement>) => <th {...props} />,
  td: (props: React.HTMLAttributes<HTMLTableCellElement>) => (
    <td {...props} className="align-top text-fg" />
  ),
  Callout,
  Detail,
  Steps,
  KeyTakeaways,
  SideViz,
  SideSql,
  PyDemo,
  PyStepper,
  AccessScope,
  AggregateViz,
  CapTheoremFigure,
  ClassFactory,
  CompositionViz,
  DocumentModelFigure,
  GraphTraversalFigure,
  GroupByViz,
  HashTableViz,
  HierarchyTreeFigure,
  InheritanceTree,
  JoinViz,
  KeyValueStoreFigure,
  MergeStepper,
  NetworkModelFigure,
  RefCountViz,
  WideColumnFigure,
  Figure,
  PullQuote,
  MarginNote,
  Ref,
  Footnotes,
  Compare,
  Sketch,
  SketchArrow,
  SketchBox,
  SketchHighlight,
  SketchLabel,
  PipelineFigure,
  RowFilterFigure,
  SortLimitFigure,
  NestedQueryFigure,
  ObjectMemoryFigure,
  MroFigure,
  BarChart,
  LineChart,
  AreaChart,
  DistributionChart,
};

export const TheoryContent = ({ Component }: TheoryContentProps) => (
  <MDXProvider components={mdxComponents}>
    <FigureProvider>
      <FootnoteProvider>
        <div className="theory-content">
          <Component />
        </div>
      </FootnoteProvider>
    </FigureProvider>
  </MDXProvider>
);
