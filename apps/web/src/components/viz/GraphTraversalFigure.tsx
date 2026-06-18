import { useEffect, useMemo, useRef, useState } from 'react';

import { Play, RotateCw } from 'lucide-react';

import { cx } from '@/components/ui/cx';

import { VizButton, VizShell } from './VizShell';

interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
}

interface GraphEdge {
  from: string;
  to: string;
}

interface GraphTraversalFigureProps {
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  start?: string;
  label?: string;
  idleHint?: string;
}

const defaultNodes: GraphNode[] = [
  { id: 'ann', label: 'Аня', x: 12, y: 50 },
  { id: 'boris', label: 'Борис', x: 38, y: 18 },
  { id: 'vera', label: 'Вера', x: 38, y: 82 },
  { id: 'grisha', label: 'Гриша', x: 66, y: 18 },
  { id: 'dasha', label: 'Даша', x: 66, y: 82 },
  { id: 'egor', label: 'Егор', x: 90, y: 50 },
];

const defaultEdges: GraphEdge[] = [
  { from: 'ann', to: 'boris' },
  { from: 'ann', to: 'vera' },
  { from: 'boris', to: 'grisha' },
  { from: 'vera', to: 'dasha' },
  { from: 'grisha', to: 'egor' },
  { from: 'dasha', to: 'egor' },
];

const W = 320;
const H = 200;
const STEP_MS = 750;

const depthTone = (depth: number): string => {
  if (depth === 0) return 'text-accent';
  if (depth === 1) return 'text-[rgb(var(--viz-cat-3))]';
  if (depth === 2) return 'text-[rgb(var(--viz-cat-5))]';
  return 'text-[rgb(var(--viz-cat-4))]';
};

export const GraphTraversalFigure = ({
  nodes = defaultNodes,
  edges = defaultEdges,
  start = 'ann',
  label = 'Обход графа в ширину',
  idleHint = 'Запустите обход: от стартового узла волна идёт по уровням - соседи, потом соседи соседей.',
}: GraphTraversalFigureProps) => {
  const [level, setLevel] = useState<number>(-1);
  const timerRef = useRef<number | null>(null);

  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  const depths = useMemo(() => {
    const adjacency = new Map<string, string[]>();
    for (const node of nodes) adjacency.set(node.id, []);
    for (const edge of edges) {
      adjacency.get(edge.from)?.push(edge.to);
      adjacency.get(edge.to)?.push(edge.from);
    }
    const result = new Map<string, number>();
    const queue: string[] = [start];
    result.set(start, 0);
    while (queue.length > 0) {
      const current = queue.shift() as string;
      const currentDepth = result.get(current) ?? 0;
      for (const neighbor of adjacency.get(current) ?? []) {
        if (!result.has(neighbor)) {
          result.set(neighbor, currentDepth + 1);
          queue.push(neighbor);
        }
      }
    }
    return result;
  }, [nodes, edges, start]);

  const maxDepth = useMemo(() => Math.max(0, ...Array.from(depths.values())), [depths]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const run = (): void => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    setLevel(0);
    const advance = (next: number): void => {
      if (next > maxDepth) return;
      setLevel(next);
      timerRef.current = window.setTimeout(() => advance(next + 1), STEP_MS);
    };
    timerRef.current = window.setTimeout(() => advance(1), STEP_MS);
  };

  const reset = (): void => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    setLevel(-1);
  };

  const px = (node: GraphNode): number => (node.x / 100) * W;
  const py = (node: GraphNode): number => (node.y / 100) * H;
  const reached = (id: string): boolean => level >= 0 && (depths.get(id) ?? Infinity) <= level;

  const atLevel = useMemo(
    () => nodes.filter((node) => (depths.get(node.id) ?? -1) === level).map((node) => node.label),
    [nodes, depths, level],
  );

  const footer =
    level < 0 ? (
      idleHint
    ) : level >= maxDepth ? (
      <span className="text-ok">
        Граф обойдён за {maxDepth} уровня. Каждый узел посещён один раз.
      </span>
    ) : (
      <span>
        уровень <span className="font-mono text-accent">{level}</span>:{' '}
        {atLevel.length > 0 ? atLevel.join(', ') : '-'}
      </span>
    );

  return (
    <VizShell
      label={label}
      actions={
        <>
          <VizButton onClick={run}>
            <Play size={12} />
            Обойти
          </VizButton>
          <VizButton onClick={reset} tone="ghost" disabled={level < 0}>
            <RotateCw size={12} />
            Сброс
          </VizButton>
        </>
      }
      footer={footer}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full max-w-[440px] mx-auto"
        role="img"
        aria-label={label}
      >
        {edges.map((edge, index) => {
          const a = byId.get(edge.from);
          const b = byId.get(edge.to);
          if (!a || !b) return null;
          const lit = reached(edge.from) && reached(edge.to);
          return (
            <line
              key={index}
              x1={px(a)}
              y1={py(a)}
              x2={px(b)}
              y2={py(b)}
              stroke="currentColor"
              strokeWidth={lit ? 2 : 1.2}
              className={cx(
                'transition-colors duration-med',
                lit ? 'text-accent' : 'text-border-base',
              )}
            />
          );
        })}

        {nodes.map((node) => {
          const depth = depths.get(node.id) ?? -1;
          const on = reached(node.id);
          return (
            <g key={node.id} transform={`translate(${px(node)} ${py(node)})`}>
              <circle
                r={18}
                fill="rgb(var(--surface-2))"
                stroke="currentColor"
                strokeWidth={on ? 2.5 : 1.2}
                className={cx(
                  'transition-colors duration-med',
                  on ? depthTone(depth) : 'text-border-base',
                )}
              />
              <text
                textAnchor="middle"
                y={3}
                fontSize={9.5}
                className="fill-[rgb(var(--fg))] font-mono"
              >
                {node.label}
              </text>
              {on && depth >= 0 && (
                <text
                  textAnchor="middle"
                  y={-24}
                  fontSize={9}
                  className={cx('font-mono', depthTone(depth))}
                  fill="currentColor"
                >
                  {depth}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </VizShell>
  );
};
