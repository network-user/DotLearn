import type { ReactNode } from 'react';

interface PullQuoteProps {
  children: ReactNode;
  attribution?: string | undefined;
}

export const PullQuote = ({ children, attribution }: PullQuoteProps) => (
  <aside className="not-prose my-9 mx-auto max-w-[34rem] text-center">
    <span aria-hidden className="block font-display text-[44px] leading-none text-accent">
      «
    </span>
    <blockquote className="font-display text-[22px] sm:text-[25px] leading-snug text-fg [text-wrap:balance]">
      {children}
    </blockquote>
    {attribution && <p className="mt-3 eyebrow">{attribution}</p>}
    <span aria-hidden className="mt-5 mx-auto block h-0.5 w-12 bg-accent" />
  </aside>
);
