import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

import type { TopicManifest } from '@dotlearn/contracts';
import { Link } from '@tanstack/react-router';
import { Code2, Database, FileText, FlaskConical, GitBranch, Lock, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/Badge';
import { cx } from '@/components/ui/cx';
import { DualProgressRing } from '@/components/ui/DualProgressRing';
import { blendRecallIntoMastery, computeMastery, type BlendedMastery } from '@/lib/mastery';
import type { TopicRecall } from '@/lib/retention';
import { prefetchTopic } from '@/lib/topics';

export interface MapNode {
  manifest: TopicManifest;
  total: number;
  passed: number;
  readConcepts: number;
  prerequisites: string[];
  recall?: TopicRecall;
}

type NodeStatus = 'not-started' | 'in-progress' | 'mastered' | 'needs-review';

const DIFFICULTY_TONE: Record<string, 'success' | 'warning' | 'danger'> = {
  beginner: 'success',
  intermediate: 'warning',
  advanced: 'danger',
};

const MAX_DEPTH = 64;

const runtimeIcon = (runtime: string) => {
  if (runtime === 'sql.js') return <Database size={13} />;
  if (runtime === 'pyodide') return <FlaskConical size={13} />;
  if (runtime === 'javascript') return <Code2 size={13} />;
  if (runtime === 'git') return <GitBranch size={13} />;
  return <FileText size={13} />;
};

const masteryOf = (node: MapNode): BlendedMastery =>
  blendRecallIntoMastery(
    computeMastery(node.readConcepts, node.manifest.concepts.length, node.passed, node.total),
    node.recall && node.recall.reviewedCards > 0 ? node.recall.recall : undefined,
  );

const statusOf = (mastery: BlendedMastery): NodeStatus => {
  if (mastery.needsReview) return 'needs-review';
  if (mastery.mastery >= 0.999) return 'mastered';
  if (mastery.passedExercises === 0 && mastery.readConcepts === 0 && mastery.mastery === 0) {
    return 'not-started';
  }
  return 'in-progress';
};

const computeLevels = (nodes: MapNode[]): Map<string, number> => {
  const bySlug = new Map(nodes.map((node) => [node.manifest.slug, node]));
  const levels = new Map<string, number>();

  const resolve = (slug: string, seen: Set<string>, depth: number): number => {
    const cached = levels.get(slug);
    if (cached !== undefined) return cached;
    if (depth > MAX_DEPTH || seen.has(slug)) return 0;
    const node = bySlug.get(slug);
    if (!node || node.prerequisites.length === 0) {
      levels.set(slug, 0);
      return 0;
    }
    seen.add(slug);
    let maxPrereq = -1;
    for (const prereq of node.prerequisites) {
      maxPrereq = Math.max(maxPrereq, resolve(prereq, seen, depth + 1));
    }
    seen.delete(slug);
    const level = maxPrereq + 1;
    levels.set(slug, level);
    return level;
  };

  for (const node of nodes) {
    resolve(node.manifest.slug, new Set<string>(), 0);
  }
  return levels;
};

const DIFFICULTY_RANK: Record<string, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

export const computeRecommendedNext = (nodes: MapNode[]): string | undefined => {
  if (nodes.length === 0) return undefined;
  const existingSlugs = new Set(nodes.map((node) => node.manifest.slug));
  const masteredSlugs = new Set<string>();
  for (const node of nodes) {
    if (masteryOf(node).mastery >= 0.999) masteredSlugs.add(node.manifest.slug);
  }
  const levels = computeLevels(nodes);

  const unlocked = nodes.filter((node) => {
    if (masteredSlugs.has(node.manifest.slug)) return false;
    const presentPrereqs = node.manifest.prerequisites.filter((slug) => existingSlugs.has(slug));
    return presentPrereqs.every((slug) => masteredSlugs.has(slug));
  });

  const ranked = (candidates: MapNode[]): MapNode | undefined =>
    [...candidates].sort((a, b) => {
      const levelA = levels.get(a.manifest.slug) ?? 0;
      const levelB = levels.get(b.manifest.slug) ?? 0;
      if (levelA !== levelB) return levelA - levelB;
      const diffA = DIFFICULTY_RANK[a.manifest.difficulty] ?? 1;
      const diffB = DIFFICULTY_RANK[b.manifest.difficulty] ?? 1;
      if (diffA !== diffB) return diffA - diffB;
      return a.manifest.title.localeCompare(b.manifest.title);
    })[0];

  const inProgress = unlocked.filter((node) => statusOf(masteryOf(node)) === 'in-progress');
  const fromInProgress = ranked(inProgress);
  if (fromInProgress) return fromInProgress.manifest.slug;

  const fromUnlocked = ranked(unlocked);
  if (fromUnlocked) return fromUnlocked.manifest.slug;

  const coldStart = ranked(
    nodes.filter((node) => {
      if (masteredSlugs.has(node.manifest.slug)) return false;
      const presentPrereqs = node.manifest.prerequisites.filter((slug) => existingSlugs.has(slug));
      return presentPrereqs.length === 0;
    }),
  );
  return coldStart?.manifest.slug;
};

const statusRingTone: Record<NodeStatus, string> = {
  'not-started': 'border-border-base',
  'in-progress': 'border-accent/40',
  mastered: 'border-ok/50',
  'needs-review': 'border-warn/50',
};

const statusLabelKey: Record<NodeStatus, string> = {
  'not-started': 'status.notStarted',
  'in-progress': 'status.inProgress',
  mastered: 'status.mastered',
  'needs-review': 'status.needsReview',
};

interface NodeCardProps {
  node: MapNode;
  locked: boolean;
  highlighted: boolean;
  dimmed: boolean;
  recommended?: boolean;
  onHover: (slug: string | null) => void;
}

const NodeCard = ({
  node,
  locked,
  highlighted,
  dimmed,
  recommended = false,
  onHover,
}: NodeCardProps) => {
  const { t } = useTranslation('map');
  const { manifest } = node;
  const mastery = masteryOf(node);
  const status = statusOf(mastery);
  const masteryPercent = Math.round(mastery.mastery * 100);
  const showRecall = mastery.hasRecall && (status === 'needs-review' || status === 'mastered');
  const recallPercent = Math.round(mastery.recall * 100);
  return (
    <Link
      to="/topics/$slug"
      params={{ slug: manifest.slug }}
      onMouseEnter={() => {
        prefetchTopic(manifest.slug);
        onHover(manifest.slug);
      }}
      onMouseLeave={() => onHover(null)}
      onFocus={() => {
        prefetchTopic(manifest.slug);
        onHover(manifest.slug);
      }}
      onBlur={() => onHover(null)}
      onTouchStart={() => prefetchTopic(manifest.slug)}
      aria-current={recommended ? 'step' : undefined}
      className={cx(
        'group relative z-0 block rounded-2xl border bg-surface p-3.5 shadow-card transition-[transform,box-shadow,border-color,opacity] duration-med ease-standard',
        'hover:z-20 hover:border-border-strong hover:shadow-float hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
        statusRingTone[status],
        highlighted && 'border-accent shadow-float',
        recommended && 'border-accent ring-2 ring-accent/40 shadow-float',
        dimmed && 'opacity-45',
      )}
    >
      {recommended && (
        <span className="absolute -top-2.5 left-3 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-surface dark:text-canvas shadow-card">
          <Sparkles size={9} />
          {t('recommendedNext')}
        </span>
      )}
      <div className="flex items-start gap-3">
        <DualProgressRing
          reading={mastery.readingRatio}
          solving={mastery.solvingRatio}
          size={42}
          stroke={4}
          gap={2}
          label={
            <span className="tabular-nums text-[11px]">
              {masteryPercent}
              <span className="text-[7px] text-fg-subtle">%</span>
            </span>
          }
          ariaLabel={`${masteryPercent}%`}
        />
        <div className="min-w-0 flex-1">
          <div className="eyebrow flex items-center gap-1.5 text-[10px] text-fg-subtle">
            {runtimeIcon(manifest.runtime)}
            {locked && (
              <span className="inline-flex items-center gap-0.5 text-warn" title={t('lockedHint')}>
                <Lock size={11} aria-label={t('lockedHint')} />
              </span>
            )}
          </div>
          <h3
            title={manifest.title}
            className="mt-0.5 line-clamp-1 max-h-[1.1875rem] overflow-hidden font-display text-[15px] leading-tight tracking-tightish text-fg transition-[max-height] duration-[var(--dur-med)] ease-standard group-hover:line-clamp-3 group-hover:max-h-[3.5625rem] group-focus-visible:line-clamp-3 group-focus-visible:max-h-[3.5625rem]"
          >
            {manifest.title}
          </h3>
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <Badge tone={DIFFICULTY_TONE[manifest.difficulty] ?? 'neutral'} variant="soft">
          {manifest.difficulty}
        </Badge>
        <span
          className={cx(
            'text-[10px] uppercase tracking-widest',
            status === 'needs-review' ? 'text-warn' : 'text-fg-subtle',
          )}
        >
          {t(statusLabelKey[status])}
        </span>
      </div>
      {showRecall && (
        <p
          className={cx(
            'mt-1.5 text-[11px] tabular-nums',
            status === 'needs-review' ? 'text-warn' : 'text-fg-subtle',
          )}
        >
          {t('recallHint', { percent: recallPercent })}
        </p>
      )}
    </Link>
  );
};

interface EdgeGeometry {
  id: string;
  from: string;
  to: string;
  path: string;
}

const GraphView = ({
  nodes,
  recommendedSlug,
}: {
  nodes: MapNode[];
  recommendedSlug: string | undefined;
}) => {
  const levels = useMemo(() => computeLevels(nodes), [nodes]);
  const existingSlugs = useMemo(() => new Set(nodes.map((node) => node.manifest.slug)), [nodes]);
  const masteredSlugs = useMemo(() => {
    const set = new Set<string>();
    for (const node of nodes) {
      const blended = masteryOf(node);
      if (blended.mastery >= 0.999 && !blended.needsReview) set.add(node.manifest.slug);
    }
    return set;
  }, [nodes]);

  const columns = useMemo(() => {
    const grouped = new Map<number, MapNode[]>();
    for (const node of nodes) {
      const level = levels.get(node.manifest.slug) ?? 0;
      const bucket = grouped.get(level) ?? [];
      bucket.push(node);
      grouped.set(level, bucket);
    }
    return [...grouped.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([level, items]) => ({
        level,
        items: items.sort((a, b) => a.manifest.title.localeCompare(b.manifest.title)),
      }));
  }, [nodes, levels]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef(new Map<string, HTMLDivElement>());
  const setNodeRef = useCallback((slug: string, element: HTMLDivElement | null): void => {
    if (element) nodeRefs.current.set(slug, element);
    else nodeRefs.current.delete(slug);
  }, []);

  const [edges, setEdges] = useState<EdgeGeometry[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  const measure = useCallback((): void => {
    const container = containerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const nextEdges: EdgeGeometry[] = [];
    for (const node of nodes) {
      const target = nodeRefs.current.get(node.manifest.slug);
      if (!target) continue;
      const targetRect = target.getBoundingClientRect();
      const toX = targetRect.left - containerRect.left;
      const toY = targetRect.top - containerRect.top + targetRect.height / 2;
      for (const prereq of node.prerequisites) {
        const sourceElement = nodeRefs.current.get(prereq);
        if (!sourceElement) continue;
        const sourceRect = sourceElement.getBoundingClientRect();
        const fromX = sourceRect.right - containerRect.left;
        const fromY = sourceRect.top - containerRect.top + sourceRect.height / 2;
        const midX = fromX + (toX - fromX) / 2;
        nextEdges.push({
          id: `${prereq}->${node.manifest.slug}`,
          from: prereq,
          to: node.manifest.slug,
          path: `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`,
        });
      }
    }
    setEdges(nextEdges);
    setSize({ width: container.scrollWidth, height: container.scrollHeight });
  }, [nodes]);

  useLayoutEffect(() => {
    measure();
    const handle = () => measure();
    window.addEventListener('resize', handle);
    const raf = window.requestAnimationFrame(measure);
    return () => {
      window.removeEventListener('resize', handle);
      window.cancelAnimationFrame(raf);
    };
  }, [measure, columns]);

  const connectedSlugs = useMemo(() => {
    if (!activeSlug) return null;
    const set = new Set<string>([activeSlug]);
    for (const edge of edges) {
      if (edge.from === activeSlug) set.add(edge.to);
      if (edge.to === activeSlug) set.add(edge.from);
    }
    return set;
  }, [activeSlug, edges]);

  const { t } = useTranslation('map');

  return (
    <div className="overflow-x-auto pb-2">
      <div
        ref={containerRef}
        className="relative flex min-w-[640px] items-stretch gap-10 md:gap-14 px-1 py-2"
      >
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          width={size.width}
          height={size.height}
          aria-hidden
        >
          {edges.map((edge) => {
            const active =
              activeSlug !== null && (edge.from === activeSlug || edge.to === activeSlug);
            return (
              <path
                key={edge.id}
                d={edge.path}
                fill="none"
                strokeWidth={active ? 2 : 1.5}
                className={cx(
                  'transition-[stroke,opacity] duration-fast',
                  active ? 'text-accent' : 'text-border-strong',
                  activeSlug !== null && !active ? 'opacity-20' : 'opacity-70',
                )}
                stroke="currentColor"
              />
            );
          })}
        </svg>
        {columns.map((column) => (
          <div key={column.level} className="relative flex w-52 shrink-0 flex-col gap-4">
            <div className="text-[10px] uppercase tracking-widest text-fg-subtle">
              {t('levelLabel', { level: column.level + 1 })}
            </div>
            {column.items.map((node) => {
              const presentPrereqs = node.prerequisites.filter((slug) => existingSlugs.has(slug));
              const locked = presentPrereqs.some((slug) => !masteredSlugs.has(slug));
              const highlighted = connectedSlugs?.has(node.manifest.slug) ?? false;
              const dimmed = connectedSlugs !== null && !highlighted;
              return (
                <div
                  key={node.manifest.slug}
                  ref={(el) => setNodeRef(node.manifest.slug, el)}
                  className="relative z-0 hover:z-20 focus-within:z-20"
                >
                  <NodeCard
                    node={node}
                    locked={locked}
                    highlighted={highlighted}
                    dimmed={dimmed}
                    recommended={node.manifest.slug === recommendedSlug}
                    onHover={setActiveSlug}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

const ListView = ({
  nodes,
  recommendedSlug,
}: {
  nodes: MapNode[];
  recommendedSlug: string | undefined;
}) => {
  const { t } = useTranslation('map');
  const levels = useMemo(() => computeLevels(nodes), [nodes]);
  const existingSlugs = useMemo(() => new Set(nodes.map((node) => node.manifest.slug)), [nodes]);
  const titleOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of nodes) map.set(node.manifest.slug, node.manifest.title);
    return map;
  }, [nodes]);
  const masteredSlugs = useMemo(() => {
    const set = new Set<string>();
    for (const node of nodes) {
      const blended = masteryOf(node);
      if (blended.mastery >= 0.999 && !blended.needsReview) set.add(node.manifest.slug);
    }
    return set;
  }, [nodes]);

  const sections = useMemo(() => {
    const grouped = new Map<number, MapNode[]>();
    for (const node of nodes) {
      const level = levels.get(node.manifest.slug) ?? 0;
      const bucket = grouped.get(level) ?? [];
      bucket.push(node);
      grouped.set(level, bucket);
    }
    return [...grouped.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([level, items]) => ({
        level,
        items: items.sort((a, b) => a.manifest.title.localeCompare(b.manifest.title)),
      }));
  }, [nodes, levels]);

  return (
    <div className="space-y-8">
      {sections.map((section) => (
        <section key={section.level} className="space-y-3">
          <div className="text-[10px] uppercase tracking-widest text-fg-subtle">
            {t('levelLabel', { level: section.level + 1 })}
          </div>
          <ul className="space-y-3">
            {section.items.map((node) => {
              const presentPrereqs = node.prerequisites.filter((slug) => existingSlugs.has(slug));
              const locked = presentPrereqs.some((slug) => !masteredSlugs.has(slug));
              return (
                <li key={node.manifest.slug} className="space-y-1.5">
                  <NodeCard
                    node={node}
                    locked={locked}
                    highlighted={false}
                    dimmed={false}
                    recommended={node.manifest.slug === recommendedSlug}
                    onHover={() => undefined}
                  />
                  {presentPrereqs.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pl-1">
                      <span className="text-[11px] text-fg-subtle">{t('requiresLabel')}</span>
                      {presentPrereqs.map((slug) => (
                        <span
                          key={slug}
                          className={cx(
                            'rounded-full border px-2 py-0.5 text-[11px] tracking-snug',
                            masteredSlugs.has(slug)
                              ? 'border-ok/40 text-ok'
                              : 'border-border-base text-fg-muted',
                          )}
                        >
                          {titleOf.get(slug) ?? slug}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
};

export const LearningMap = ({ nodes }: { nodes: MapNode[] }) => {
  const recommendedSlug = useMemo(() => computeRecommendedNext(nodes), [nodes]);
  return (
    <>
      <div className="hidden md:block">
        <GraphView nodes={nodes} recommendedSlug={recommendedSlug} />
      </div>
      <div className="md:hidden">
        <ListView nodes={nodes} recommendedSlug={recommendedSlug} />
      </div>
    </>
  );
};
