import { useMemo, useState } from 'react';

import { motion, useReducedMotion } from 'framer-motion';
import { ChevronRight, CornerDownRight, RotateCw } from 'lucide-react';

import { cx } from '@/components/ui/cx';

import { VizButton, VizShell } from './VizShell';

export interface HierNode {
  id: string;
  label: string;
  sub?: string;
  children?: HierNode[];
}

interface HierarchyTreeFigureProps {
  root?: HierNode;
  label?: string;
  idleHint?: string;
}

const defaultRoot: HierNode = {
  id: 'company',
  label: 'Компания',
  sub: 'запись-владелец',
  children: [
    {
      id: 'sales',
      label: 'Отдел продаж',
      children: [
        { id: 'anna', label: 'Анна', sub: 'менеджер' },
        { id: 'pavel', label: 'Павел', sub: 'менеджер' },
      ],
    },
    {
      id: 'eng',
      label: 'Инженерия',
      children: [
        { id: 'vera', label: 'Вера', sub: 'разработчик' },
        { id: 'oleg', label: 'Олег', sub: 'разработчик' },
      ],
    },
  ],
};

const buildParents = (
  node: HierNode,
  parent: string | null,
  acc: Map<string, string | null>,
): void => {
  acc.set(node.id, parent);
  for (const child of node.children ?? []) buildParents(child, node.id, acc);
};

export const HierarchyTreeFigure = ({
  root = defaultRoot,
  label = 'Иерархическая модель',
  idleHint = 'Выберите запись: путь к ней идёт от корня вниз. У каждой записи ровно один родитель.',
}: HierarchyTreeFigureProps) => {
  const reduceMotion = useReducedMotion();
  const [selected, setSelected] = useState<string | null>(null);

  const parents = useMemo(() => {
    const map = new Map<string, string | null>();
    buildParents(root, null, map);
    return map;
  }, [root]);

  const labels = useMemo(() => {
    const map = new Map<string, string>();
    const walk = (node: HierNode): void => {
      map.set(node.id, node.label);
      for (const child of node.children ?? []) walk(child);
    };
    walk(root);
    return map;
  }, [root]);

  const path = useMemo(() => {
    if (selected === null) return [];
    const chain: string[] = [];
    let cursor: string | null = selected;
    while (cursor !== null) {
      chain.unshift(cursor);
      cursor = parents.get(cursor) ?? null;
    }
    return chain;
  }, [selected, parents]);

  const onPath = (id: string): boolean => path.includes(id);

  const renderNode = (node: HierNode, depth: number): JSX.Element => {
    const isSelected = selected === node.id;
    const highlighted = onPath(node.id);
    return (
      <div key={node.id} className={cx(depth > 0 && 'ml-4 pl-4 border-l border-border-base/70')}>
        <motion.button
          type="button"
          onClick={() => setSelected(node.id)}
          animate={isSelected && !reduceMotion ? { scale: [1, 1.04, 1] } : { scale: 1 }}
          transition={{ duration: 0.3 }}
          className={cx(
            'my-1 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors duration-fast',
            'min-h-[var(--tap)] sm:min-h-0',
            isSelected
              ? 'border-accent bg-accent/12'
              : highlighted
                ? 'border-accent/50 bg-accent/6'
                : 'border-border-base bg-surface hover:border-accent/40',
          )}
        >
          {depth > 0 && <CornerDownRight size={13} className="shrink-0 text-fg-subtle" />}
          <span className="font-mono text-[13px] font-semibold text-fg">{node.label}</span>
          {node.sub && <span className="text-[11px] text-fg-subtle">{node.sub}</span>}
        </motion.button>
        {(node.children ?? []).map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  const footer =
    path.length === 0 ? (
      idleHint
    ) : (
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="text-fg-subtle">путь от корня:</span>
        {path.map((id, index) => (
          <span key={id} className="inline-flex items-center gap-1.5">
            {index > 0 && <ChevronRight size={12} className="text-fg-subtle" />}
            <span
              className={cx(
                'font-mono text-[12px]',
                index === path.length - 1 ? 'text-accent' : 'text-fg-muted',
              )}
            >
              {labels.get(id)}
            </span>
          </span>
        ))}
      </span>
    );

  return (
    <VizShell
      label={label}
      actions={
        <VizButton onClick={() => setSelected(null)} tone="ghost" disabled={selected === null}>
          <RotateCw size={12} />
          Сброс
        </VizButton>
      }
      footer={footer}
    >
      {renderNode(root, 0)}
    </VizShell>
  );
};
