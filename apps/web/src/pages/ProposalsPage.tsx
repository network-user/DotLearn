import { useEffect, useMemo, useRef, useState } from 'react';

import type {
  SubmissionPublic,
  SubmissionStatus,
  SubmissionSuggestion,
  TopicDifficulty,
  TopicRuntime,
} from '@dotlearn/contracts';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { SubmissionStatusBadge } from '@/components/SubmissionStatusBadge';
import { cx } from '@/components/ui/cx';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  ApiError,
  listPublicSubmissions,
  searchPublicSubmissions,
  suggestSubmissions,
} from '@/lib/api-client';

type ViewState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; submissions: SubmissionPublic[] };

type StatusFilter = SubmissionStatus | 'all';

const STATUS_OPTIONS: StatusFilter[] = [
  'all',
  'pending',
  'approved',
  'materialized',
  'rejected',
];

const RUNTIMES: TopicRuntime[] = ['none', 'sql.js', 'pyodide', 'javascript'];
const DIFFICULTIES: TopicDifficulty[] = ['beginner', 'intermediate', 'advanced'];

const SEARCH_DEBOUNCE_MS = 250;

export const ProposalsPage = () => {
  const { t } = useTranslation('proposals');
  const { t: tCommon } = useTranslation('common');

  const [rawQuery, setRawQuery] = useState('');
  const debouncedQuery = useDebouncedValue(rawQuery.trim(), SEARCH_DEBOUNCE_MS);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [runtime, setRuntime] = useState<TopicRuntime | 'all'>('all');
  const [difficulty, setDifficulty] = useState<TopicDifficulty | 'all'>('all');

  const [state, setState] = useState<ViewState>({ kind: 'loading' });
  const [suggestions, setSuggestions] = useState<SubmissionSuggestion[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (event.target instanceof Node && containerRef.current.contains(event.target)) return;
      setSuggestOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setState({ kind: 'loading' });
      try {
        const submissions = debouncedQuery
          ? await searchPublicSubmissions(debouncedQuery, 50)
          : await listPublicSubmissions();
        if (!cancelled) {
          setState({ kind: 'ready', submissions });
        }
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof ApiError
            ? t('errors.api', { status: error.status })
            : t('errors.network');
        setState({ kind: 'error', message });
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, t]);

  useEffect(() => {
    let cancelled = false;
    if (!debouncedQuery || debouncedQuery.length < 2) {
      setSuggestions([]);
      return;
    }
    void suggestSubmissions(debouncedQuery, 6)
      .then((items) => {
        if (!cancelled) setSuggestions(items);
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const filtered = useMemo(() => {
    if (state.kind !== 'ready') return [];
    return state.submissions.filter((submission) => {
      if (status !== 'all' && submission.status !== status) return false;
      if (runtime !== 'all' && submission.payload.suggestedRuntime !== runtime) return false;
      if (difficulty !== 'all' && submission.payload.suggestedDifficulty !== difficulty) {
        return false;
      }
      return true;
    });
  }, [state, status, runtime, difficulty]);

  const showSuggestPanel = suggestOpen && suggestions.length > 0;

  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-3 text-fg-muted max-w-2xl">{t('subtitle')}</p>
      </section>

      <section className="space-y-4">
        <div ref={containerRef} className="relative max-w-2xl">
          <input
            type="search"
            value={rawQuery}
            onChange={(event) => {
              setRawQuery(event.target.value);
              setSuggestOpen(true);
            }}
            onFocus={() => setSuggestOpen(true)}
            placeholder={t('searchPlaceholder')}
            className="w-full rounded-xl border border-border-base bg-surface/70 px-4 py-3 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:border-indigo-500/60 focus:ring-2 focus:ring-indigo-500/20 transition"
            aria-autocomplete="list"
            aria-controls="proposal-suggestions"
          />
          {rawQuery && (
            <button
              type="button"
              onClick={() => setRawQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg text-xs"
              aria-label={tCommon('cancel')}
            >
              ×
            </button>
          )}
          {showSuggestPanel && (
            <ul
              id="proposal-suggestions"
              className="absolute z-20 left-0 right-0 mt-2 rounded-xl border border-border-base bg-surface/95 backdrop-blur-soft shadow-card overflow-hidden"
            >
              {suggestions.map((suggestion) => (
                <li key={suggestion.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setRawQuery(suggestion.title);
                      setSuggestOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-fg hover:bg-surface-2 transition"
                  >
                    {suggestion.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <FilterRow label={t('filters.statusLabel')}>
          {STATUS_OPTIONS.map((option) => (
            <FilterChip
              key={option}
              active={status === option}
              onClick={() => setStatus(option)}
              label={t(option === 'all' ? 'filters.all' : `status.${option}`)}
            />
          ))}
        </FilterRow>

        <FilterRow label={t('filters.runtimeLabel')}>
          <FilterChip
            active={runtime === 'all'}
            onClick={() => setRuntime('all')}
            label={t('filters.all')}
          />
          {RUNTIMES.map((option) => (
            <FilterChip
              key={option}
              active={runtime === option}
              onClick={() => setRuntime(option)}
              label={option}
            />
          ))}
        </FilterRow>

        <FilterRow label={t('filters.difficultyLabel')}>
          <FilterChip
            active={difficulty === 'all'}
            onClick={() => setDifficulty('all')}
            label={t('filters.all')}
          />
          {DIFFICULTIES.map((option) => (
            <FilterChip
              key={option}
              active={difficulty === option}
              onClick={() => setDifficulty(option)}
              label={t(`difficulty.${option}`)}
            />
          ))}
        </FilterRow>
      </section>

      <section>
        {state.kind === 'loading' && <SkeletonList />}
        {state.kind === 'error' && <ErrorBox message={state.message} />}
        {state.kind === 'ready' && filtered.length === 0 && <EmptyState />}
        {state.kind === 'ready' && filtered.length > 0 && (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((submission) => (
              <li key={submission.id}>
                <ProposalCard submission={submission} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

interface FilterRowProps {
  label: string;
  children: React.ReactNode;
}

const FilterRow = ({ label, children }: FilterRowProps) => (
  <div className="flex flex-wrap items-center gap-2">
    <span className="text-[11px] uppercase tracking-wide text-fg-subtle mr-1">{label}</span>
    {children}
  </div>
);

interface FilterChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

const FilterChip = ({ label, active, onClick }: FilterChipProps) => (
  <button
    type="button"
    onClick={onClick}
    className={cx(
      'px-3 py-1 text-xs rounded-full border transition-colors',
      active
        ? 'border-indigo-500/60 bg-indigo-500/15 text-indigo-200'
        : 'border-border-base bg-surface/60 text-fg-muted hover:text-fg hover:border-border-strong',
    )}
  >
    {label}
  </button>
);

interface ProposalCardProps {
  submission: SubmissionPublic;
}

const ProposalCard = ({ submission }: ProposalCardProps) => {
  const { t } = useTranslation('proposals');
  const { payload, status, materializedSlug } = submission;
  const date = new Date(submission.createdAt);
  const targetSlug = materializedSlug;

  const inner = (
    <article className="h-full rounded-xl border border-border-base bg-surface/60 hover:border-indigo-500/40 hover:bg-surface transition p-5 flex flex-col gap-3">
      <header className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-fg leading-snug">{payload.title}</h3>
        <SubmissionStatusBadge status={status} />
      </header>
      <p className="text-sm text-fg-muted line-clamp-3 whitespace-pre-wrap">{payload.outline}</p>
      <footer className="mt-auto flex flex-wrap items-center gap-2 text-[11px] text-fg-subtle">
        <span>{date.toLocaleDateString()}</span>
        <span aria-hidden>·</span>
        <span>{payload.suggestedRuntime}</span>
        <span aria-hidden>·</span>
        <span>{t(`difficulty.${payload.suggestedDifficulty}`)}</span>
        <span aria-hidden>·</span>
        <span>~{payload.estimatedHours}h</span>
      </footer>
      {payload.tags.length > 0 && (
        <ul className="flex flex-wrap gap-1">
          {payload.tags.map((tag: string) => (
            <li
              key={tag}
              className="text-[10px] uppercase tracking-wide text-fg-muted bg-surface-2/80 px-1.5 py-0.5 rounded"
            >
              {tag}
            </li>
          ))}
        </ul>
      )}
      {status === 'materialized' && targetSlug && (
        <span className="text-xs text-emerald-300 inline-flex items-center gap-1 mt-1">
          {t('openTopic')} →
        </span>
      )}
    </article>
  );

  if (status === 'materialized' && targetSlug) {
    return (
      <Link to="/topics/$slug" params={{ slug: targetSlug }} className="block h-full">
        {inner}
      </Link>
    );
  }
  return <div className="h-full">{inner}</div>;
};

const SkeletonList = () => (
  <ul className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-hidden>
    {[0, 1, 2, 3].map((index) => (
      <li
        key={index}
        className="h-44 rounded-xl border border-border-base bg-surface/40 animate-pulse"
      />
    ))}
  </ul>
);

const EmptyState = () => {
  const { t } = useTranslation('proposals');
  return (
    <div className="rounded-xl border border-dashed border-border-base p-8 text-center text-sm text-fg-muted">
      {t('empty')}
    </div>
  );
};

const ErrorBox = ({ message }: { message: string }) => (
  <div className="rounded-xl border border-rose-900/40 bg-rose-950/30 p-5 text-sm text-rose-300">
    {message}
  </div>
);
