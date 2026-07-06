import { useEffect, useRef, useState } from 'react';

import {
  freeRecallStatus,
  scoreFreeRecall,
  type FreeRecallItemOutcome,
  type FreeRecallScore,
} from '@dotlearn/lesson-engine';
import { Brain, Check, Eye, Timer, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ConfidenceSelector } from '@/components/ui/ConfidenceSelector';
import { Button } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { loadConceptFlashcardPoints, type FreeRecallKeyPoint } from '@/lib/free-recall';
import { recordFreeRecallResult, type ConfidenceLevel } from '@/lib/progress-db';
import { useSettings } from '@/lib/settings';
import { useContentLanguage } from '@/lib/topics';

interface FreeRecallProps {
  slug: string;
  conceptId: string;
  conceptTitle: string;
}

type Phase = 'collapsed' | 'dump' | 'review' | 'done';

const ghostButtonClass =
  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg';

const formatElapsed = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const headingKeyPoints = (): FreeRecallKeyPoint[] => {
  const root = document.querySelector('[data-toc-root]');
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>('[data-toc]'))
    .map((node) => node.textContent?.trim())
    .filter((text): text is string => Boolean(text))
    .map((cue) => ({ cue }));
};

export const FreeRecall = ({ slug, conceptId, conceptTitle }: FreeRecallProps) => {
  const { t } = useTranslation('topic');
  const contentLanguage = useContentLanguage();
  const { freeRecall: freeRecallEnabled } = useSettings();

  const [phase, setPhase] = useState<Phase>('collapsed');
  const [dumpText, setDumpText] = useState('');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [keyPoints, setKeyPoints] = useState<FreeRecallKeyPoint[] | null>(null);
  const [outcomes, setOutcomes] = useState<Array<FreeRecallItemOutcome | null>>([]);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [overallOutcome, setOverallOutcome] = useState<FreeRecallItemOutcome | null>(null);
  const [confidence, setConfidence] = useState<ConfidenceLevel | null>(null);
  const [result, setResult] = useState<{ score: FreeRecallScore; status: 'pass' | 'fail' } | null>(
    null,
  );
  const [scheduled, setScheduled] = useState<boolean | null>(null);

  const keyPointsPromiseRef = useRef<Promise<FreeRecallKeyPoint[]> | null>(null);
  const recordedRef = useRef(false);

  // A different concept mounts a fresh instance in the common case (ConceptTransition keys on
  // conceptId), but reduced-motion visitors skip that remount, so reset defensively here too.
  useEffect(() => {
    setPhase('collapsed');
    setDumpText('');
    setElapsedSec(0);
    setKeyPoints(null);
    setOutcomes([]);
    setRevealed(new Set());
    setOverallOutcome(null);
    setConfidence(null);
    setResult(null);
    setScheduled(null);
    recordedRef.current = false;
    keyPointsPromiseRef.current = null;
  }, [slug, conceptId]);

  useEffect(() => {
    if (phase !== 'dump') return undefined;
    const interval = window.setInterval(() => setElapsedSec((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [phase]);

  const loadKeyPoints = (): Promise<FreeRecallKeyPoint[]> => {
    if (!keyPointsPromiseRef.current) {
      keyPointsPromiseRef.current = (async () => {
        const fromCards = await loadConceptFlashcardPoints(slug, conceptId, contentLanguage);
        if (fromCards.length > 0) return fromCards;
        return headingKeyPoints();
      })();
    }
    return keyPointsPromiseRef.current;
  };

  const handleExpand = (): void => {
    void loadKeyPoints();
    setDumpText('');
    setElapsedSec(0);
    setPhase('dump');
  };

  const handleReveal = async (): Promise<void> => {
    const points = await loadKeyPoints();
    setKeyPoints(points);
    setOutcomes(new Array(points.length).fill(null));
    setRevealed(new Set());
    setOverallOutcome(null);
    setPhase('review');
  };

  const setOutcome = (index: number, outcome: FreeRecallItemOutcome): void => {
    setOutcomes((prev) => {
      const next = [...prev];
      next[index] = outcome;
      return next;
    });
  };

  const toggleReveal = (index: number): void => {
    setRevealed((prev) => new Set(prev).add(index));
  };

  const handleFinish = (): void => {
    const overallMode = (keyPoints?.length ?? 0) === 0;
    const finalOutcomes: FreeRecallItemOutcome[] = overallMode
      ? [overallOutcome ?? 'missed']
      : outcomes.map((outcome) => outcome ?? 'missed');
    const score = scoreFreeRecall(finalOutcomes);
    const status = freeRecallStatus(score);
    setResult({ score, status });
    setPhase('done');

    if (!recordedRef.current) {
      recordedRef.current = true;
      void recordFreeRecallResult({
        topicSlug: slug,
        conceptId,
        conceptTitle,
        status,
        recalled: score.recalled,
        total: score.total,
        ...(confidence ? { confidence } : {}),
      }).then(({ scheduled: didSchedule }) => setScheduled(didSchedule));
    }
  };

  const handleRestart = (): void => {
    setDumpText('');
    setElapsedSec(0);
    setOutcomes(new Array(keyPoints?.length ?? 0).fill(null));
    setRevealed(new Set());
    setOverallOutcome(null);
    setConfidence(null);
    setResult(null);
    setScheduled(null);
    recordedRef.current = false;
    setPhase('dump');
  };

  const handleCollapse = (): void => setPhase('collapsed');

  const overallMode = (keyPoints?.length ?? 0) === 0;
  const total = overallMode ? 1 : (keyPoints?.length ?? 0);
  const recalledCount = overallMode
    ? overallOutcome === 'recalled'
      ? 1
      : 0
    : outcomes.filter((outcome) => outcome === 'recalled').length;

  if (!freeRecallEnabled) return null;

  return (
    <aside className="not-prose my-7 rounded-xl border border-border-base bg-surface-2/40 p-4 sm:p-5">
      {phase === 'collapsed' ? (
        <button
          type="button"
          onClick={handleExpand}
          className="group flex w-full items-center gap-3 text-left"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent/10 text-accent transition-colors group-hover:bg-accent/15">
            <Brain className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-[14.5px] font-medium text-fg">
              {t('freeRecall.trigger')}
            </span>
            <span className="block text-[13px] text-fg-subtle">{t('freeRecall.subtitle')}</span>
          </span>
        </button>
      ) : (
        <>
          <div className="eyebrow flex items-center gap-1.5 text-accent">
            <Brain className="h-3.5 w-3.5" aria-hidden />
            {t('freeRecall.trigger')}
          </div>

          {phase === 'dump' && (
            <div className="mt-3 space-y-3">
              <p className="text-[13.5px] text-fg-muted">{t('freeRecall.instructions')}</p>
              <textarea
                value={dumpText}
                onChange={(event) => setDumpText(event.target.value)}
                placeholder={t('freeRecall.placeholder')}
                rows={6}
                className="w-full rounded-lg border border-border-base bg-surface px-3 py-2 text-[16px] sm:text-sm leading-relaxed text-fg placeholder:text-fg-subtle outline-none transition-colors focus:border-accent/50 focus:ring-2 focus:ring-accent/20 resize-y min-h-[140px]"
              />
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-[12.5px] tabular-nums text-fg-subtle">
                  <Timer className="h-3.5 w-3.5" aria-hidden />
                  {t('freeRecall.elapsed', { time: formatElapsed(elapsedSec) })}
                </span>
                <Button size="sm" onClick={() => void handleReveal()}>
                  {t('freeRecall.reveal')}
                </Button>
              </div>
            </div>
          )}

          {phase === 'review' && (
            <div className="mt-3 space-y-4">
              <div className="whitespace-pre-wrap rounded-lg border border-border-base bg-surface/60 px-3 py-2 text-[13.5px] leading-relaxed text-fg-subtle">
                {dumpText}
              </div>

              {overallMode ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setOverallOutcome('recalled')}
                    aria-pressed={overallOutcome === 'recalled'}
                    className={cx(
                      ghostButtonClass,
                      overallOutcome === 'recalled' && 'bg-ok/10 text-ok',
                    )}
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden />
                    {t('freeRecall.overallRecalled')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOverallOutcome('missed')}
                    aria-pressed={overallOutcome === 'missed'}
                    className={cx(
                      ghostButtonClass,
                      overallOutcome === 'missed' && 'bg-accent/10 text-accent',
                    )}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                    {t('freeRecall.overallMissed')}
                  </button>
                </div>
              ) : (
                <ul className="space-y-2">
                  {(keyPoints ?? []).map((point, index) => {
                    const outcome = outcomes[index] ?? null;
                    const isRevealed = revealed.has(index);
                    return (
                      <li
                        key={index}
                        className="rounded-lg border border-border-base bg-surface px-3 py-2.5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[14px] text-fg">{point.cue}</p>
                            {point.detail && isRevealed && (
                              <p className="mt-1 text-[13px] text-fg-muted">{point.detail}</p>
                            )}
                          </div>
                          {point.detail && !isRevealed && (
                            <button
                              type="button"
                              onClick={() => toggleReveal(index)}
                              className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-accent hover:underline"
                            >
                              <Eye className="h-3.5 w-3.5" aria-hidden />
                              {t('freeRecall.showAnswer')}
                            </button>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => setOutcome(index, 'recalled')}
                            aria-pressed={outcome === 'recalled'}
                            className={cx(
                              ghostButtonClass,
                              outcome === 'recalled' && 'bg-ok/10 text-ok',
                            )}
                          >
                            <Check className="h-3.5 w-3.5" aria-hidden />
                            {t('freeRecall.recalled')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setOutcome(index, 'missed')}
                            aria-pressed={outcome === 'missed'}
                            className={cx(
                              ghostButtonClass,
                              outcome === 'missed' && 'bg-accent/10 text-accent',
                            )}
                          >
                            <X className="h-3.5 w-3.5" aria-hidden />
                            {t('freeRecall.missed')}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-[12.5px] tabular-nums text-fg-subtle">
                  {t('freeRecall.tally', { recalled: recalledCount, total })}
                </span>
              </div>

              <div>
                <p className="mb-1.5 text-[12.5px] text-fg-subtle">
                  {t('freeRecall.confidencePrompt')}
                </p>
                <ConfidenceSelector value={confidence} onChange={setConfidence} />
              </div>

              <Button size="sm" onClick={handleFinish}>
                {t('freeRecall.finish')}
              </Button>
            </div>
          )}

          {phase === 'done' && result && (
            <div className="mt-3 space-y-3">
              <p
                className={cx(
                  'text-[14.5px] font-medium',
                  result.status === 'pass' ? 'text-ok' : 'text-err',
                )}
              >
                {result.status === 'pass'
                  ? t('freeRecall.resultPass', {
                      recalled: result.score.recalled,
                      total: result.score.total,
                    })
                  : t('freeRecall.resultFail', {
                      recalled: result.score.recalled,
                      total: result.score.total,
                    })}
              </p>
              {scheduled && (
                <p className="text-[13px] text-fg-muted">{t('freeRecall.scheduledHint')}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handleRestart}>
                  {t('freeRecall.restart')}
                </Button>
                <Button variant="ghost" size="sm" onClick={handleCollapse}>
                  {t('freeRecall.collapse')}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </aside>
  );
};
