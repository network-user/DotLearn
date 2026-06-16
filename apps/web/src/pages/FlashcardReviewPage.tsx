import { useEffect, useMemo, useState } from 'react';

import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { FlashcardReviewSession } from '@/components/FlashcardReviewSession';
import { Button } from '@/components/ui/Button';
import { loadTopicCards } from '@/lib/flashcard-decks';
import type { SessionCard } from '@/lib/flashcard-sources';
import { getCurrentLanguage } from '@/lib/i18n';
import { topicTitleOf } from '@/lib/topics';

export const FlashcardReviewPage = () => {
  const { t } = useTranslation('flashcards');
  const params = useParams({ strict: false }) as { slug?: string };
  const slug = params.slug ?? '';
  const language = getCurrentLanguage();
  const title = topicTitleOf(slug) ?? slug;
  const [cards, setCards] = useState<SessionCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
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
        if (!cancelled) setCards([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, language, title]);

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
      {header}
      <FlashcardReviewSession cards={cards} loading={loading} emptyMessage={t('noDeck')} />
    </div>
  );
};
