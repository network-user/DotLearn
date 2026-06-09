import { useState, type ComponentType, type ReactNode } from 'react';

import { MDXProvider } from '@mdx-js/react';
import { ChevronRight, Info, Lightbulb, Sparkles, TriangleAlert } from 'lucide-react';

import { cx } from '@/components/ui/cx';

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
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 64);
};

type CalloutTone = 'info' | 'warning' | 'success' | 'tip';

const calloutTone: Record<CalloutTone, { wrap: string; icon: ReactNode; label: string }> = {
  info: {
    wrap: 'border-sky-500/30 bg-sky-500/8',
    icon: <Info size={14} />,
    label: 'Info',
  },
  warning: {
    wrap: 'border-amber-500/30 bg-amber-500/8',
    icon: <TriangleAlert size={14} />,
    label: 'Watch out',
  },
  success: {
    wrap: 'border-emerald-500/30 bg-emerald-500/8',
    icon: <Sparkles size={14} />,
    label: 'Nice',
  },
  tip: {
    wrap: 'border-accent/30 bg-accent/8',
    icon: <Lightbulb size={14} />,
    label: 'Tip',
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
  const tone = calloutTone[type];
  return (
    <aside
      className={cx(
        'not-prose my-5 rounded-xl border px-4 py-3 text-[14px] text-fg flex gap-3 items-start',
        tone.wrap,
      )}
      role="note"
    >
      <span className="mt-0.5 grid place-items-center size-6 rounded-md bg-surface/40 text-fg">
        {tone.icon}
      </span>
      <div className="min-w-0 flex-1 leading-relaxed">
        {title && <div className="font-semibold text-fg mb-1">{title}</div>}
        <div className="text-fg-muted [&_p:first-child]:mt-0 [&_p:last-child]:mb-0">
          {children}
        </div>
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
    <div className="not-prose my-4 rounded-xl border border-border-base bg-surface/40 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3 flex items-center gap-2 text-left text-fg hover:bg-surface-2/40 transition-colors"
        aria-expanded={open}
      >
        <ChevronRight
          size={16}
          className={cx('shrink-0 transition-transform duration-fast', open && 'rotate-90')}
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
          <div className="px-4 pb-4 pt-1 text-[14px] text-fg-muted leading-relaxed [&_p:first-child]:mt-0 [&_p:last-child]:mb-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

const Steps = ({ children }: { children: ReactNode }) => (
  <ol className="not-prose my-5 space-y-3 [counter-reset:steps]">
    {Array.isArray(children)
      ? children.map((child, index) => (
          <li
            key={index}
            className="relative pl-10 [counter-increment:steps] before:content-[counter(steps)] before:absolute before:left-0 before:top-0 before:grid before:place-items-center before:size-7 before:rounded-full before:bg-accent/12 before:text-accent before:text-[13px] before:font-semibold"
          >
            <div className="text-[14px] text-fg leading-relaxed [&_p:first-child]:mt-0 [&_p:last-child]:mb-0">
              {child}
            </div>
          </li>
        ))
      : children}
  </ol>
);

const KeyTakeaways = ({ items, title = 'Key takeaways' }: { items: string[]; title?: string }) => (
  <aside className="not-prose my-6 rounded-xl border border-accent/25 bg-gradient-to-br from-accent/8 to-accent-3/8 px-5 py-4">
    <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-fg-subtle">
      <Sparkles size={12} className="text-accent" />
      {title}
    </div>
    <ul className="mt-2 space-y-1.5">
      {items.map((item, index) => (
        <li
          key={index}
          className="relative pl-5 text-[14px] text-fg leading-relaxed before:content-['—'] before:absolute before:left-0 before:text-accent"
        >
          {item}
        </li>
      ))}
    </ul>
  </aside>
);

const SideViz = ({ title, children }: { title?: string; children: ReactNode }) => (
  <aside className="not-prose my-5 lg:float-right lg:clear-right lg:ml-6 lg:mr-[-32px] lg:w-[280px] xl:w-[320px] rounded-xl border border-border-base bg-surface/40 backdrop-blur-soft p-4 shadow-card">
    {title && (
      <div className="text-[11px] uppercase tracking-widest text-fg-subtle mb-2">{title}</div>
    )}
    <div className="text-[13px] text-fg-muted leading-relaxed">{children}</div>
  </aside>
);

const mdxComponents = {
  h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1
      id={slugify(props.children)}
      {...props}
      className="font-display text-3xl md:text-[36px] leading-tight tracking-tightish text-fg mt-10 mb-4"
    />
  ),
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2
      id={slugify(props.children)}
      data-toc="h2"
      {...props}
      className="font-display text-2xl md:text-[28px] leading-tight tracking-tightish text-fg mt-10 mb-3 scroll-mt-24"
    />
  ),
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3
      id={slugify(props.children)}
      data-toc="h3"
      {...props}
      className="text-lg font-semibold tracking-snug text-fg mt-7 mb-2 scroll-mt-24"
    />
  ),
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p {...props} className="text-fg leading-relaxed my-3 text-[15.5px]" />
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul {...props} className="list-disc pl-6 my-3 text-fg space-y-1.5 marker:text-accent/70" />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol
      {...props}
      className="list-decimal pl-6 my-3 text-fg space-y-1.5 marker:text-accent/70 marker:font-medium"
    />
  ),
  li: (props: React.HTMLAttributes<HTMLLIElement>) => (
    <li {...props} className="leading-relaxed text-[15.5px]" />
  ),
  code: (props: React.HTMLAttributes<HTMLElement>) => {
    const className = props.className ?? '';
    if (className.includes('language-')) {
      return <code {...props} />;
    }
    return (
      <code
        {...props}
        className="rounded-md bg-surface-2/80 px-1.5 py-0.5 text-[0.88em] text-accent font-mono"
      />
    );
  },
  pre: (props: React.HTMLAttributes<HTMLPreElement>) => (
    <pre
      {...props}
      className="rounded-xl border border-border-base bg-canvas/80 backdrop-blur-soft p-4 my-5 overflow-x-auto text-[13px] font-mono leading-relaxed shadow-card"
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
      className="border-l-2 border-accent pl-4 italic text-fg-muted my-5"
    />
  ),
  hr: (props: React.HTMLAttributes<HTMLHRElement>) => (
    <hr {...props} className="my-8 border-border-base" />
  ),
  table: (props: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="my-5 overflow-x-auto rounded-xl border border-border-base">
      <table {...props} className="min-w-full text-sm" />
    </div>
  ),
  th: (props: React.HTMLAttributes<HTMLTableCellElement>) => (
    <th
      {...props}
      className="px-3 py-2 text-left text-[11px] uppercase tracking-widest font-medium text-fg-subtle bg-surface/60 border-b border-border-base"
    />
  ),
  td: (props: React.HTMLAttributes<HTMLTableCellElement>) => (
    <td
      {...props}
      className="px-3 py-2 align-top text-fg border-b border-border-base/60 last:border-b-0"
    />
  ),
  Callout,
  Detail,
  Steps,
  KeyTakeaways,
  SideViz,
};

export const TheoryContent = ({ Component }: TheoryContentProps) => (
  <MDXProvider components={mdxComponents}>
    <div className="theory-content">
      <Component />
    </div>
  </MDXProvider>
);
