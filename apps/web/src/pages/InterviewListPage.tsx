import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import type { InterviewQuestionMeta, InterviewStage } from '@dotlearn/contracts';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { CheckCircle2, GraduationCap, Search, Shuffle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { InterviewSearch } from '@/router';
import { Badge } from '@/components/ui/Badge';
import { cx } from '@/components/ui/cx';
import { Surface } from '@/components/ui/Surface';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { getCurrentLanguage } from '@/lib/i18n';
import {
  interviewCategories,
  interviewQuestions,
  interviewStages,
  localizedInterviewTitle,
} from '@/lib/interview';
import { useInterviewStudiedIds } from '@/lib/use-interview';

type SortKey = 'default' | 'title' | 'topic' | 'stage';
type StatusFilter = 'all' | 'studied' | 'not-studied';

const STAGE_ORDER: InterviewStage[] = ['hr', 'tech', 'system-design'];

const stageTone: Record<InterviewStage, 'accent' | 'info' | 'success'> = {
  tech: 'accent',
  'system-design': 'info',
  hr: 'success',
};

const normalize = (value: string): string => value.toLowerCase().trim();

export const InterviewListPage = () => {
  const { t } = useTranslation('interview');
  const studiedIds = useInterviewStudiedIds();
  const search = useSearch({ from: '/interview' });
  const navigate = useNavigate();

  const query = search.q ?? '';
  const category = search.topic ?? 'all';
  const stage = search.stage ?? 'all';
  const status: StatusFilter = search.status ?? 'all';
  const sort: SortKey = search.sort ?? 'default';

  // Keep the search box responsive locally and only push the debounced value to the URL,
  // so a keystroke no longer drives a router navigation + re-filter of every question.
  const [queryInput, setQueryInput] = useState(query);
  const debouncedQuery = useDebouncedValue(queryInput, 220);

  const patch = (
    next: Partial<InterviewSearch>,
    options?: { replace?: boolean },
  ): void => {
    void navigate({
      to: '/interview',
      search: (prev): InterviewSearch => ({ ...(prev as InterviewSearch), ...next }),
      ...(options?.replace ? { replace: true } : {}),
    });
  };

  useEffect(() => {
    if ((debouncedQuery || undefined) !== (query || undefined)) {
      patch({ q: debouncedQuery || undefined }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  useEffect(() => {
    setQueryInput(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const setCategory = (value: string): void =>
    patch({ topic: value === 'all' ? undefined : value });
  const setStage = (value: string): void =>
    patch({ stage: value === 'all' ? undefined : value });
  const setStatus = (value: StatusFilter): void =>
    patch({ status: value === 'all' ? undefined : value });
  const setSort = (value: SortKey): void =>
    patch({ sort: value === 'default' ? undefined : value });

  const locale = getCurrentLanguage();
  const titleOf = (question: InterviewQuestionMeta): string =>
    localizedInterviewTitle(question, locale);

  const visible = useMemo(() => {
    const title = (question: InterviewQuestionMeta): string =>
      localizedInterviewTitle(question, locale);
    const needle = normalize(query);
    const filtered = interviewQuestions.filter((question) => {
      if (category !== 'all' && question.category !== category) return false;
      if (stage !== 'all' && question.stage !== stage) return false;
      if (status === 'studied' && !studiedIds.has(question.id)) return false;
      if (status === 'not-studied' && studiedIds.has(question.id)) return false;
      if (needle && !normalize(title(question)).includes(needle)) return false;
      return true;
    });

    const byTitle = (a: InterviewQuestionMeta, b: InterviewQuestionMeta): number =>
      title(a).localeCompare(title(b), locale);

    const sorted = [...filtered];
    if (sort === 'title') {
      sorted.sort(byTitle);
    } else if (sort === 'topic') {
      sorted.sort(
        (a, b) => a.categoryLabel.localeCompare(b.categoryLabel, 'ru') || byTitle(a, b),
      );
    } else if (sort === 'stage') {
      sorted.sort(
        (a, b) =>
          STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) || byTitle(a, b),
      );
    } else {
      sorted.sort((a, b) => a.id - b.id);
    }
    return sorted;
  }, [query, category, stage, status, sort, studiedIds, locale]);

  const studiedCount = studiedIds.size;

  const goRandom = (): void => {
    const pool = visible.length > 0 ? visible : interviewQuestions;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) {
      void navigate({ to: '/interview/$id', params: { id: String(pick.id) } });
    }
  };

  return (
    <div className="space-y-6">
      <header className="border-y border-border-base py-6 sm:py-8">
        <div className="eyebrow eyebrow-accent mb-3">{t('eyebrow')}</div>
        <h1 className="font-display font-medium text-[clamp(30px,5vw,48px)] leading-[1.1] tracking-tightish text-balance">
          {t('title')}
        </h1>
        <p className="mt-3 max-w-prose text-fg-muted leading-relaxed">{t('subtitle')}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 eyebrow text-fg-subtle">
          <span>{t('totalQuestions', { count: interviewQuestions.length })}</span>
          <span aria-hidden>·</span>
          <span>{t('categoriesCount', { count: interviewCategories.length })}</span>
          {studiedCount > 0 && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1 text-ok">
                <CheckCircle2 size={12} />
                {t('studiedCount', { count: studiedCount })}
              </span>
            </>
          )}
        </div>
        <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={goRandom}
            className="inline-flex items-center gap-2 rounded-full border border-border-base px-4 min-h-[var(--tap)] sm:min-h-0 sm:py-2 text-[13px] font-medium text-fg-muted transition-colors hover:text-fg hover:bg-fg/[0.04] w-full sm:w-auto justify-center"
          >
            <Shuffle size={15} />
            {t('random')}
          </button>
          <Link
            to="/interview/exam"
            className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/[0.06] px-4 min-h-[var(--tap)] sm:min-h-0 sm:py-2 text-[13px] font-medium text-accent transition-colors hover:bg-accent/10 w-full sm:w-auto justify-center"
          >
            <GraduationCap size={15} />
            {t('examLink')}
          </Link>
        </div>
      </header>

      <Surface variant="chrome" className="p-3 sm:p-4">
        <div className="space-y-3">
          <label className="relative block">
            <Search
              size={16}
              aria-hidden
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle"
            />
            <input
              type="search"
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchPlaceholder')}
              className="form-input pl-10"
            />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <Field label={t('filterTopic')}>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="form-input"
              >
                <option value="all">{t('allTopics')}</option>
                {interviewCategories.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.label} ({item.count})
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('filterStage')}>
              <select
                value={stage}
                onChange={(event) => setStage(event.target.value)}
                className="form-input"
              >
                <option value="all">{t('allStages')}</option>
                {interviewStages.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.label} ({item.count})
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('filterStatus')}>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as StatusFilter)}
                className="form-input"
              >
                <option value="all">{t('statusAll')}</option>
                <option value="studied">{t('statusStudied')}</option>
                <option value="not-studied">{t('statusNotStudied')}</option>
              </select>
            </Field>
            <Field label={t('sortLabel')}>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                className="form-input"
              >
                <option value="default">{t('sortDefault')}</option>
                <option value="title">{t('sortTitle')}</option>
                <option value="topic">{t('sortTopic')}</option>
                <option value="stage">{t('sortStage')}</option>
              </select>
            </Field>
          </div>
        </div>
      </Surface>

      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow text-fg-subtle">
          {t('shownCount', { count: visible.length })}
        </span>
      </div>

      {visible.length === 0 ? (
        <Surface variant="inset">
          <p className="px-4 py-10 text-center text-sm text-fg-subtle italic">{t('empty')}</p>
        </Surface>
      ) : (
        <VirtualQuestionList
          questions={visible}
          studiedIds={studiedIds}
          titleOf={titleOf}
        />
      )}
    </div>
  );
};

const VirtualQuestionList = ({
  questions,
  studiedIds,
  titleOf,
}: {
  questions: InterviewQuestionMeta[];
  studiedIds: Set<number>;
  titleOf: (question: InterviewQuestionMeta) => string;
}) => {
  const listRef = useRef<HTMLDivElement>(null);
  const offsetRef = useRef(0);

  useLayoutEffect(() => {
    offsetRef.current = listRef.current?.offsetTop ?? 0;
  });

  const virtualizer = useWindowVirtualizer({
    count: questions.length,
    estimateSize: () => 116,
    overscan: 8,
    gap: 10,
    scrollMargin: offsetRef.current,
  });

  return (
    <div ref={listRef} className="relative" style={{ height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((item) => {
        const question = questions[item.index];
        if (!question) return null;
        return (
          <div
            key={question.id}
            data-index={item.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)`,
            }}
          >
            <QuestionCard
              question={question}
              title={titleOf(question)}
              studied={studiedIds.has(question.id)}
            />
          </div>
        );
      })}
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="eyebrow text-[10px] text-fg-subtle mb-1 block">{label}</span>
    {children}
  </label>
);

const QuestionCard = memo(function QuestionCard({
  question,
  title,
  studied,
}: {
  question: InterviewQuestionMeta;
  title: string;
  studied: boolean;
}) {
  return (
  <Link to="/interview/$id" params={{ id: String(question.id) }} className="block">
    <Surface
      interactive
      className={cx('p-4 sm:p-5', studied && 'border-l-2 border-l-ok')}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2.5">
          <h2 className="font-display text-[17px] sm:text-[18px] leading-snug tracking-snug text-fg text-balance">
            {title}
          </h2>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral">{question.categoryLabel}</Badge>
            <Badge tone={stageTone[question.stage]} variant="outline">
              {question.stageLabel}
            </Badge>
          </div>
        </div>
        {studied && (
          <CheckCircle2 size={18} className="shrink-0 text-ok" aria-label="studied" />
        )}
      </div>
    </Surface>
  </Link>
  );
});
