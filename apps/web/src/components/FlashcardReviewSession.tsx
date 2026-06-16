import { useCallback, useEffect, useState } from 'react';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { Skeleton } from '@/components/ui/Skeleton';
import { Surface } from '@/components/ui/Surface';
import type { SessionCard } from '@/lib/flashcard-sources';
import { reviewFlashcard, type FlashcardRating } from '@/lib/flashcards';
import { db } from '@/lib/progress-db';

type Phase = 'loading' | 'empty' | 'caught-up' | 'review' | 'done';

const RATINGS: { key: FlashcardRating; tone: string; hotkey: string }[] = [
  { key: 'again', tone: 'border-err/45 text-err hover:bg-err/10', hotkey: '1' },
  { key: 'hard', tone: 'border-warn/45 text-warn hover:bg-warn/10', hotkey: '2' },
  { key: 'good', tone: 'border-accent/45 text-accent hover:bg-accent/10', hotkey: '3' },
  { key: 'easy', tone: 'border-ok/45 text-ok hover:bg-ok/10', hotkey: '4' },
];

interface FlashcardReviewSessionProps {
  cards: SessionCard[];
  title?: string;
  subtitle?: string;
  loading?: boolean;
  emptyMessage?: string;
  onExit?: () => void;
  exitLabel?: string;
}

export const FlashcardReviewSession = ({
  cards,
  title,
  subtitle,
  loading = false,
  emptyMessage,
  onExit,
  exitLabel,
}: FlashcardReviewSessionProps) => {
  const { t } = useTranslation('flashcards');
  const [queue, setQueue] = useState<number[]>([]);
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [phase, setPhase] = useState<Phase>('loading');

  const buildQueue = useCallback(async (entries: SessionCard[]): Promise<number[]> => {
    const records = await db.flashcardReviews.toArray();
    const byKey = new Map(records.map((record) => [`${record.topicSlug}:${record.cardId}`, record]));
    const now = Date.now();
    return entries
      .map((_, index) => index)
      .filter((index) => {
        const entry = entries[index]!;
        const record = byKey.get(`${entry.deckSlug}:${entry.card.id}`);
        return !record || new Date(record.due).getTime() <= now;
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (loading) {
      setPhase('loading');
      return;
    }
    setPhase('loading');
    setPos(0);
    setFlipped(false);
    setReviewed(0);
    if (cards.length === 0) {
      setPhase('empty');
      return;
    }
    void buildQueue(cards).then((due) => {
      if (cancelled) return;
      setQueue(due);
      setPhase(due.length === 0 ? 'caught-up' : 'review');
    });
    return () => {
      cancelled = true;
    };
  }, [cards, loading, buildQueue]);

  const current = phase === 'review' ? cards[queue[pos]!] : undefined;

  const advance = useCallback(() => {
    setFlipped(false);
    setPos((prev) => {
      const next = prev + 1;
      if (next >= queue.length) {
        setPhase('done');
        return prev;
      }
      return next;
    });
  }, [queue.length]);

  const rate = useCallback(
    (rating: FlashcardRating) => {
      if (!current) return;
      void reviewFlashcard(current.deckSlug, current.card.id, rating);
      setReviewed((value) => value + 1);
      advance();
    },
    [current, advance],
  );

  const reviewAll = useCallback(() => {
    setQueue(cards.map((_, index) => index));
    setPos(0);
    setFlipped(false);
    setReviewed(0);
    setPhase('review');
  }, [cards]);

  useEffect(() => {
    if (phase !== 'review') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();
        setFlipped((value) => !value);
        return;
      }
      if (!flipped) return;
      const rating = RATINGS.find((entry) => entry.hotkey === event.key);
      if (rating) {
        event.preventDefault();
        rate(rating.key);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, flipped, rate]);

  const reduceMotion = useReducedMotion() ?? false;
  const total = queue.length;
  const percent = total === 0 ? 0 : Math.round((pos / total) * 100);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {(title || subtitle || onExit) && (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h1 className="truncate font-display text-xl tracking-tightish text-fg">{title}</h1>
            )}
            {subtitle && <p className="mt-1 text-sm text-fg-muted">{subtitle}</p>}
          </div>
          {onExit && (
            <Button variant="ghost" size="sm" onClick={onExit}>
              {exitLabel ?? t('backToHub')}
            </Button>
          )}
        </div>
      )}

      {phase === 'loading' && <Skeleton rounded="2xl" className="h-72" />}

      {phase === 'empty' && (
        <Surface variant="inset">
          <div className="space-y-4 p-8 text-center">
            <p className="text-sm text-fg-muted">{emptyMessage ?? t('practice.noCards')}</p>
            {onExit && (
              <Button variant="outline" size="sm" onClick={onExit}>
                {exitLabel ?? t('backToHub')}
              </Button>
            )}
          </div>
        </Surface>
      )}

      {phase === 'caught-up' && (
        <Surface variant="inset" rule="top">
          <div className="space-y-4 p-8 text-center">
            <h2 className="font-display text-2xl text-fg">{t('caughtUpTitle')}</h2>
            <p className="text-sm text-fg-muted">{t('caughtUpBody', { count: cards.length })}</p>
            <Button variant="primary" size="md" onClick={reviewAll}>
              {t('reviewAll')}
            </Button>
          </div>
        </Surface>
      )}

      {phase === 'done' && (
        <Surface variant="inset" rule="top">
          <div className="space-y-4 p-8 text-center">
            <h2 className="font-display text-2xl text-fg">{t('doneTitle')}</h2>
            <p className="text-sm text-fg-muted">{t('doneBody', { count: reviewed })}</p>
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="md"
                leadingIcon={<RotateCcw size={15} />}
                onClick={reviewAll}
              >
                {t('reviewAll')}
              </Button>
              {onExit && (
                <Button variant="ghost" size="md" onClick={onExit}>
                  {exitLabel ?? t('backToHub')}
                </Button>
              )}
            </div>
          </div>
        </Surface>
      )}

      {phase === 'review' && current && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-med ease-standard"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="shrink-0 text-[12px] tabular-nums text-fg-subtle">
              {t('progress', { current: pos + 1, total })}
            </span>
          </div>

          <div className="text-center text-[11px] text-fg-subtle">{current.sourceLabel}</div>

          <button
            type="button"
            onClick={() => setFlipped((value) => !value)}
            className="block w-full text-left"
            aria-label={t('flipAria')}
          >
            <Surface interactive className="min-h-[260px]">
              <div className="flex min-h-[260px] flex-col p-6 sm:p-8">
                <div className="eyebrow text-fg-subtle">{flipped ? t('back') : t('front')}</div>
                <div className="flex flex-1 items-center justify-center py-6">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={flipped ? 'back' : 'front'}
                      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                      className={cx(
                        'text-center font-serif leading-relaxed text-fg',
                        flipped ? 'text-[17px]' : 'text-[20px] font-medium',
                      )}
                    >
                      {flipped ? current.card.back : current.card.front}
                    </motion.div>
                  </AnimatePresence>
                </div>
                <div className="text-center text-[12px] text-fg-subtle">
                  {flipped ? '' : t('flipHint')}
                </div>
              </div>
            </Surface>
          </button>

          {flipped ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {RATINGS.map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => rate(entry.key)}
                  className={cx(
                    'flex h-12 items-center justify-center gap-1.5 rounded-lg border bg-surface',
                    'text-[14px] font-medium transition-colors duration-fast',
                    entry.tone,
                  )}
                >
                  {t(`rating.${entry.key}`)}
                  <span className="text-[11px] opacity-50">{entry.hotkey}</span>
                </button>
              ))}
            </div>
          ) : (
            <Button variant="primary" size="lg" className="w-full" onClick={() => setFlipped(true)}>
              {t('show')}
            </Button>
          )}

          <p className="text-center text-[11px] text-fg-subtle">{t('shortcutHint')}</p>
        </div>
      )}
    </div>
  );
};
