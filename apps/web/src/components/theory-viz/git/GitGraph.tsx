import { useMemo } from 'react';

import type { RepoSnapshot } from '@dotlearn/lesson-engine';
import { m as motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { cx } from '@/components/ui/cx';

export interface GitGraphProps {
  snapshot: RepoSnapshot;
  className?: string;
  emptyLabel?: string;
}

interface GraphNode {
  id: string;
  message: string;
  parents: string[];
  row: number;
  lane: number;
}

interface RefLabel {
  text: string;
  kind: 'branch' | 'tag' | 'head';
}

const ROW_HEIGHT = 56;
const LANE_WIDTH = 30;
const NODE_RADIUS = 7;
const MARGIN_TOP = 26;
const MARGIN_LEFT = 26;
const LABEL_GAP = 18;

const DEFAULT_LANE_COLOR = 'var(--accent)';

const laneColors = [DEFAULT_LANE_COLOR, '#22c55e', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6'];

const laneColorFor = (lane: number): string =>
  laneColors[lane % laneColors.length] ?? DEFAULT_LANE_COLOR;

const assignLanes = (commits: RepoSnapshot['commits']): GraphNode[] => {
  const childLane = new Map<string, number>();
  let nextFreeLane = 0;
  const nodes: GraphNode[] = [];

  commits.forEach((commit, row) => {
    let lane = childLane.get(commit.id);
    if (lane === undefined) {
      lane = nextFreeLane;
      nextFreeLane += 1;
    }
    const [firstParent] = commit.parents;
    if (firstParent !== undefined && !childLane.has(firstParent)) {
      childLane.set(firstParent, lane);
    }
    nodes.push({
      id: commit.id,
      message: commit.message,
      parents: commit.parents,
      row,
      lane,
    });
  });

  return nodes;
};

const buildRefLabels = (snapshot: RepoSnapshot): Map<string, RefLabel[]> => {
  const byCommit = new Map<string, RefLabel[]>();
  const push = (commit: string, label: RefLabel): void => {
    const existing = byCommit.get(commit);
    if (existing) {
      existing.push(label);
    } else {
      byCommit.set(commit, [label]);
    }
  };

  for (const branch of snapshot.branches) {
    push(branch.commit, { text: branch.name, kind: 'branch' });
  }
  for (const tag of snapshot.tags) {
    push(tag.commit, { text: tag.name, kind: 'tag' });
  }
  if (snapshot.head.detached && snapshot.head.commit !== undefined) {
    push(snapshot.head.commit, { text: 'HEAD', kind: 'head' });
  }
  return byCommit;
};

const headCommitId = (snapshot: RepoSnapshot): string | undefined => {
  if (snapshot.head.commit !== undefined) {
    return snapshot.head.commit;
  }
  if (snapshot.head.branch !== undefined) {
    const branch = snapshot.branches.find((entry) => entry.name === snapshot.head.branch);
    return branch?.commit;
  }
  return undefined;
};

const shortId = (id: string): string => id.slice(0, 7);

export const GitGraph = ({ snapshot, className, emptyLabel }: GitGraphProps) => {
  const { t } = useTranslation('runners');
  const prefersReducedMotion = useReducedMotion();

  const nodes = useMemo(() => assignLanes(snapshot.commits), [snapshot.commits]);
  const refLabels = useMemo(() => buildRefLabels(snapshot), [snapshot]);
  const activeHead = headCommitId(snapshot);
  const headBranch = snapshot.head.detached ? undefined : snapshot.head.branch;

  const laneCount = nodes.reduce((max, node) => Math.max(max, node.lane + 1), 1);
  const positionOf = (node: GraphNode): { x: number; y: number } => ({
    x: MARGIN_LEFT + node.lane * LANE_WIDTH,
    y: MARGIN_TOP + node.row * ROW_HEIGHT,
  });
  const nodeById = new Map(nodes.map((node) => [node.id, node] as const));

  const width = MARGIN_LEFT + laneCount * LANE_WIDTH;
  const height = MARGIN_TOP + Math.max(nodes.length, 1) * ROW_HEIGHT;

  if (nodes.length === 0) {
    return (
      <div
        className={cx(
          'grid place-items-center rounded-lg border border-dashed border-border-base bg-surface-2/40 px-4 py-10 text-center',
          className,
        )}
      >
        <p className="text-[12.5px] text-fg-subtle">
          {emptyLabel ?? t('git.graph.empty', { defaultValue: 'Коммитов пока нет' })}
        </p>
      </div>
    );
  }

  return (
    <div className={cx('overflow-auto rounded-lg border border-border-base bg-surface', className)}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={t('git.graph.aria', { defaultValue: 'Граф коммитов' })}
        className="block min-w-full"
      >
        {nodes.map((node) =>
          node.parents.map((parentId) => {
            const parent = nodeById.get(parentId);
            if (!parent) {
              return null;
            }
            const from = positionOf(node);
            const to = positionOf(parent);
            const color = laneColorFor(Math.max(node.lane, parent.lane));
            const midY = (from.y + to.y) / 2;
            const path =
              from.x === to.x
                ? `M ${from.x} ${from.y} L ${to.x} ${to.y}`
                : `M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`;
            return (
              <motion.path
                key={`${node.id}-${parentId}`}
                d={path}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeOpacity={0.55}
                initial={prefersReducedMotion ? false : { pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.55 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            );
          }),
        )}

        {nodes.map((node) => {
          const { x, y } = positionOf(node);
          const color = laneColorFor(node.lane);
          const isHead = node.id === activeHead;
          const labels = refLabels.get(node.id) ?? [];
          const labelStartX = MARGIN_LEFT + laneCount * LANE_WIDTH - LANE_WIDTH + LABEL_GAP;
          return (
            <g key={node.id}>
              {isHead && (
                <motion.circle
                  cx={x}
                  cy={y}
                  r={NODE_RADIUS + 5}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  strokeOpacity={0.35}
                  initial={prefersReducedMotion ? false : { scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 0.35 }}
                  transition={{ duration: 0.3 }}
                />
              )}
              <motion.circle
                cx={x}
                cy={y}
                r={NODE_RADIUS}
                fill={isHead ? color : 'var(--surface)'}
                stroke={color}
                strokeWidth={2.5}
                initial={prefersReducedMotion ? false : { scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.25, ease: 'backOut' }}
              />
              <text
                x={x + NODE_RADIUS + 8}
                y={y - 7}
                className="fill-fg-subtle font-mono"
                fontSize={10}
              >
                {shortId(node.id)}
              </text>
              <text x={x + NODE_RADIUS + 8} y={y + 9} className="fill-fg" fontSize={11}>
                {node.message.length > 34 ? `${node.message.slice(0, 33)}…` : node.message}
              </text>
              <g>
                {labels.map((label, index) => {
                  const isCurrentBranch = label.kind === 'branch' && label.text === headBranch;
                  return (
                    <foreignObject
                      key={`${label.kind}-${label.text}`}
                      x={Math.max(labelStartX, x + NODE_RADIUS + 8)}
                      y={y + 16 + index * 20}
                      width={Math.max(120, label.text.length * 8 + 28)}
                      height={20}
                    >
                      <span
                        className={cx(
                          'inline-flex items-center gap-1 rounded-full px-2 py-[1px] text-[10px] font-semibold',
                          label.kind === 'tag'
                            ? 'bg-warn/15 text-warn'
                            : label.kind === 'head'
                              ? 'bg-accent/20 text-accent'
                              : isCurrentBranch
                                ? 'bg-accent/15 text-accent'
                                : 'bg-surface-2 text-fg-muted',
                        )}
                      >
                        {label.kind === 'tag' ? '⌖ ' : ''}
                        {label.text}
                        {isCurrentBranch ? ' ← HEAD' : ''}
                      </span>
                    </foreignObject>
                  );
                })}
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
