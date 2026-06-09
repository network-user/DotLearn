import { useState } from 'react';

import { motion, useReducedMotion } from 'framer-motion';
import { Check, Lock, TriangleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cx } from '@/components/ui/cx';

import { VizShell } from './VizShell';

type AccessKind = 'public' | 'protected' | 'private';

interface AccessRow {
  name: string;
  kind: AccessKind;
  value: string;
}

interface AccessScopeProps {
  className?: string;
  instanceName?: string;
  rows?: AccessRow[];
  label?: string;
}

const defaultRows: AccessRow[] = [
  { name: 'balance', kind: 'public', value: '1200' },
  { name: '_rate', kind: 'protected', value: '0.04' },
  { name: '__pin', kind: 'private', value: '4310' },
];

const kindStyle: Record<AccessKind, { ring: string; chip: string }> = {
  public: {
    ring: 'border-emerald-500/60 bg-emerald-500/10',
    chip: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
  },
  protected: {
    ring: 'border-amber-500/60 bg-amber-500/10',
    chip: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
  },
  private: {
    ring: 'border-rose-500/60 bg-rose-500/10',
    chip: 'bg-rose-500/15 text-rose-600 dark:text-rose-300',
  },
};

export const AccessScope = ({
  className = 'BankAccount',
  instanceName = 'acc',
  rows = defaultRows,
  label,
}: AccessScopeProps) => {
  const { t } = useTranslation('viz');
  const reduceMotion = useReducedMotion();
  const [probe, setProbe] = useState<AccessRow | null>(null);

  const mangled = (name: string): string => `_${className}${name}`;

  const footer = probe ? (
    probe.kind === 'private' ? (
      <span className="text-rose-500 dark:text-rose-300">
        {t('access.private', { mangled: mangled(probe.name) })}
      </span>
    ) : probe.kind === 'protected' ? (
      <span className="text-amber-600 dark:text-amber-300">{t('access.protected')}</span>
    ) : (
      <span className="text-emerald-600 dark:text-emerald-300">{t('access.public')}</span>
    )
  ) : (
    t('access.idle')
  );

  return (
    <VizShell label={label ?? t('access.label')} footer={footer}>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_max-content] gap-4 items-start">
        <div className="rounded-xl border border-border-base bg-surface-2/40 px-4 py-3">
          <div className="font-mono text-[13px] font-semibold text-fg mb-2">
            class {className}:
          </div>
          <ul className="space-y-1.5">
            {rows.map((row) => {
              const active = probe?.name === row.name;
              return (
                <motion.li
                  key={row.name}
                  animate={
                    active && !reduceMotion
                      ? { x: [0, -3, 3, -2, 0] }
                      : { x: 0 }
                  }
                  transition={{ duration: 0.35 }}
                  className={cx(
                    'flex items-center gap-2 rounded-lg border px-2.5 py-1.5 font-mono text-[12.5px] transition-colors duration-fast',
                    active ? kindStyle[row.kind].ring : 'border-transparent',
                  )}
                >
                  <span className={cx('rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider', kindStyle[row.kind].chip)}>
                    {row.kind === 'private' ? <Lock size={10} className="inline" /> : null}{' '}
                    {row.kind}
                  </span>
                  <span className="text-accent">self.{row.name}</span>
                  <span className="text-fg-subtle">=</span>
                  <span className="text-fg">{row.value}</span>
                  {active && row.kind === 'private' && (
                    <span className="ml-auto text-[11px] text-rose-500 dark:text-rose-300">
                      → {mangled(row.name)}
                    </span>
                  )}
                </motion.li>
              );
            })}
          </ul>
        </div>

        <div className="flex sm:flex-col flex-wrap gap-1.5 sm:min-w-[160px]">
          <div className="text-[10px] uppercase tracking-widest text-fg-subtle w-full sm:mb-0.5">
            outside
          </div>
          {rows.map((row) => (
            <button
              key={row.name}
              type="button"
              onClick={() => setProbe(row)}
              className={cx(
                'inline-flex items-center gap-1.5 rounded-md border border-border-base bg-surface/50 px-2.5 py-1.5 font-mono text-[12px] transition-colors duration-fast',
                'hover:border-accent/50 hover:text-accent',
                probe?.name === row.name ? 'text-accent border-accent/50' : 'text-fg-muted',
              )}
            >
              {probe?.name === row.name &&
                (row.kind === 'public' ? (
                  <Check size={11} className="text-emerald-500" />
                ) : row.kind === 'protected' ? (
                  <TriangleAlert size={11} className="text-amber-500" />
                ) : (
                  <Lock size={11} className="text-rose-500" />
                ))}
              {instanceName}.{row.name}
            </button>
          ))}
        </div>
      </div>
    </VizShell>
  );
};
