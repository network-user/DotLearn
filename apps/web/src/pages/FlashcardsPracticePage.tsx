import { useMemo, useState } from 'react';

import { Link, useSearch } from '@tanstack/react-router';
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
import { interviewCategories, interviewStages } from '@/lib/interview';
import { getCurrentLanguage } from '@/lib/i18n';
import { topicTitleOf } from '@/lib/topics';

type PracticeMode = 'topics' | 'interview' | 'random';

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

export const FlashcardsPracticePage = () => {
  const { t } = useTranslation('flashcards');
  const search = useSearch({ strict: false }) as { mode?: PracticeMode; category?: string };
  const language = getCurrentLanguage();
  const topicSlugs = useMemo(() => flashcardTopicSlugs(), []);
  const [mode, setMode] = useState<PracticeMode>(search.mode ?? 'topics');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [category, setCategory] = useState(search.category ?? 'all');
  const [stage, setStage] = useState('all');
  const [dueOnly, setDueOnly] = useState('due');
  const [count, setCount] = useState('20');
  const [session, setSession] = useState<Session | undefined>(undefined);
  const [starting, setStarting] = useState(false);

  const toggleTopic = (slug: string): void => {
    setSelectedTopics((current) =>
      current.includes(slug) ? current.filter((entry) => entry !== slug) : [...current, slug],
    );
  };

  const selectAllTopics = (): void => {
    setSelectedTopics(topicSlugs);
  };

  const clearTopics = (): void => {
    setSelectedTopics([]);
  };

  const start = async (): Promise<void> => {
    setStarting(true);
    try {
      let pool: SessionCard[] = [];
      let title = '';
      let subtitle = '';
      if (mode === 'topics') {
        pool = await loadTopicSessionCards(selectedTopics, language);
        title = t('practice.topicsTitle');
        subtitle = t('practice.topicsSubtitle', { count: selectedTopics.length });
      } else if (mode === 'interview') {
        pool = await loadInterviewSessionCards(language, { category, stage });
        title = t('practice.interviewTitle');
        subtitle = t('practice.interviewSubtitle');
      } else {
        pool = await loadMixedSessionCards(language, topicSlugs);
        title = t('practice.randomTitle');
        subtitle = t('practice.randomSubtitle');
      }
      if (dueOnly === 'due') {
        pool = await filterDueCards(pool);
      }
      pool = shuffleCards(pool);
      const limit = count === 'all' ? pool.length : Number(count);
      setSession({
        cards: pool.slice(0, limit),
        title,
        subtitle,
      });
    } finally {
      setStarting(false);
    }
  };

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
    mode === 'topics'
      ? selectedTopics.length > 0
      : mode === 'interview' || mode === 'random';

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
            onClick={() => setMode(entry.key)}
            className={`rounded-2xl border p-4 text-left transition-colors duration-fast ${
              mode === entry.key
                ? 'border-accent/50 bg-accent/5'
                : 'border-border-base bg-surface hover:bg-surface-2/40'
            }`}
          >
            <entry.icon size={18} className={mode === entry.key ? 'text-accent' : 'text-fg-subtle'} />
            <div className="mt-3 font-medium text-fg">{entry.label}</div>
          </button>
        ))}
      </div>

      <Surface variant="chrome" className="p-4 sm:p-5">
        {mode === 'topics' && (
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-fg-muted">{t('practice.pickTopics')}</span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAllTopics}>
                  {t('practice.selectAll')}
                </Button>
                <Button variant="ghost" size="sm" onClick={clearTopics}>
                  {t('practice.clearAll')}
                </Button>
              </div>
            </div>
            <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
              {topicSlugs.map((slug) => {
                const active = selectedTopics.includes(slug);
                return (
                  <label
                    key={slug}
                    className={`flex min-h-[var(--tap)] cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 transition-colors ${
                      active ? 'border-accent/40 bg-accent/5' : 'border-border-base'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => toggleTopic(slug)}
                      className="size-4 shrink-0 accent-accent"
                    />
                    <span className="truncate text-sm text-fg">{topicTitleOf(slug) ?? slug}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {mode === 'interview' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <PracticeField label={t('practice.filterCategory')}>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
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
                value={stage}
                onChange={(event) => setStage(event.target.value)}
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

        {mode === 'random' && (
          <div className="flex items-start gap-3 text-sm text-fg-muted">
            <Dices size={18} className="mt-0.5 shrink-0 text-accent" />
            <p>{t('practice.randomHint')}</p>
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <PracticeField label={t('practice.filterDue')}>
            <select
              value={dueOnly}
              onChange={(event) => setDueOnly(event.target.value)}
              className="form-input"
            >
              <option value="due">{t('practice.dueOnly')}</option>
              <option value="all">{t('practice.allCards')}</option>
            </select>
          </PracticeField>
          <PracticeField label={t('practice.filterCount')}>
            <select
              value={count}
              onChange={(event) => setCount(event.target.value)}
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
