import { useMemo, useState } from 'react';

import { cx } from '@/components/ui/cx';

import { VizShell } from './VizShell';

interface NetNode {
  id: string;
  label: string;
  x: number;
  y: number;
  kind?: 'owner' | 'member';
}

interface NetEdge {
  from: string;
  to: string;
}

interface NetworkModelFigureProps {
  nodes?: NetNode[];
  edges?: NetEdge[];
  label?: string;
  idleHint?: string;
}

const defaultNodes: NetNode[] = [
  { id: 'group', label: 'Группа А', x: 20, y: 22, kind: 'owner' },
  { id: 'course', label: 'Курс SQL', x: 80, y: 22, kind: 'owner' },
  { id: 'ivan', label: 'Иван', x: 32, y: 82, kind: 'member' },
  { id: 'maria', label: 'Мария', x: 68, y: 82, kind: 'member' },
];

const defaultEdges: NetEdge[] = [
  { from: 'group', to: 'ivan' },
  { from: 'group', to: 'maria' },
  { from: 'course', to: 'ivan' },
  { from: 'course', to: 'maria' },
];

const W = 320;
const H = 200;

export const NetworkModelFigure = ({
  nodes = defaultNodes,
  edges = defaultEdges,
  label = 'Сетевая модель (CODASYL)',
  idleHint = 'Наведите на запись: подсветятся все наборы, в которые она входит. Член может принадлежать нескольким владельцам.',
}: NetworkModelFigureProps) => {
  const [active, setActive] = useState<string | null>(null);

  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const px = (node: NetNode): number => (node.x / 100) * W;
  const py = (node: NetNode): number => (node.y / 100) * H;

  const ownerCount = useMemo(() => {
    if (active === null) return 0;
    return edges.filter((edge) => edge.to === active).length;
  }, [active, edges]);

  const touches = (edge: NetEdge): boolean =>
    active !== null && (edge.from === active || edge.to === active);

  const footer =
    active === null ? (
      idleHint
    ) : ownerCount >= 2 ? (
      <span>
        <span className="font-mono text-accent">{byId.get(active)?.label}</span> входит в{' '}
        <span className="text-accent">{ownerCount}</span> набора-владельца сразу, в дереве так нельзя.
      </span>
    ) : (
      <span>
        <span className="font-mono text-accent">{byId.get(active)?.label}</span>: связи этой записи
        подсвечены.
      </span>
    );

  return (
    <VizShell label={label} footer={footer}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full max-w-[420px] mx-auto"
        role="img"
        aria-label={label}
      >
        <defs>
          <marker
            id="net-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L10 5 L0 10 z" fill="currentColor" />
          </marker>
        </defs>

        {edges.map((edge, index) => {
          const a = byId.get(edge.from);
          const b = byId.get(edge.to);
          if (!a || !b) return null;
          return (
            <line
              key={index}
              x1={px(a)}
              y1={py(a) + 12}
              x2={px(b)}
              y2={py(b) - 12}
              markerEnd="url(#net-arrow)"
              className={cx(
                'transition-colors duration-med',
                touches(edge) ? 'text-accent' : active === null ? 'text-fg-subtle' : 'text-border-base',
              )}
              stroke="currentColor"
              strokeWidth={touches(edge) ? 2 : 1.2}
            />
          );
        })}

        {nodes.map((node) => {
          const isActive = active === node.id;
          const isOwner = node.kind === 'owner';
          return (
            <g
              key={node.id}
              transform={`translate(${px(node)} ${py(node)})`}
              onMouseEnter={() => setActive(node.id)}
              onMouseLeave={() => setActive(null)}
              onClick={() => setActive((prev) => (prev === node.id ? null : node.id))}
              className="cursor-pointer"
            >
              <rect
                x={-44}
                y={-13}
                width={88}
                height={26}
                rx={isOwner ? 5 : 13}
                className={cx(
                  'transition-colors duration-fast',
                  isActive ? 'text-accent' : isOwner ? 'text-fg-muted' : 'text-fg-subtle',
                )}
                fill="rgb(var(--surface-2))"
                stroke="currentColor"
                strokeWidth={isActive ? 2 : 1.2}
              />
              <text
                x={0}
                y={4}
                textAnchor="middle"
                className="fill-[rgb(var(--fg))] font-mono"
                fontSize={11}
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </VizShell>
  );
};
