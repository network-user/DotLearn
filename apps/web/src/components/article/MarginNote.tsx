import type { ReactNode } from 'react';

interface MarginNoteProps {
  children: ReactNode;
  label?: string | undefined;
}

export const MarginNote = ({ children, label }: MarginNoteProps) => (
  <aside className="not-prose my-5 lg:float-right lg:clear-right lg:ml-6 lg:mr-[-32px] lg:w-[260px] xl:w-[300px] border-l-2 border-accent/50 pl-4 py-1">
    {label && <div className="eyebrow mb-1.5">{label}</div>}
    <div className="text-[13.5px] font-serif italic text-fg-muted leading-relaxed [&_p:first-child]:mt-0 [&_p:last-child]:mb-0">
      {children}
    </div>
  </aside>
);
