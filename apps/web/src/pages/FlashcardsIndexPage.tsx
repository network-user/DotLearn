import { useEffect, useMemo, useState } from 'react';

import { isCardDue } from '@dotlearn/lesson-engine';
import { Link } from '@tanstack/react-router';
import { ArrowRight, GraduationCap, Layers, Play, Shuffle, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Surface } from '@/components/ui/Surface';
import { flashcardTopicSlugs, loadTopicCards } from '@/lib/flashcard-decks';
import { loadFlashcardStats, type FlashcardStats } from '@/lib/flashcard-sources';
import {
  interviewFlashcardCoverage,
  loadInterviewCards,
  type InterviewFlashcardCoverage,
} from '@/lib/interview-flashcards';
import { getInterviewCategories } from '@/lib/interview';
import { db } from '@/lib/progress-db';
import { Seo } from '@/lib/seo';
import { topicTitleOf, useContentLanguage } from '@/lib/topics';

interface DeckSummary {
  slug: string;
  title: string;
  total: number;
  due: number;
}

interface InterviewSummary {
  category: string;
  label: string;
  total: number;
}

export const FlashcardsIndexPage = () => {
  const { t } = useTranslation('flashcards');
  const { t: tSeo } = useTranslation('seo');
  const language = useContentLanguage();
  const slugs = useMemo(() => flashcardTopicSlugs(), []);
  const [summaries, setSummaries] = useState<DeckSummary[] | undefined>(undefined);
  const [interviewSummaries, setInterviewSummaries] = useState<InterviewSummary[] | undefined>(
    undefined,
  );
  const [stats, setStats] = useState<FlashcardStats | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void loadFlashcardStats(language).then((loaded) => {
      if (!cancelled) setStats(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [language]);

  useEffect(() => {
    let cancelled = false;
    const now = new Date();
    Promise.all(
      slugs.map(async (slug): Promise<DeckSummary | null> => {
        try {
          const [cards, records] = await Promise.all([
            loadTopicCards(slug, language),
            db.flashcardReviews.where('topicSlug').equals(slug).toArray(),
          ]);
          const reviewed = new Map(records.map((record) => [record.cardId, record]));
          const due = cards.filter((card) => isCardDue(reviewed.get(card.id), now)).length;
          return { slug, title: topicTitleOf(slug) ?? slug, total: cards.length, due };
        } catch (error) {
          console.warn(`Skipping flashcard deck "${slug}": failed to load`, error);
          return null;
        }
      }),
    )
      .then((rows) => {
        if (!cancelled) {
          setSummaries(rows.filter((row): row is DeckSummary => row !== null && row.total > 0));
        }
      })
      .catch(() => {
        if (!cancelled) setSummaries([]);
      });
    return () => {
      cancelled = true;
    };
  }, [slugs, language]);

  useEffect(() => {
    let cancelled = false;
    void loadInterviewCards(language).then((cards) => {
      if (cancelled) return;
      const byCategory = new Map<string, InterviewSummary>();
      for (const card of cards) {
        const existing = byCategory.get(card.category);
        if (existing) {
          existing.total += 1;
        } else {
          byCategory.set(card.category, {
            category: card.category,
            label: card.categoryLabel,
            total: 1,
          });
        }
      }
      const rows = [...byCategory.values()].sort((a, b) => a.label.localeCompare(b.label, 'ru'));
      setInterviewSummaries(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [language]);

  const [coverage, setCoverage] = useState<InterviewFlashcardCoverage>({
    cards: 0,
    missing: 0,
    missingPaths: [],
  });
  useEffect(() => {
    let cancelled = false;
    void interviewFlashcardCoverage(language).then((result) => {
      if (!cancelled) setCoverage(result);
    });
    return () => {
      cancelled = true;
    };
  }, [language]);
  const ready = summaries !== undefined && interviewSummaries !== undefined;

  const reviewAllInterviewSearch = {
    mode: 'interview' as const,
    due: 'all' as const,
    count: 'all',
    start: true,
  };

  const reviewCategorySearch = (category: string) => ({
    mode: 'interview' as const,
    category,
    due: 'all' as const,
    count: 'all',
    start: true,
  });

  const practiceTopicSearch = (slug: string) => ({
    mode: 'topics' as const,
    topics: slug,
    start: true,
  });

  return (
    <div className="space-y-8">
      <Seo
        title={t('title')}
        description={tSeo('flashcardsDescription')}
        canonicalPath="/flashcards"
      />
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 eyebrow text-fg-subtle">
          <Sparkles size={12} className="text-accent" />
          <span>{t('eyebrow')}</span>
        </div>
        <h1 className="font-display text-3xl tracking-tightish text-fg">{t('title')}</h1>
        <p className="max-w-prose text-sm text-fg-muted">{t('hubSubtitle')}</p>
      </header>

      {coverage.missing > 0 && (
        <Surface variant="inset">
          <p className="p-4 text-sm text-fg-muted">
            {t('coverageWarning', {
              missing: coverage.missing,
              total: coverage.cards + coverage.missing,
            })}
          </p>
        </Surface>
      )}

      {stats === undefined ? (
        <Skeleton rounded="2xl" className="h-28" />
      ) : (
        <Surface variant="chrome" className="p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatBlock label={t('stats.total')} value={stats.totalCards} />
            <StatBlock label={t('stats.due')} value={stats.due} tone="warning" />
            <StatBlock label={t('stats.topicDecks')} value={stats.topicDecks} />
            <StatBlock label={t('stats.interviewCards')} value={stats.interviewCards} />
          </div>
        </Surface>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl tracking-tightish text-fg">{t('practiceModes')}</h2>
          <Link to="/flashcards/practice">
            <Button variant="primary" size="sm" leadingIcon={<Play size={14} />}>
              {t('openPractice')}
            </Button>
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <ModeCard
            to="/flashcards/practice"
            search={{ mode: 'topics' }}
            icon={Layers}
            title={t('practice.modeTopics')}
            body={t('modeTopicsHint')}
          />
          <ModeCard
            to="/flashcards/practice"
            search={{ mode: 'interview' }}
            icon={GraduationCap}
            title={t('practice.modeInterview')}
            body={t('modeInterviewHint')}
          />
          <ModeCard
            to="/flashcards/practice"
            search={{ mode: 'random' }}
            icon={Shuffle}
            title={t('practice.modeRandom')}
            body={t('modeRandomHint')}
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl tracking-tightish text-fg">{t('topicDecksHeading')}</h2>
        {!ready ? (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
            {[0, 1, 2].map((index) => (
              <li key={index}>
                <Skeleton rounded="2xl" className="h-32" />
              </li>
            ))}
          </ul>
        ) : summaries!.length === 0 ? (
          <EmptyState
            icon={<Layers size={22} className="text-accent" />}
            title={t('hubEmptyTitle')}
            body={t('hubEmptyBody')}
            primaryAction={
              <Link to="/" hash="topics" className="block w-full sm:w-auto">
                <Button
                  variant="primary"
                  size="md"
                  className="w-full min-h-[var(--tap)] sm:min-h-0 sm:w-auto"
                  trailingIcon={<ArrowRight size={15} />}
                >
                  {t('exploreTopics')}
                </Button>
              </Link>
            }
          />
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {summaries!.map((summary) => (
              <li key={summary.slug}>
                <Surface interactive className="h-full">
                  <div className="flex h-full flex-col gap-4 p-5">
                    <Link
                      to="/flashcards/$slug"
                      params={{ slug: summary.slug }}
                      className="group block min-w-0 flex-1"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="min-w-0 font-display text-xl leading-tight tracking-tightish text-fg">
                          {summary.title}
                        </h3>
                        <Layers size={18} className="shrink-0 text-fg-subtle" />
                      </div>
                    </Link>
                    <div className="mt-auto flex flex-col gap-2 sm:flex-row sm:items-center">
                      <div className="flex flex-wrap items-center gap-2">
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
                      <Link
                        to="/flashcards/practice"
                        search={practiceTopicSearch(summary.slug)}
                        className="sm:ml-auto"
                      >
                        <Button variant="outline" size="sm" className="w-full sm:w-auto">
                          {t('practiceTopic')}
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Surface>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-xl tracking-tightish text-fg">
              {t('interviewDecksHeading')}
            </h2>
            <span className="text-sm text-fg-subtle">
              {t('interviewCategoriesCount', { count: getInterviewCategories().length })}
            </span>
          </div>
          <Link to="/flashcards/practice" search={reviewAllInterviewSearch}>
            <Button variant="outline" size="sm" className="w-full sm:w-auto">
              {t('reviewAllInterview')}
            </Button>
          </Link>
        </div>
        {!ready ? (
          <Skeleton rounded="2xl" className="h-32" />
        ) : interviewSummaries!.length === 0 ? (
          <EmptyState
            icon={<GraduationCap size={22} className="text-accent" />}
            title={t('interviewEmptyTitle')}
            body={t('interviewEmptyBody')}
            primaryAction={
              <Link to="/interview" className="block w-full sm:w-auto">
                <Button
                  variant="primary"
                  size="md"
                  className="w-full min-h-[var(--tap)] sm:min-h-0 sm:w-auto"
                  trailingIcon={<ArrowRight size={15} />}
                >
                  {t('openInterviewPrep')}
                </Button>
              </Link>
            }
          />
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {interviewSummaries!.map((summary) => (
              <li key={summary.category}>
                <Surface interactive className="h-full">
                  <div className="flex h-full flex-col gap-4 p-5">
                    <Link
                      to="/flashcards/practice"
                      search={{ mode: 'interview', category: summary.category }}
                      className="block min-w-0"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="min-w-0 font-display text-xl leading-tight tracking-tightish text-fg">
                          {summary.label}
                        </h3>
                        <GraduationCap size={18} className="shrink-0 text-fg-subtle" />
                      </div>
                    </Link>
                    <Badge tone="neutral" variant="soft">
                      {t('cardsLabel', { count: summary.total })}
                    </Badge>
                    <div className="mt-auto flex flex-col gap-2 sm:flex-row">
                      <Link
                        to="/flashcards/practice"
                        search={{ mode: 'interview', category: summary.category }}
                        className="flex-1"
                      >
                        <Button variant="ghost" size="sm" className="w-full">
                          {t('practice.configure')}
                        </Button>
                      </Link>
                      <Link
                        to="/flashcards/practice"
                        search={reviewCategorySearch(summary.category)}
                        className="flex-1"
                      >
                        <Button variant="outline" size="sm" className="w-full">
                          {t('reviewCategory')}
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Surface>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

const StatBlock = ({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'warning';
}) => (
  <div>
    <div className="eyebrow text-[10px] text-fg-subtle">{label}</div>
    <div
      className={`mt-1 font-display text-2xl tabular-nums ${
        tone === 'warning' ? 'text-warn' : 'text-fg'
      }`}
    >
      {value}
    </div>
  </div>
);

const ModeCard = ({
  to,
  search,
  icon: Icon,
  title,
  body,
}: {
  to: string;
  search?: { mode: 'topics' | 'interview' | 'random'; category?: string };
  icon: typeof Layers;
  title: string;
  body: string;
}) => (
  <Link {...(search ? { to, search } : { to })} className="block h-full">
    <Surface interactive className="h-full">
      <div className="flex h-full flex-col gap-3 p-5">
        <Icon size={18} className="text-accent" />
        <h3 className="font-display text-lg tracking-tightish text-fg">{title}</h3>
        <p className="text-sm text-fg-muted">{body}</p>
      </div>
    </Surface>
  </Link>
);
