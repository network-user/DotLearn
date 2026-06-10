import type { ReactNode } from 'react';

interface VizShellProps {
  label: string;
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

export const VizShell = ({ label, actions, children, footer }: VizShellProps) => (
  <aside className="not-prose my-6 rounded-lg border border-border-base bg-surface overflow-hidden shadow-card">
    <header className="flex items-center justify-between gap-2 px-3.5 py-2 border-b border-border-base bg-surface-2">
      <span className="text-[11px] uppercase tracking-widest text-fg-subtle">{label}</span>
      {actions && <div className="flex items-center gap-1.5">{actions}</div>}
    </header>
    <div className="p-4 overflow-x-auto">{children}</div>
    {footer !== undefined && (
      <footer className="px-4 py-2.5 border-t border-border-base/60 bg-surface text-[12.5px] leading-relaxed text-fg-muted min-h-[40px] flex items-center">
        {footer}
      </footer>
    )}
  </aside>
);

interface VizButtonProps {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
  tone?: 'accent' | 'ghost';
}

export const VizButton = ({ onClick, disabled, children, tone = 'accent' }: VizButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={
      tone === 'accent'
        ? 'inline-flex items-center gap-1.5 rounded-md px-2.5 h-7 text-[12px] font-medium bg-accent/12 text-accent hover:bg-accent/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-fast'
        : 'inline-flex items-center gap-1.5 rounded-md px-2.5 h-7 text-[12px] font-medium text-fg-muted hover:bg-surface-2/60 hover:text-fg disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-fast'
    }
  >
    {children}
  </button>
);
