import { useEffect, useRef, useState } from 'react';

import { AnimatePresence, m as motion, useReducedMotion } from 'framer-motion';
import { Link2, Recycle, Trash2 } from 'lucide-react';

import { cx } from '@/components/ui/cx';

import { VizButton, VizShell } from './VizShell';

interface RefCountVizProps {
  objectName?: string;
  label?: string;
}

type Mode = 'linear' | 'cycle';

type CyclePhase = 'idle' | 'scanning' | 'collected';

interface CycleNode {
  id: 'A' | 'B';
  external: number;
}

const STEP_MS = 650;

const initialCycle: CycleNode[] = [
  { id: 'A', external: 0 },
  { id: 'B', external: 0 },
];

const cycleRefcount = (node: CycleNode): number => node.external + 1;

export const RefCountViz = ({ objectName = 'obj', label }: RefCountVizProps) => {
  const reduceMotion = useReducedMotion();
  const [mode, setMode] = useState<Mode>('linear');

  const [boundNames, setBoundNames] = useState<string[]>(['a']);

  const [cycle, setCycle] = useState<CycleNode[]>(initialCycle);
  const [phase, setPhase] = useState<CyclePhase>('idle');

  const timerRef = useRef<number | null>(null);

  const linearCount = boundNames.length;
  const freed = boundNames.length === 0;

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const nextName = (existing: string[]): string => {
    const pool = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    return pool.find((name) => !existing.includes(name)) ?? `n${existing.length}`;
  };

  const bind = (): void => {
    if (freed) return;
    setBoundNames((names) => [...names, nextName(names)]);
  };

  const unbind = (): void => {
    if (freed) return;
    setBoundNames((names) => (names.length === 0 ? names : names.slice(0, -1)));
  };

  const resetLinear = (): void => {
    setBoundNames(['a']);
  };

  const switchMode = (target: Mode): void => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    setMode(target);
    if (target === 'linear') {
      resetLinear();
    } else {
      setCycle(initialCycle);
      setPhase('idle');
    }
  };

  const addExternalRef = (id: 'A' | 'B'): void => {
    if (phase !== 'idle') return;
    setCycle((nodes) =>
      nodes.map((node) => (node.id === id ? { ...node, external: node.external + 1 } : node)),
    );
  };

  const dropExternalRef = (id: 'A' | 'B'): void => {
    if (phase !== 'idle') return;
    setCycle((nodes) =>
      nodes.map((node) =>
        node.id === id ? { ...node, external: Math.max(0, node.external - 1) } : node,
      ),
    );
  };

  const reachable = cycle.some((node) => node.external > 0);

  const runGc = (): void => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    if (reachable) {
      setPhase('idle');
      return;
    }
    if (reduceMotion) {
      setPhase('collected');
      return;
    }
    setPhase('scanning');
    timerRef.current = window.setTimeout(() => {
      setPhase('collected');
    }, STEP_MS);
  };

  const resetCycle = (): void => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    setCycle(initialCycle);
    setPhase('idle');
  };

  const linearFooter = freed ? (
    <span className="text-fg-subtle">
      refcount reached <span className="font-mono text-err">0</span> → object deallocated
      immediately
    </span>
  ) : (
    <span>
      live names hold <span className="font-mono text-accent">{linearCount}</span> strong reference
      {linearCount === 1 ? '' : 's'}
    </span>
  );

  const cycleFooter =
    phase === 'collected' ? (
      <span className="text-ok">cycle was unreachable → gc reclaimed A and B</span>
    ) : phase === 'scanning' ? (
      <span className="text-warn">gc walks the graph, finds no path from a live root…</span>
    ) : reachable ? (
      <span className="text-fg-subtle">
        a live name still points in → refcount &gt; needed, gc keeps the cycle
      </span>
    ) : (
      <span>
        A↔B each hold the other → refcount stuck at <span className="font-mono text-accent">1</span>
        , but nothing outside reaches them
      </span>
    );

  return (
    <VizShell
      label={label ?? 'Reference counting'}
      actions={
        <div className="inline-flex rounded-md border border-border-base bg-surface-2 p-0.5">
          <button
            type="button"
            onClick={() => switchMode('linear')}
            className={cx(
              'rounded px-2 h-6 text-[11px] font-medium transition-colors duration-fast',
              mode === 'linear' ? 'bg-accent/15 text-accent' : 'text-fg-muted hover:text-fg',
            )}
          >
            refcount
          </button>
          <button
            type="button"
            onClick={() => switchMode('cycle')}
            className={cx(
              'rounded px-2 h-6 text-[11px] font-medium transition-colors duration-fast',
              mode === 'cycle' ? 'bg-accent/15 text-accent' : 'text-fg-muted hover:text-fg',
            )}
          >
            cycle
          </button>
        </div>
      }
      footer={mode === 'linear' ? linearFooter : cycleFooter}
    >
      {mode === 'linear' ? (
        <div className="grid grid-cols-1 md:grid-cols-[max-content_1fr] gap-5 items-center">
          <div className="flex justify-center">
            <ObjectBox
              title={objectName}
              count={linearCount}
              freed={freed}
              reduceMotion={!!reduceMotion}
            />
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <VizButton onClick={bind} disabled={freed}>
                <Link2 size={12} />
                bind name
              </VizButton>
              <VizButton onClick={unbind} disabled={freed || boundNames.length === 0} tone="ghost">
                <Trash2 size={12} />
                del name
              </VizButton>
              <VizButton onClick={resetLinear} tone="ghost">
                reset
              </VizButton>
            </div>

            <div className="rounded-lg border border-border-base bg-surface-2 px-3 py-2.5">
              <div className="text-[11px] uppercase tracking-widest text-fg-subtle mb-2">
                live bindings
              </div>
              <div className="flex flex-wrap gap-1.5 min-h-[28px] items-center">
                <AnimatePresence mode="popLayout" initial={false}>
                  {boundNames.map((name) => (
                    <motion.span
                      key={name}
                      layout={!reduceMotion}
                      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                      transition={{ type: 'spring', stiffness: 460, damping: 30 }}
                      className="inline-flex items-center gap-1 rounded-md bg-surface px-2 py-1 font-mono text-[12px] text-fg border border-border-base"
                    >
                      <span className="text-accent">{name}</span>
                      <span className="text-fg-subtle">→</span>
                      <span className="text-fg-muted">{objectName}</span>
                    </motion.span>
                  ))}
                  {boundNames.length === 0 && (
                    <span className="font-mono text-[12px] text-fg-subtle">(none)</span>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {cycle.map((node) => {
              const partner = node.id === 'A' ? 'B' : 'A';
              const collected = phase === 'collected';
              return (
                <motion.div
                  key={node.id}
                  layout={!reduceMotion}
                  animate={
                    reduceMotion
                      ? {}
                      : {
                          opacity: collected ? 0 : 1,
                          scale: collected ? 0.94 : phase === 'scanning' ? 1.01 : 1,
                        }
                  }
                  transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                  className={cx(
                    'rounded-lg border px-3.5 py-3 transition-colors duration-fast',
                    collected
                      ? 'border-ok/50 bg-ok/10 opacity-0'
                      : phase === 'scanning'
                        ? 'border-warn/60 bg-warn/10'
                        : 'border-border-base bg-surface-2',
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className="font-mono text-[13px] font-semibold text-fg">{node.id}</span>
                    <RefcountBadge count={cycleRefcount(node)} reduceMotion={!!reduceMotion} />
                  </div>
                  <div className="font-mono text-[11.5px] text-fg-muted mb-2.5">
                    {node.id}.next = <span className="text-fg">{partner}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <VizButton
                      onClick={() => addExternalRef(node.id)}
                      disabled={phase !== 'idle'}
                      tone="ghost"
                    >
                      <Link2 size={11} />
                      bind
                    </VizButton>
                    <VizButton
                      onClick={() => dropExternalRef(node.id)}
                      disabled={phase !== 'idle' || node.external === 0}
                      tone="ghost"
                    >
                      <Trash2 size={11} />
                      del
                    </VizButton>
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <VizButton onClick={runGc} disabled={phase === 'scanning'}>
              <Recycle size={12} />
              run gc
            </VizButton>
            <VizButton onClick={resetCycle} tone="ghost">
              reset
            </VizButton>
            {reachable && phase === 'idle' && (
              <span className="font-mono text-[11px] text-fg-subtle">
                external ref present → not collectable
              </span>
            )}
          </div>
        </div>
      )}
    </VizShell>
  );
};

interface ObjectBoxProps {
  title: string;
  count: number;
  freed: boolean;
  reduceMotion: boolean;
}

const ObjectBox = ({ title, count, freed, reduceMotion }: ObjectBoxProps) => (
  <motion.div
    animate={reduceMotion ? {} : { opacity: freed ? 0.35 : 1, scale: freed ? 0.95 : 1 }}
    transition={{ type: 'spring', stiffness: 360, damping: 26 }}
    className={cx(
      'relative flex flex-col items-center gap-2 rounded-xl border px-5 py-4 min-w-[140px]',
      freed ? 'border-err/50 bg-err/10' : 'border-border-strong bg-surface-2',
    )}
  >
    <span className="font-mono text-[13px] font-semibold text-fg">PyObject</span>
    <span className="font-mono text-[12px] text-fg-muted">{title}</span>
    <div className="mt-1">
      <RefcountBadge count={count} reduceMotion={reduceMotion} />
    </div>
    {freed && (
      <span className="absolute -bottom-2.5 rounded-full bg-err/15 px-2 py-0.5 text-[10px] font-medium text-err">
        freed
      </span>
    )}
  </motion.div>
);

interface RefcountBadgeProps {
  count: number;
  reduceMotion: boolean;
}

const RefcountBadge = ({ count, reduceMotion }: RefcountBadgeProps) => (
  <span
    className={cx(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 h-6 text-[11px] font-medium border',
      count === 0
        ? 'border-err/50 bg-err/10 text-err'
        : 'border-accent/40 bg-accent/10 text-accent',
    )}
  >
    <span className="uppercase tracking-wide text-[10px] opacity-70">refs</span>
    <span className="relative inline-flex w-3 justify-center overflow-hidden font-mono tabular-nums">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={count}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        >
          {count}
        </motion.span>
      </AnimatePresence>
    </span>
  </span>
);
