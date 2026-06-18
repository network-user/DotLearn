import { useRef, useState } from 'react';

import { motion, useReducedMotion } from 'framer-motion';
import { Minus, Plus, RotateCcw } from 'lucide-react';

import { VizButton, VizShell } from '@/components/viz/VizShell';

import { fnv1a, type VizLang } from './hash-utils';

export interface ConsistentHashRingProps {
  keys?: string[];
  label?: string;
  lang?: VizLang;
}

interface RingNode {
  id: string;
  angle: number;
}

const POOL: RingNode[] = [
  { id: 'A', angle: 18 },
  { id: 'B', angle: 132 },
  { id: 'C', angle: 250 },
  { id: 'D', angle: 78 },
  { id: 'E', angle: 312 },
];

const COLOR_BY_ID: Record<string, string> = {
  A: '--accent-1',
  B: '--accent-3',
  C: '--accent-2',
  D: '--ok',
  E: '--warn',
};

const STRINGS = {
  ru: {
    label: 'Консистентное хеширование',
    node: 'узел',
    reset: 'сброс',
    nodeWord: 'узел',
    added: (id: string) => `добавлен узел ${id}`,
    removed: (id: string) => `удалён узел ${id}`,
    moved: (op: string, count: number, total: number) => (
      <span>
        {op}: переехало <strong className="text-accent">{count}</strong> из {total} ключей. При
        обычном <code>hash % N</code> сменилось бы почти всё - здесь же двигается только дуга рядом
        с изменением.
      </span>
    ),
    idle: 'Узлы и ключи лежат на одном кольце. Ключ принадлежит первому узлу по часовой стрелке. Добавьте или уберите узел и посмотрите, какая часть ключей переедет.',
    ariaLabel: 'Хеш-кольцо с узлами и ключами',
    defaultKeys: [
      'Анна',
      'Борис',
      'Вера',
      'Глеб',
      'Дина',
      'Егор',
      'Жанна',
      'Зоя',
      'Иван',
      'Кира',
      'Лев',
      'Мира',
    ],
  },
  en: {
    label: 'Consistent hashing',
    node: 'node',
    reset: 'reset',
    nodeWord: 'node',
    added: (id: string) => `node ${id} added`,
    removed: (id: string) => `node ${id} removed`,
    moved: (op: string, count: number, total: number) => (
      <span>
        {op}: <strong className="text-accent">{count}</strong> of {total} keys moved. With plain{' '}
        <code>hash % N</code> almost everything would change - here only the arc next to the change
        moves.
      </span>
    ),
    idle: 'Nodes and keys live on one ring. A key belongs to the first node clockwise. Add or remove a node and watch what fraction of keys moves.',
    ariaLabel: 'Hash ring with nodes and keys',
    defaultKeys: [
      'Anna',
      'Boris',
      'Vera',
      'Gleb',
      'Dina',
      'Egor',
      'Zhanna',
      'Zoya',
      'Ivan',
      'Kira',
      'Lev',
      'Mira',
    ],
  },
} as const;

const CENTER = 150;
const RADIUS = 104;

const fill = (id: string | undefined): string =>
  id ? `rgb(var(${COLOR_BY_ID[id]}))` : 'rgb(var(--fg-subtle))';

const point = (angle: number): [number, number] => {
  const rad = (angle * Math.PI) / 180;
  return [CENTER + RADIUS * Math.sin(rad), CENTER - RADIUS * Math.cos(rad)];
};

const arcPath = (start: number, end: number): string => {
  const [x1, y1] = point(start);
  const [x2, y2] = point(end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${RADIUS} ${RADIUS} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
};

const ownersFor = (
  nodes: RingNode[],
  keys: { label: string; angle: number }[],
): Record<string, string> => {
  const sorted = [...nodes].sort((a, b) => a.angle - b.angle);
  const result: Record<string, string> = {};
  for (const key of keys) {
    const owner = sorted.find((node) => node.angle >= key.angle) ?? sorted[0];
    if (owner) result[key.label] = owner.id;
  }
  return result;
};

export const ConsistentHashRing = ({ keys, label, lang = 'ru' }: ConsistentHashRingProps) => {
  const t = STRINGS[lang];
  const reduceMotion = useReducedMotion();
  const ringKeys = useRef(
    (keys ?? t.defaultKeys).map((labelText) => ({
      label: labelText,
      angle: fnv1a(labelText) % 360,
    })),
  ).current;

  const [activeIds, setActiveIds] = useState<string[]>(['A', 'B', 'C']);
  const [moved, setMoved] = useState<{ op: string; count: number } | null>(null);
  const [movedSet, setMovedSet] = useState<Set<string>>(new Set());

  const active = POOL.filter((node) => activeIds.includes(node.id));
  const sorted = [...active].sort((a, b) => a.angle - b.angle);
  const owners = ownersFor(active, ringKeys);

  const applyChange = (nextIds: string[], op: string): void => {
    const before = owners;
    const after = ownersFor(
      POOL.filter((node) => nextIds.includes(node.id)),
      ringKeys,
    );
    const changed = new Set(
      ringKeys.filter((key) => before[key.label] !== after[key.label]).map((key) => key.label),
    );
    setActiveIds(nextIds);
    setMoved({ op, count: changed.size });
    setMovedSet(changed);
  };

  const addNode = (): void => {
    const next = POOL.find((node) => !activeIds.includes(node.id));
    if (!next) return;
    applyChange([...activeIds, next.id], t.added(next.id));
  };

  const removeNode = (): void => {
    if (activeIds.length <= 1) return;
    const victim = activeIds[activeIds.length - 1];
    if (victim === undefined) return;
    applyChange(activeIds.slice(0, -1), t.removed(victim));
  };

  const reset = (): void => {
    setActiveIds(['A', 'B', 'C']);
    setMoved(null);
    setMovedSet(new Set());
  };

  return (
    <VizShell
      label={label ?? t.label}
      actions={
        <>
          <VizButton onClick={addNode} disabled={activeIds.length >= POOL.length}>
            <Plus size={12} />
            {t.node}
          </VizButton>
          <VizButton onClick={removeNode} tone="ghost" disabled={activeIds.length <= 1}>
            <Minus size={12} />
            {t.node}
          </VizButton>
          <VizButton onClick={reset} tone="ghost">
            <RotateCcw size={11} />
            {t.reset}
          </VizButton>
        </>
      }
      footer={moved ? t.moved(moved.op, moved.count, ringKeys.length) : <span>{t.idle}</span>}
    >
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start sm:justify-center">
        <svg
          viewBox="0 0 300 300"
          className="w-full max-w-[300px]"
          role="img"
          aria-label={t.ariaLabel}
        >
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke="rgb(var(--border))"
            strokeWidth={1}
          />

          {sorted.map((node, i) => {
            const prevNode = sorted[(i - 1 + sorted.length) % sorted.length];
            const prevAngle = prevNode?.angle ?? node.angle;
            const prev = i === 0 ? prevAngle - 360 : prevAngle;
            return (
              <path
                key={`arc-${node.id}`}
                d={arcPath(prev, node.angle)}
                fill="none"
                stroke={fill(node.id)}
                strokeWidth={5}
                strokeLinecap="round"
                opacity={0.45}
              />
            );
          })}

          {ringKeys.map((key) => {
            const [x, y] = point(key.angle);
            const isMoved = movedSet.has(key.label);
            return (
              <motion.circle
                key={`key-${key.label}`}
                cx={x}
                cy={y}
                fill={fill(owners[key.label])}
                stroke="rgb(var(--surface))"
                strokeWidth={1.5}
                animate={reduceMotion ? { r: 4 } : { r: isMoved ? [4, 7.5, 4] : 4 }}
                transition={{ duration: 0.6 }}
              />
            );
          })}

          {active.map((node) => {
            const [x, y] = point(node.angle);
            const lx = CENTER + (RADIUS + 20) * Math.sin((node.angle * Math.PI) / 180);
            const ly = CENTER - (RADIUS + 20) * Math.cos((node.angle * Math.PI) / 180);
            return (
              <g key={`node-${node.id}`}>
                <circle
                  cx={x}
                  cy={y}
                  r={11}
                  fill={fill(node.id)}
                  stroke="rgb(var(--surface))"
                  strokeWidth={2}
                />
                <text
                  x={x}
                  y={y + 3.5}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={700}
                  fill="rgb(var(--surface))"
                >
                  {node.id}
                </text>
                <text
                  x={lx}
                  y={ly + 3}
                  textAnchor="middle"
                  fontSize={9}
                  fill="rgb(var(--fg-subtle))"
                >
                  {t.nodeWord} {node.id}
                </text>
              </g>
            );
          })}
        </svg>

        <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5 self-center text-[11.5px] sm:max-w-[150px]">
          {active.map((node) => (
            <li key={node.id} className="flex items-center gap-1.5 font-mono text-fg-muted">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: fill(node.id) }}
              />
              {t.nodeWord} {node.id}
            </li>
          ))}
        </ul>
      </div>
    </VizShell>
  );
};
