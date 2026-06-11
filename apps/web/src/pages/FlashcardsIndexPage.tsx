import { useEffect, useMemo, useState } from 'react';

import { Link } from '@tanstack/react-router';
import { Layers, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { Surface } from '@/components/ui/Surface';
import { flashcardTopicSlugs, loadTopicCards } from '@/lib/flashcard-decks';
import { getCurrentLanguage } from '@/lib/i18n';
import { db } from '@/lib/progress-db';
import { topicTitleOf } from '@/lib/topics';

interface DeckSummary {
  slug: string;
  title: string;
  total: number;
  due: number;
}

export const FlashcardsIndexPage = () => {
  const { t } = useTranslation('flashcards');
  const language = getCurrentLanguage();
  const slugs = useMemo(() => flashcardTopicSlugs(), []);
  const [summaries, setSummaries] = useState<DeckSummary[] | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const now = Date.now();
    Promise.all(
      slugs.map(async (slug) => {
        const [cards, records] = await Promise.all([
          loadTopicCards(slug, language),
          db.flashcardReviews.where('topicSlug').equals(slug).toArray(),
        ]);
        const reviewed = new Map(records.map((record) => [record.cardId, record]));
        const due = cards.filter((card) => {
          const record = reviewed.get(card.id);
          return !record || new Date(record.due).getTime() <= now;
        }).length;
        return { slug, title: topicTitleOf(slug) ?? slug, total: cards.length, due };
      }),
    )
      .then((rows) => {
        if (!cancelled) setSummaries(rows.filter((row) => row.total > 0));
      })
      .catch(() => {
        if (!cancelled) setSummaries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [slugs, language]);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 eyebrow text-fg-subtle">
          <Sparkles size={12} className="text-accent" />
          <span>{t('eyebrow')}</span>
        </div>
        <h1 className="font-display text-3xl tracking-tightish text-fg">{t('title')}</h1>
        <p className="max-w-prose text-sm text-fg-muted">{t('hubSubtitle')}</p>
      </header>

      {summaries === undefined ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
          {[0, 1, 2].map((index) => (
            <li key={index}>
              <Skeleton rounded="2xl" className="h-32" />
            </li>
          ))}
        </ul>
      ) : summaries.length === 0 ? (
        <Surface variant="inset">
          <div className="p-8 text-center">
            <p className="text-sm text-fg-muted">{t('hubEmpty')}</p>
          </div>
        </Surface>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {summaries.map((summary) => (
            <li key={summary.slug}>
              <Link
                to="/flashcards/$slug"
                params={{ slug: summary.slug }}
                className="group block h-full"
              >
                <Surface interactive className="h-full">
                  <div className="flex h-full flex-col gap-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="min-w-0 font-display text-xl leading-tight tracking-tightish text-fg">
                        {summary.title}
                      </h2>
                      <Layers size={18} className="shrink-0 text-fg-subtle" />
                    </div>
                    <div className="mt-auto flex items-center gap-2">
                      <Badge tone="neutral" variant="soft">
                        {t('cardsLabel', { count: summary.total })}
                      </Badge>
                      {summary.due > 0 && (
                        <Badge tone="warning" variant="soft">
                          {t('dueLabel', { count: summary.due })}
                        </Badge>
                      )}
                      {summary.due === 0 && (
                        <Badge tone="success" variant="outline">
                          {t('caughtUpBadge')}
                        </Badge>
                      )}
                    </div>
                  </div>
                </Surface>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
