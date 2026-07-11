import { useCallback, useEffect, useMemo, useState } from 'react';

import { Link, useParams } from '@tanstack/react-router';
import { AlertTriangle, ArrowLeft, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { FlashcardReviewSession } from '@/components/FlashcardReviewSession';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { loadTopicCards } from '@/lib/flashcard-decks';
import type { SessionCard } from '@/lib/flashcard-sources';
import { Seo } from '@/lib/seo';
import { topicTitleOf, useContentLanguage } from '@/lib/topics';

export const FlashcardReviewPage = () => {
  const { t } = useTranslation('flashcards');
  const params = useParams({ strict: false }) as { slug?: string };
  const slug = params.slug ?? '';
  const language = useContentLanguage();
  const title = topicTitleOf(slug) ?? slug;
  const [cards, setCards] = useState<SessionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrored(false);
    loadTopicCards(slug, language)
      .then((loaded) => {
        if (cancelled) return;
        setCards(
          loaded.map((card) => ({
            deckSlug: slug,
            card,
            source: 'topics',
            sourceLabel: title,
          })),
        );
      })
      .catch(() => {
        if (cancelled) return;
        setCards([]);
        setErrored(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, language, title, retryToken]);

  const retry = useCallback(() => {
    setRetryToken((value) => value + 1);
  }, []);

  const header = useMemo(
    () => (
      <div className="flex items-center justify-between gap-3">
        <Link to="/flashcards">
          <Button variant="ghost" size="sm" leadingIcon={<ArrowLeft size={15} />}>
            {t('backToHub')}
          </Button>
        </Link>
        <div className="min-w-0 text-right">
          <div className="eyebrow text-fg-subtle">{t('title')}</div>
          <h1 className="truncate font-display text-xl tracking-tightish text-fg">{title}</h1>
        </div>
      </div>
    ),
    [t, title],
  );

  return (
    <div className="space-y-6">
      <Seo robots="noindex,nofollow" title={t('title')} />
      {header}
      {errored ? (
        <div className="mx-auto max-w-2xl">
          <EmptyState
            icon={<AlertTriangle size={22} className="text-warn" />}
            title={t('errorTitle')}
            body={t('errorBody')}
            primaryAction={
              <Button
                variant="primary"
                size="md"
                className="w-full min-h-[var(--tap)] sm:min-h-0 sm:w-auto"
                leadingIcon={<RotateCcw size={15} />}
                onClick={retry}
              >
                {t('retry')}
              </Button>
            }
            secondaryAction={
              <Link to="/flashcards" className="block w-full sm:w-auto">
                <Button
                  variant="ghost"
                  size="md"
                  className="w-full min-h-[var(--tap)] sm:min-h-0 sm:w-auto"
                >
                  {t('backToHub')}
                </Button>
              </Link>
            }
          />
        </div>
      ) : (
        <FlashcardReviewSession cards={cards} loading={loading} emptyMessage={t('noDeck')} />
      )}
    </div>
  );
};
