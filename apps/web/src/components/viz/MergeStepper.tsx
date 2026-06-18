import { useEffect, useMemo, useRef, useState } from 'react';

import { AnimatePresence, LayoutGroup, m as motion, useReducedMotion } from 'framer-motion';

import { cx } from '@/components/ui/cx';

import { VizButton, VizShell } from './VizShell';

interface MergeStepperProps {
  sequences?: string[][];
  label?: string;
}

interface MergeStep {
  result: string[];
  sequences: string[][];
  candidate: string | null;
  rejected: string[];
  picked: string | null;
  caption: string;
  done: boolean;
  stuck: boolean;
}

const defaultSequences: string[][] = [
  ['B', 'A', 'object'],
  ['C', 'A', 'object'],
  ['B', 'C'],
];

const cloneSequences = (sequences: string[][]): string[][] => sequences.map((seq) => [...seq]);

const inSomeTail = (candidate: string, sequences: string[][]): boolean =>
  sequences.some((seq) => seq.slice(1).includes(candidate));

const computeSteps = (input: string[][]): MergeStep[] => {
  const steps: MergeStep[] = [];
  let working = cloneSequences(input).filter((seq) => seq.length > 0);
  const result: string[] = [];

  while (working.length > 0) {
    const heads = working.map((seq) => seq[0]).filter((head): head is string => head !== undefined);
    const rejected: string[] = [];
    let picked: string | null = null;

    for (const head of heads) {
      if (rejected.includes(head)) continue;
      if (inSomeTail(head, working)) {
        rejected.push(head);
        continue;
      }
      picked = head;
      break;
    }

    if (picked === null) {
      steps.push({
        result: [...result],
        sequences: cloneSequences(working),
        candidate: heads[0] ?? null,
        rejected,
        picked: null,
        caption: 'No head is free of every tail - the hierarchy is inconsistent and C3 fails here.',
        done: false,
        stuck: true,
      });
      break;
    }

    const candidate = picked;
    result.push(candidate);
    const nextWorking = working
      .map((seq) => (seq[0] === candidate ? seq.slice(1) : seq))
      .filter((seq) => seq.length > 0);

    steps.push({
      result: [...result],
      sequences: cloneSequences(working),
      candidate,
      rejected,
      picked: candidate,
      caption:
        rejected.length > 0
          ? `${rejected.join(', ')} ${rejected.length > 1 ? 'appear' : 'appears'} in a tail, so ${candidate} is the first valid head - append it.`
          : `${candidate} is a head and sits in no tail - append it to the result.`,
      done: false,
      stuck: false,
    });

    working = nextWorking;
  }

  if (working.length === 0) {
    steps.push({
      result: [...result],
      sequences: [],
      candidate: null,
      rejected: [],
      picked: null,
      caption: `Every sequence is empty — the linearization is [${result.join(', ')}].`,
      done: true,
      stuck: false,
    });
  }

  return steps;
};

const initialStep: MergeStep = {
  result: [],
  sequences: [],
  candidate: null,
  rejected: [],
  picked: null,
  caption: 'Press Step to run the C3 merge: pick the first head that is in no tail.',
  done: false,
  stuck: false,
};

export const MergeStepper = ({
  sequences = defaultSequences,
  label = 'C3 merge',
}: MergeStepperProps) => {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(-1);
  const timerRef = useRef<number | null>(null);

  const steps = useMemo(() => computeSteps(sequences), [sequences]);

  const clearTimer = (): void => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => clearTimer, []);
  useEffect(() => {
    clearTimer();
    setIndex(-1);
  }, [steps]);

  const current = index < 0 ? initialStep : (steps[index] ?? initialStep);
  const atEnd = index >= steps.length - 1;

  const step = (): void => {
    clearTimer();
    if (atEnd) return;
    if (reduceMotion) {
      setIndex(steps.length - 1);
      return;
    }
    setIndex((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const reset = (): void => {
    clearTimer();
    setIndex(-1);
  };

  const displaySequences = index < 0 ? sequences : current.sequences;

  const headState = (
    item: string,
    position: number,
  ): 'idle' | 'candidate' | 'rejected' | 'picked' => {
    if (position !== 0 || index < 0) return 'idle';
    if (current.picked === item) return 'picked';
    if (current.rejected.includes(item)) return 'rejected';
    if (current.candidate === item) return 'candidate';
    return 'idle';
  };

  return (
    <VizShell
      label={label}
      description={`${label}: ${initialStep.caption}`}
      liveCaption={current.caption}
      actions={
        <>
          <VizButton onClick={step} disabled={atEnd && index >= 0} tone="accent">
            Step
          </VizButton>
          <VizButton onClick={reset} disabled={index < 0} tone="ghost">
            Reset
          </VizButton>
        </>
      }
      footer={current.stuck ? <span className="text-err">{current.caption}</span> : current.caption}
    >
      <LayoutGroup>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <span className="text-[11px] uppercase tracking-widest text-fg-subtle">
              Sequences to merge
            </span>
            {displaySequences.length === 0 ? (
              <span className="font-mono text-[12px] text-fg-subtle">all empty</span>
            ) : (
              displaySequences.map((seq, seqIndex) => (
                <div key={`seq-${seqIndex}`} className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[11px] text-fg-subtle min-w-[20px]">
                    L{seqIndex + 1}
                  </span>
                  {seq.map((item, position) => {
                    const state = headState(item, position);
                    return (
                      <motion.span
                        key={`${seqIndex}-${position}-${item}`}
                        layout={!reduceMotion}
                        transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                        className={cx(
                          'rounded-md border px-2 py-1 font-mono text-[12px] transition-colors duration-fast',
                          state === 'picked'
                            ? 'border-ok/60 bg-ok/15 text-ok'
                            : state === 'rejected'
                              ? 'border-err/60 bg-err/15 text-err line-through'
                              : state === 'candidate'
                                ? 'border-accent/60 bg-accent/12 text-accent'
                                : position === 0
                                  ? 'border-border-strong bg-surface-2 text-fg'
                                  : 'border-border-base bg-surface text-fg-muted',
                        )}
                      >
                        {item}
                      </motion.span>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          <div className="flex flex-col gap-2 border-t border-border-base/60 pt-3">
            <span className="text-[11px] uppercase tracking-widest text-fg-subtle">
              Result (MRO)
            </span>
            <div className="flex flex-wrap items-center gap-1.5 min-h-[34px]">
              {current.result.length === 0 ? (
                <span className="font-mono text-[12px] text-fg-subtle">empty</span>
              ) : (
                <AnimatePresence initial={false}>
                  {current.result.map((item, position) => (
                    <motion.span
                      key={`result-${item}`}
                      layout={!reduceMotion}
                      initial={reduceMotion ? false : { opacity: 0, y: -8, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                      className={cx(
                        'rounded-md border px-2 py-1 font-mono text-[12px]',
                        position === current.result.length - 1 && current.picked
                          ? 'border-ok/60 bg-ok/15 text-ok'
                          : 'border-border-strong bg-surface-2 text-fg',
                      )}
                    >
                      {item}
                    </motion.span>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>
        </div>
      </LayoutGroup>
    </VizShell>
  );
};
