import type { ComponentType } from 'react';

import { MDXProvider } from '@mdx-js/react';

interface TheoryContentProps {
  Component: ComponentType<Record<string, unknown>>;
}

const mdxComponents = {
  h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 {...props} className="text-2xl font-semibold tracking-tight text-zinc-50 mt-8 mb-4" />
  ),
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 {...props} className="text-xl font-semibold tracking-tight text-zinc-100 mt-8 mb-3" />
  ),
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 {...props} className="text-lg font-semibold text-zinc-100 mt-6 mb-2" />
  ),
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p {...props} className="text-zinc-300 leading-relaxed my-3" />
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul {...props} className="list-disc pl-6 my-3 text-zinc-300 space-y-1" />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol {...props} className="list-decimal pl-6 my-3 text-zinc-300 space-y-1" />
  ),
  li: (props: React.HTMLAttributes<HTMLLIElement>) => (
    <li {...props} className="leading-relaxed" />
  ),
  code: (props: React.HTMLAttributes<HTMLElement>) => {
    const className = props.className ?? '';
    if (className.includes('language-')) {
      return <code {...props} />;
    }
    return (
      <code
        {...props}
        className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-[0.9em] text-indigo-200 font-mono"
      />
    );
  },
  pre: (props: React.HTMLAttributes<HTMLPreElement>) => (
    <pre
      {...props}
      className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-4 my-4 overflow-x-auto text-sm font-mono"
    />
  ),
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      {...props}
      className="text-indigo-300 underline decoration-indigo-700 underline-offset-2 hover:text-indigo-200"
      target={props.href?.startsWith('http') ? '_blank' : undefined}
      rel={props.href?.startsWith('http') ? 'noreferrer' : undefined}
    />
  ),
  blockquote: (props: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      {...props}
      className="border-l-2 border-indigo-700 pl-4 italic text-zinc-400 my-4"
    />
  ),
};

export const TheoryContent = ({ Component }: TheoryContentProps) => (
  <MDXProvider components={mdxComponents}>
    <Component />
  </MDXProvider>
);
