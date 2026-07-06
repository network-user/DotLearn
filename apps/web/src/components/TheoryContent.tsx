import {
  Suspense,
  isValidElement,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';

import { MDXProvider } from '@mdx-js/react';
import { useNavigate } from '@tanstack/react-router';
import { ChevronRight, FlaskConical, Info, Lightbulb, Sparkles, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { CopyButton } from '@/components/playground/CopyButton';
import { ConceptContext, type ConceptRenderContext } from '@/lib/concept-context';
import { stashSandboxIncoming, type PlaygroundTab } from '@/lib/playground';
import { sanitizeHref } from '@/lib/safe-url';

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
import { Checkpoint } from '@/components/article/Checkpoint';
import { ConceptLink } from '@/components/article/ConceptLink';
import { Term } from '@/components/article/Term';
import { PyDemo } from '@/components/sandbox/PyDemo';
import { PyStepper } from '@/components/sandbox/PyStepper';
import { SideSql } from '@/components/sandbox/SideSql';
import { cx } from '@/components/ui/cx';
import { LightboxProvider } from '@/components/ui/Lightbox';
import { LightboxImage, withZoom } from '@/components/ui/Zoomable';
interface TheoryContentProps {
  Component: ComponentType<Record<string, unknown>>;
  topicSlug?: string;
  conceptId?: string;
  conceptTitle?: string;
}

const VizFallback = () => (
  <div
    className="not-prose my-6 h-56 rounded-lg border border-border-base bg-surface/60 animate-pulse"
    aria-hidden
  />
);

const lazyViz = (
  load: () => Promise<Record<string, unknown>>,
  exportName: string,
): ComponentType<Record<string, unknown>> => {
  const Lazy = lazy(async () => {
    const module = await load();
    return { default: module[exportName] as ComponentType<Record<string, unknown>> };
  });
  const Wrapped = (props: Record<string, unknown>) => (
    <Suspense fallback={<VizFallback />}>
      <Lazy {...props} />
    </Suspense>
  );
  Wrapped.displayName = `LazyViz(${exportName})`;
  return Wrapped;
};

const AccessScope = lazyViz(() => import('@/components/viz/AccessScope'), 'AccessScope');
const AggregateViz = lazyViz(() => import('@/components/viz/AggregateViz'), 'AggregateViz');
const CapTheoremFigure = lazyViz(
  () => import('@/components/viz/CapTheoremFigure'),
  'CapTheoremFigure',
);
const ClassFactory = lazyViz(() => import('@/components/viz/ClassFactory'), 'ClassFactory');
const CompositionViz = lazyViz(() => import('@/components/viz/CompositionViz'), 'CompositionViz');
const DocumentModelFigure = lazyViz(
  () => import('@/components/viz/DocumentModelFigure'),
  'DocumentModelFigure',
);
const GraphTraversalFigure = lazyViz(
  () => import('@/components/viz/GraphTraversalFigure'),
  'GraphTraversalFigure',
);
const GroupByViz = lazyViz(() => import('@/components/viz/GroupByViz'), 'GroupByViz');
const HashTableViz = lazyViz(() => import('@/components/viz/HashTableViz'), 'HashTableViz');
const HierarchyTreeFigure = lazyViz(
  () => import('@/components/viz/HierarchyTreeFigure'),
  'HierarchyTreeFigure',
);
const InheritanceTree = lazyViz(
  () => import('@/components/viz/InheritanceTree'),
  'InheritanceTree',
);
const JoinViz = lazyViz(() => import('@/components/viz/JoinViz'), 'JoinViz');
const KeyValueStoreFigure = lazyViz(
  () => import('@/components/viz/KeyValueStoreFigure'),
  'KeyValueStoreFigure',
);
const MergeStepper = lazyViz(() => import('@/components/viz/MergeStepper'), 'MergeStepper');
const NetworkModelFigure = lazyViz(
  () => import('@/components/viz/NetworkModelFigure'),
  'NetworkModelFigure',
);
const RefCountViz = lazyViz(() => import('@/components/viz/RefCountViz'), 'RefCountViz');
const WideColumnFigure = lazyViz(
  () => import('@/components/viz/WideColumnFigure'),
  'WideColumnFigure',
);

const CallStackViz = lazyViz(
  () => import('@/components/theory-viz/decorators/CallStackViz'),
  'CallStackViz',
);
const DecoratorWrap = lazyViz(
  () => import('@/components/theory-viz/decorators/DecoratorWrap'),
  'DecoratorWrap',
);
const AgentLoopDiagram = lazyViz(
  () => import('@/components/theory-viz/llm/AgentLoopDiagram'),
  'AgentLoopDiagram',
);
const AttentionHeatmap = lazyViz(
  () => import('@/components/theory-viz/llm/AttentionHeatmap'),
  'AttentionHeatmap',
);
const ContextWindowViz = lazyViz(
  () => import('@/components/theory-viz/llm/ContextWindowViz'),
  'ContextWindowViz',
);
const EmbeddingSpace = lazyViz(
  () => import('@/components/theory-viz/llm/EmbeddingSpace'),
  'EmbeddingSpace',
);
const McpDiagram = lazyViz(() => import('@/components/theory-viz/llm/McpDiagram'), 'McpDiagram');
const SamplingBars = lazyViz(
  () => import('@/components/theory-viz/llm/SamplingBars'),
  'SamplingBars',
);
const TokenizerViz = lazyViz(
  () => import('@/components/theory-viz/llm/TokenizerViz'),
  'TokenizerViz',
);
const ChainOfThoughtViz = lazyViz(
  () => import('@/components/theory-viz/prompt/ChainOfThoughtViz'),
  'ChainOfThoughtViz',
);
const FewShotViz = lazyViz(() => import('@/components/theory-viz/prompt/FewShotViz'), 'FewShotViz');
const PromptAnatomy = lazyViz(
  () => import('@/components/theory-viz/prompt/PromptAnatomy'),
  'PromptAnatomy',
);
const AnchorGridViz = lazyViz(
  () => import('@/components/theory-viz/yolo/AnchorGridViz'),
  'AnchorGridViz',
);
const IoUViz = lazyViz(() => import('@/components/theory-viz/yolo/IoUViz'), 'IoUViz');
const NmsViz = lazyViz(() => import('@/components/theory-viz/yolo/NmsViz'), 'NmsViz');
const PrCurve = lazyViz(() => import('@/components/theory-viz/yolo/PrCurve'), 'PrCurve');
const ActivationPlot = lazyViz(
  () => import('@/components/theory-viz/nn/ActivationPlot'),
  'ActivationPlot',
);
const GradientDescentViz = lazyViz(
  () => import('@/components/theory-viz/nn/GradientDescentViz'),
  'GradientDescentViz',
);
const LossLandscape = lazyViz(
  () => import('@/components/theory-viz/nn/LossLandscape'),
  'LossLandscape',
);
const NetworkDiagram = lazyViz(
  () => import('@/components/theory-viz/nn/NetworkDiagram'),
  'NetworkDiagram',
);
const PerceptronViz = lazyViz(
  () => import('@/components/theory-viz/nn/PerceptronViz'),
  'PerceptronViz',
);
const GitTerminal = lazyViz(() => import('@/components/theory-viz/git/GitTerminal'), 'GitTerminal');
const CollisionViz = lazyViz(
  () => import('@/components/theory-viz/hashing/CollisionViz'),
  'CollisionViz',
);
const ConsistentHashRing = lazyViz(
  () => import('@/components/theory-viz/hashing/ConsistentHashRing'),
  'ConsistentHashRing',
);
const HashFunctionViz = lazyViz(
  () => import('@/components/theory-viz/hashing/HashFunctionViz'),
  'HashFunctionViz',
);
const HashLoopDemo = lazyViz(
  () => import('@/components/theory-viz/hashing/HashLoopDemo'),
  'HashLoopDemo',
);
const LoadFactorViz = lazyViz(
  () => import('@/components/theory-viz/hashing/LoadFactorViz'),
  'LoadFactorViz',
);

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
    <aside className={cx('not-prose my-6 border-l-2 pl-4 py-1', tone.rule)} role="note">
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
          className={cx(
            'shrink-0 transition-transform duration-fast text-accent',
            open && 'rotate-90',
          )}
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

const diagramComponents = {
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
  Sketch,
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
  TokenizerViz,
};

const zoomableDiagrams: Record<string, ComponentType<Record<string, unknown>>> = Object.fromEntries(
  Object.entries(diagramComponents).map(([name, Component]) => [
    name,
    withZoom(Component as unknown as ComponentType<Record<string, unknown>>),
  ]),
);

const languageFromCodeChild = (children: ReactNode): string | undefined => {
  if (!isValidElement(children)) return undefined;
  const childClassName = (children.props as { className?: string }).className ?? '';
  const match = /language-([a-z0-9+-]+)/i.exec(childClassName);
  return match?.[1]?.toLowerCase();
};

const sandboxTabForLanguage = (language: string | undefined): PlaygroundTab | undefined => {
  if (language === 'python' || language === 'py') return 'python';
  if (language === 'sql') return 'sql';
  return undefined;
};

const CodeBlock = ({ children, ...rest }: React.HTMLAttributes<HTMLPreElement>) => {
  const { t } = useTranslation('viz');
  const navigate = useNavigate();
  const preRef = useRef<HTMLPreElement>(null);
  const [codeText, setCodeText] = useState('');

  useEffect(() => {
    setCodeText(preRef.current?.textContent ?? '');
  }, [children]);

  const sandboxTab = sandboxTabForLanguage(languageFromCodeChild(children));

  const handleOpenInSandbox = useCallback(() => {
    const code = preRef.current?.textContent ?? codeText;
    if (!sandboxTab || code.length === 0) return;
    void stashSandboxIncoming({ tab: sandboxTab, code }).then(() => navigate({ to: '/sandbox' }));
  }, [sandboxTab, codeText, navigate]);

  return (
    <div className="group relative my-6">
      <div className="absolute right-2 top-2 z-10 flex items-center gap-1 opacity-100 transition-opacity duration-fast md:opacity-0 md:focus-within:opacity-100 md:group-hover:opacity-100">
        {sandboxTab ? (
          <button
            type="button"
            onClick={handleOpenInSandbox}
            title={t('code.openInSandbox', { defaultValue: 'Открыть в песочнице' })}
            className="inline-flex min-h-[var(--tap)] items-center gap-1.5 rounded-md bg-surface-1/80 px-2 text-[11px] font-medium tracking-snug text-fg-subtle backdrop-blur transition-colors duration-fast hover:bg-surface-2/80 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 sm:min-h-0 sm:py-1"
          >
            <FlaskConical size={13} aria-hidden />
            <span>{t('code.openInSandbox', { defaultValue: 'В песочницу' })}</span>
          </button>
        ) : null}
        <CopyButton text={codeText} className="bg-surface-1/80 backdrop-blur" />
      </div>
      <pre
        ref={preRef}
        {...rest}
        className="rounded-lg border border-border-base bg-code-bg p-4 overflow-x-auto text-[13px] font-mono leading-relaxed"
      >
        {children}
      </pre>
    </div>
  );
};

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
  pre: CodeBlock,
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
    const safeHref = sanitizeHref(props.href);
    const external = safeHref?.startsWith('http') ?? false;
    return (
      <a
        {...props}
        href={safeHref}
        className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent transition-colors"
        target={external ? '_blank' : undefined}
        rel={external ? 'noreferrer' : undefined}
      />
    );
  },
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
  Checkpoint,
  Term,
  ConceptLink,
  SideViz,
  SideSql,
  PyDemo,
  PyStepper,
  PullQuote,
  MarginNote,
  Ref,
  Footnotes,
  Compare,
  SketchArrow,
  SketchBox,
  SketchHighlight,
  SketchLabel,
  DecoratorWrap,
  CallStackViz,
  IoUViz,
  AnchorGridViz,
  NmsViz,
  PrCurve,
  AttentionHeatmap,
  EmbeddingSpace,
  SamplingBars,
  ContextWindowViz,
  AgentLoopDiagram,
  McpDiagram,
  PromptAnatomy,
  FewShotViz,
  ChainOfThoughtViz,
  PerceptronViz,
  ActivationPlot,
  NetworkDiagram,
  GradientDescentViz,
  LossLandscape,
  GitTerminal,
  HashFunctionViz,
  HashLoopDemo,
  CollisionViz,
  LoadFactorViz,
  ConsistentHashRing,
  ...zoomableDiagrams,
  img: LightboxImage,
};

export const TheoryContent = ({
  Component,
  topicSlug,
  conceptId,
  conceptTitle,
}: TheoryContentProps) => {
  const conceptContextValue = useMemo<ConceptRenderContext | null>(
    () =>
      topicSlug && conceptId
        ? { topicSlug, conceptId, ...(conceptTitle !== undefined ? { conceptTitle } : {}) }
        : null,
    [topicSlug, conceptId, conceptTitle],
  );

  const content = (
    <LightboxProvider>
      <MDXProvider components={mdxComponents}>
        <FigureProvider>
          <FootnoteProvider>
            <div className="theory-content">
              <Component />
            </div>
          </FootnoteProvider>
        </FigureProvider>
      </MDXProvider>
    </LightboxProvider>
  );

  if (!conceptContextValue) return content;

  return <ConceptContext.Provider value={conceptContextValue}>{content}</ConceptContext.Provider>;
};
