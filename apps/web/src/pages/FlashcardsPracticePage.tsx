import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { Dices, GraduationCap, Layers, Shuffle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { FlashcardReviewSession } from '@/components/FlashcardReviewSession';
import { Button } from '@/components/ui/Button';
import { Surface } from '@/components/ui/Surface';
import {
  filterDueCards,
  loadInterviewSessionCards,
  loadMixedSessionCards,
  loadTopicSessionCards,
  shuffleCards,
  type SessionCard,
} from '@/lib/flashcard-sources';
import { flashcardTopicSlugs } from '@/lib/flashcard-decks';
import {
  parseFlashcardsPracticeSearch,
  parseTopicsParam,
  practiceSearchDefaults,
  topicsToParam,
  type FlashcardsPracticeSearch,
} from '@dotlearn/lesson-engine';
import { interviewCategories, interviewStages } from '@/lib/interview';
import { topicTitleOf, useContentLanguage } from '@/lib/topics';

interface Session {
  cards: SessionCard[];
  title: string;
  subtitle: string;
}

const PracticeField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="eyebrow mb-1 block text-[10px] text-fg-subtle">{label}</span>
    {children}
  </label>
);

const resolvedSearch = (
  search: FlashcardsPracticeSearch,
): Required<Pick<FlashcardsPracticeSearch, 'mode' | 'category' | 'stage' | 'due' | 'count'>> &
  Pick<FlashcardsPracticeSearch, 'topics' | 'start'> => ({
  mode: search.mode ?? practiceSearchDefaults.mode,
  category: search.category ?? practiceSearchDefaults.category,
  stage: search.stage ?? practiceSearchDefaults.stage,
  due: search.due ?? practiceSearchDefaults.due,
  count: search.count ?? practiceSearchDefaults.count,
  topics: search.topics,
  start: search.start,
});

export const FlashcardsPracticePage = () => {
  const { t } = useTranslation('flashcards');
  const navigate = useNavigate();
  const rawSearch = useSearch({ strict: false }) as Record<string, unknown>;
  const search = useMemo(() => parseFlashcardsPracticeSearch(rawSearch), [rawSearch]);
  const active = useMemo(() => resolvedSearch(search), [search]);
  const language = useContentLanguage();
  const topicSlugs = useMemo(() => flashcardTopicSlugs(), []);
  const selectedTopics = useMemo(
    () => parseTopicsParam(active.topics, topicSlugs),
    [active.topics, topicSlugs],
  );

  const [session, setSession] = useState<Session | undefined>(undefined);
  const [starting, setStarting] = useState(false);
  const autostartHandled = useRef(false);

  const patchSearch = useCallback(
    (patch: FlashcardsPracticeSearch): void => {
      const next = resolvedSearch({ ...active, ...patch, start: undefined });
      void navigate({
        to: '/flashcards/practice',
        search: {
          mode: next.mode,
          ...(next.category !== 'all' ? { category: next.category } : {}),
          ...(next.stage !== 'all' ? { stage: next.stage } : {}),
          ...(next.topics ? { topics: next.topics } : {}),
          ...(next.due !== 'due' ? { due: next.due } : {}),
          ...(next.count !== '20' ? { count: next.count } : {}),
        },
        replace: true,
      });
    },
    [active, navigate],
  );

  const start = useCallback(async (): Promise<void> => {
    setStarting(true);
    try {
      let pool: SessionCard[] = [];
      let title = '';
      let subtitle = '';
      if (active.mode === 'topics') {
        pool = await loadTopicSessionCards(selectedTopics, language);
        title = t('practice.topicsTitle');
        subtitle = t('practice.topicsSubtitle', { count: selectedTopics.length });
      } else if (active.mode === 'interview') {
        const filter: { category?: string; stage?: string } = {};
        if (active.category && active.category !== 'all') filter.category = active.category;
        if (active.stage && active.stage !== 'all') filter.stage = active.stage;
        pool = await loadInterviewSessionCards(language, filter);
        title = t('practice.interviewTitle');
        subtitle = t('practice.interviewSubtitle');
      } else {
        pool = await loadMixedSessionCards(language, topicSlugs);
        title = t('practice.randomTitle');
        subtitle = t('practice.randomSubtitle');
      }
      if (active.due === 'due') {
        pool = await filterDueCards(pool);
      }
      pool = shuffleCards(pool);
      const limit = active.count === 'all' ? pool.length : Number(active.count);
      setSession({
        cards: pool.slice(0, limit),
        title,
        subtitle,
      });
    } finally {
      setStarting(false);
    }
  }, [active, language, selectedTopics, t, topicSlugs]);

  useEffect(() => {
    if (!search.start || session || starting || autostartHandled.current) return;
    autostartHandled.current = true;
    void start().finally(() => {
      patchSearch({});
    });
  }, [search.start, session, starting, start, patchSearch]);

  useEffect(() => {
    if (!session) {
      autostartHandled.current = false;
    }
  }, [session]);

  if (session) {
    return (
      <FlashcardReviewSession
        cards={session.cards}
        title={session.title}
        subtitle={session.subtitle}
        onExit={() => setSession(undefined)}
        exitLabel={t('practice.backToSetup')}
      />
    );
  }

  const canStart =
    active.mode === 'topics'
      ? selectedTopics.length > 0
      : active.mode === 'interview' || active.mode === 'random';

  return (
    <div className="space-y-6">
      <header className="space-y-2 border-y border-border-base py-6 sm:py-8">
        <div className="eyebrow eyebrow-accent mb-3 flex items-center gap-2">
          <GraduationCap size={13} />
          {t('practice.eyebrow')}
        </div>
        <h1 className="font-display text-[clamp(28px,5vw,44px)] font-medium leading-[1.1] tracking-tightish text-balance">
          {t('practice.title')}
        </h1>
        <p className="mt-3 max-w-prose leading-relaxed text-fg-muted">{t('practice.subtitle')}</p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(
          [
            { key: 'topics' as const, icon: Layers, label: t('practice.modeTopics') },
            { key: 'interview' as const, icon: GraduationCap, label: t('practice.modeInterview') },
            { key: 'random' as const, icon: Shuffle, label: t('practice.modeRandom') },
          ] as const
        ).map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => patchSearch({ mode: entry.key })}
            className={`rounded-2xl border p-4 text-left transition-colors duration-fast ${
              active.mode === entry.key
                ? 'border-accent/50 bg-accent/5'
                : 'border-border-base bg-surface hover:bg-surface-2/40'
            }`}
          >
            <entry.icon
              size={18}
              className={active.mode === entry.key ? 'text-accent' : 'text-fg-subtle'}
            />
            <div className="mt-3 font-medium text-fg">{entry.label}</div>
          </button>
        ))}
      </div>

      <Surface variant="chrome" className="p-4 sm:p-5">
        {active.mode === 'topics' && (
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-fg-muted">{t('practice.pickTopics')}</span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => patchSearch({ topics: topicsToParam(topicSlugs) })}
                >
                  {t('practice.selectAll')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => patchSearch({ topics: undefined })}
                >
                  {t('practice.clearAll')}
                </Button>
              </div>
            </div>
            <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
              {topicSlugs.map((slug) => {
                const checked = selectedTopics.includes(slug);
                return (
                  <label
                    key={slug}
                    className={`flex min-h-[var(--tap)] cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 transition-colors ${
                      checked ? 'border-accent/40 bg-accent/5' : 'border-border-base'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        const next = checked
                          ? selectedTopics.filter((entry) => entry !== slug)
                          : [...selectedTopics, slug];
                        patchSearch({ topics: topicsToParam(next) });
                      }}
                      className="size-4 shrink-0 accent-accent"
                    />
                    <span className="truncate text-sm text-fg">{topicTitleOf(slug) ?? slug}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {active.mode === 'interview' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <PracticeField label={t('practice.filterCategory')}>
              <select
                value={active.category}
                onChange={(event) =>
                  patchSearch({
                    category: event.target.value === 'all' ? undefined : event.target.value,
                  })
                }
                className="form-input"
              >
                <option value="all">{t('practice.allCategories')}</option>
                {interviewCategories.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.label} ({item.count})
                  </option>
                ))}
              </select>
            </PracticeField>
            <PracticeField label={t('practice.filterStage')}>
              <select
                value={active.stage}
                onChange={(event) =>
                  patchSearch({
                    stage: event.target.value === 'all' ? undefined : event.target.value,
                  })
                }
                className="form-input"
              >
                <option value="all">{t('practice.allStages')}</option>
                {interviewStages.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.label} ({item.count})
                  </option>
                ))}
              </select>
            </PracticeField>
          </div>
        )}

        {active.mode === 'random' && (
          <div className="flex items-start gap-3 text-sm text-fg-muted">
            <Dices size={18} className="mt-0.5 shrink-0 text-accent" />
            <p>{t('practice.randomHint')}</p>
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <PracticeField label={t('practice.filterDue')}>
            <select
              value={active.due}
              onChange={(event) =>
                patchSearch({
                  due: event.target.value === 'due' ? undefined : (event.target.value as 'all'),
                })
              }
              className="form-input"
            >
              <option value="due">{t('practice.dueOnly')}</option>
              <option value="all">{t('practice.allCards')}</option>
            </select>
          </PracticeField>
          <PracticeField label={t('practice.filterCount')}>
            <select
              value={active.count}
              onChange={(event) =>
                patchSearch({
                  count: event.target.value === '20' ? undefined : event.target.value,
                })
              }
              className="form-input"
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="all">{t('practice.countAll')}</option>
            </select>
          </PracticeField>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button
            onClick={() => void start()}
            disabled={!canStart || starting}
            className="w-full sm:w-auto"
          >
            {starting ? t('practice.starting') : t('practice.start')}
          </Button>
        </div>
      </Surface>

      <p className="text-sm text-fg-subtle">
        <Link to="/flashcards" className="text-accent underline-offset-2 hover:underline">
          {t('backToHub')}
        </Link>
      </p>
    </div>
  );
};
