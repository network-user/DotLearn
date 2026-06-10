import type { ReactNode } from 'react';

interface CompareProps {
  leftTitle: string;
  rightTitle: string;
  left: ReactNode;
  right: ReactNode;
  verdict?: ReactNode | undefined;
}

const CompareColumn = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="min-w-0 flex-1 px-4 py-3">
    <div className="eyebrow mb-2">{title}</div>
    <div className="text-[14px] text-fg leading-relaxed [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:text-[12px]">
      {children}
    </div>
  </div>
);

export const Compare = ({ leftTitle, rightTitle, left, right, verdict }: CompareProps) => (
  <aside className="not-prose my-6 rounded-lg border border-border-base bg-surface overflow-hidden">
    <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-border-base">
      <CompareColumn title={leftTitle}>{left}</CompareColumn>
      <CompareColumn title={rightTitle}>{right}</CompareColumn>
    </div>
    {verdict && (
      <div className="border-t-2 border-accent/60 bg-surface-2/50 px-4 py-2.5 text-[13px] text-fg-muted">
        {verdict}
      </div>
    )}
  </aside>
);
