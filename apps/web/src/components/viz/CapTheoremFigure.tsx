import { useState } from 'react';

import { cx } from '@/components/ui/cx';

import { VizShell } from './VizShell';

type Combo = 'CA' | 'CP' | 'AP';

interface CapExample {
  combo: Combo;
  dbs: string[];
  note: string;
}

interface CapTheoremFigureProps {
  examples?: CapExample[];
  label?: string;
  idleHint?: string;
}

const vertexLabels: Record<'C' | 'A' | 'P', string> = {
  C: 'Согласованность',
  A: 'Доступность',
  P: 'Устойчивость к разрывам',
};

const comboKeeps: Record<Combo, Array<'C' | 'A' | 'P'>> = {
  CA: ['C', 'A'],
  CP: ['C', 'P'],
  AP: ['A', 'P'],
};

const defaultExamples: CapExample[] = [
  {
    combo: 'CA',
    dbs: ['одиночная реляционная СУБД'],
    note: 'Согласованность и доступность есть, пока узел один. Как только узлов несколько и сеть рвётся, выбирать всё равно придётся, поэтому чистый CA живёт на одном узле.',
  },
  {
    combo: 'CP',
    dbs: ['MongoDB', 'HBase', 'etcd'],
    note: 'При разрыве сети жертвуем доступностью: меньшая часть кластера перестаёт отвечать, лишь бы не отдать устаревшие данные.',
  },
  {
    combo: 'AP',
    dbs: ['Cassandra', 'DynamoDB', 'Riak'],
    note: 'При разрыве сети жертвуем строгой согласованностью: все узлы отвечают, но данные временно расходятся (eventual consistency).',
  },
];

const coords: Record<'C' | 'A' | 'P', { x: number; y: number }> = {
  C: { x: 160, y: 34 },
  A: { x: 48, y: 168 },
  P: { x: 272, y: 168 },
};

export const CapTheoremFigure = ({
  examples = defaultExamples,
  label = 'CAP-теорема',
  idleHint = 'Выберите пару гарантий. Распределённая база при разрыве сети способна держать только две из трёх.',
}: CapTheoremFigureProps) => {
  const [combo, setCombo] = useState<Combo | null>(null);

  const kept = combo ? comboKeeps[combo] : [];
  const current = examples.find((example) => example.combo === combo) ?? null;

  const edges: Array<{ combo: Combo; a: 'C' | 'A' | 'P'; b: 'C' | 'A' | 'P' }> = [
    { combo: 'CA', a: 'C', b: 'A' },
    { combo: 'CP', a: 'C', b: 'P' },
    { combo: 'AP', a: 'A', b: 'P' },
  ];

  return (
    <VizShell
      label={label}
      actions={
        <div className="flex items-center rounded-lg border border-border-base bg-surface p-0.5">
          {(Object.keys(comboKeeps) as Combo[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setCombo((prev) => (prev === option ? null : option))}
              className={cx(
                'rounded-md px-2.5 h-6 font-mono text-[11px] transition-colors duration-fast',
                combo === option ? 'bg-accent text-surface dark:text-canvas' : 'text-fg-muted hover:text-fg',
              )}
            >
              {option}
            </button>
          ))}
        </div>
      }
      footer={current ? current.note : idleHint}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[max-content_1fr] sm:items-center">
        <svg viewBox="0 0 320 200" className="w-full max-w-[320px] mx-auto" role="img" aria-label={label}>
          {edges.map((edge) => {
            const lit = combo === edge.combo;
            return (
              <line
                key={edge.combo}
                x1={coords[edge.a].x}
                y1={coords[edge.a].y}
                x2={coords[edge.b].x}
                y2={coords[edge.b].y}
                stroke="currentColor"
                strokeWidth={lit ? 3 : 1.2}
                className={cx('transition-colors duration-med', lit ? 'text-accent' : 'text-border-base')}
              />
            );
          })}

          {(['C', 'A', 'P'] as const).map((vertex) => {
            const active = combo === null || kept.includes(vertex);
            return (
              <g key={vertex} transform={`translate(${coords[vertex].x} ${coords[vertex].y})`}>
                <circle
                  r={22}
                  fill="rgb(var(--surface-2))"
                  stroke="currentColor"
                  strokeWidth={combo !== null && kept.includes(vertex) ? 2.5 : 1.2}
                  className={cx(
                    'transition-all duration-med',
                    active ? 'text-accent' : 'text-border-base opacity-40',
                  )}
                />
                <text
                  textAnchor="middle"
                  y={5}
                  fontSize={15}
                  className={cx('font-mono font-semibold', active ? 'fill-[rgb(var(--accent-1))]' : 'fill-[rgb(var(--fg-subtle))]')}
                >
                  {vertex}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="flex flex-col gap-2">
          <ul className="space-y-1.5">
            {(['C', 'A', 'P'] as const).map((vertex) => {
              const active = combo === null || kept.includes(vertex);
              return (
                <li key={vertex} className="flex items-center gap-2 text-[13px]">
                  <span
                    className={cx(
                      'inline-flex size-5 items-center justify-center rounded-md font-mono text-[11px] font-semibold',
                      active ? 'bg-accent/15 text-accent' : 'bg-surface-2 text-fg-subtle line-through',
                    )}
                  >
                    {vertex}
                  </span>
                  <span className={cx(active ? 'text-fg' : 'text-fg-subtle')}>{vertexLabels[vertex]}</span>
                </li>
              );
            })}
          </ul>
          {current && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {current.dbs.map((db) => (
                <span
                  key={db}
                  className="rounded-md border border-accent/30 bg-accent/8 px-2 py-1 font-mono text-[11.5px] text-accent"
                >
                  {db}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </VizShell>
  );
};
