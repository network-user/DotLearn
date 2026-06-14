import { useCallback, useEffect, useMemo, useState } from 'react';

import type { TopicManifest } from '@dotlearn/contracts';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  CalendarCheck,
  Code2,
  Database,
  FileText,
  FlaskConical,
  History,
  Layers,
  NotebookPen,
  RotateCcw,
  Search,
  Sparkles,
  Waypoints,
  X,
} from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';

import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { DualProgressRing } from '@/components/ui/DualProgressRing';
import { Surface } from '@/components/ui/Surface';
import { Skeleton } from '@/components/ui/Skeleton';
import { getCurrentLanguage } from '@/lib/i18n';
import { computeMastery, countReadConcepts, useReadConceptsByTopic } from '@/lib/mastery';
import { db } from '@/lib/progress-db';
import { effectiveLanguage, listManifests, prefetchTopic } from '@/lib/topics';
import { useConceptBookmarked, useConceptNote, useLastPlace } from '@/lib/use-learning';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import topicStats from 'virtual:topic-stats';

interface TopicRow {
  manifest: TopicManifest;
  total: number;
  passed: number;
  readConcepts: number;
}

type DifficultyFilter = 'all' | 'beginner' | 'intermediate' | 'advanced';
type StatusFilter = 'all' | 'not-started' | 'in-progress' | 'mastered';

const STATUS_FILTERS: StatusFilter[] = ['all', 'not-started', 'in-progress', 'mastered'];
const STATUS_LABEL_KEY: Record<StatusFilter, string> = {
  all: 'status.all',
  'not-started': 'status.notStarted',
  'in-progress': 'status.inProgress',
  mastered: 'status.mastered',
};

const RUNTIME_LABEL_KEY: Record<string, string> = {
  'sql.js': 'runtimeLabel.sql',
  pyodide: 'runtimeLabel.python',
  javascript: 'runtimeLabel.javascript',
  none: 'runtimeLabel.none',
};

const DIFFICULTY_TONE: Record<string, 'success' | 'warning' | 'danger'> = {
  beginner: 'success',
  intermediate: 'warning',
  advanced: 'danger',
};

const runtimeIcon = (runtime: string) => {
  if (runtime === 'sql.js') return <Database size={14} />;
  if (runtime === 'pyodide') return <FlaskConical size={14} />;
  if (runtime === 'javascript') return <Code2 size={14} />;
  return <FileText size={14} />;
};

const statusOfRow = (row: TopicRow): StatusFilter => {
  const m = computeMastery(row.readConcepts, row.manifest.concepts.length, row.passed, row.total);
  if (m.mastery >= 0.999) return 'mastered';
  if (row.passed === 0 && row.readConcepts === 0 && m.mastery === 0) return 'not-started';
  return 'in-progress';
};

const toggleInArray = (values: string[], value: string): string[] =>
  values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];

const isDifficultyFilter = (value: string | undefined): value is DifficultyFilter =>
  value === 'beginner' || value === 'intermediate' || value === 'advanced';

const isStatusFilter = (value: string | undefined): value is StatusFilter =>
  value === 'not-started' || value === 'in-progress' || value === 'mastered';

export const HomePage = () => {
  const { t } = useTranslation('home');
  const { t: tCommon } = useTranslation('common');
  const [manifests, setManifests] = useState<TopicManifest[] | undefined>(undefined);
  const progressRecords = useLiveQuery(() => db.progress.toArray(), [], []);
  const readByTopic = useReadConceptsByTopic();

  const search = useSearch({ from: '/' });
  const navigate = useNavigate();

  const difficulty: DifficultyFilter = isDifficultyFilter(search.difficulty)
    ? search.difficulty
    : 'all';
  const status: StatusFilter = isStatusFilter(search.status) ? search.status : 'all';
  const runtimeFilter = useMemo(() => search.runtime ?? [], [search.runtime]);
  const tagFilter = useMemo(() => search.tags ?? [], [search.tags]);
  const query = search.q ?? '';

  const [queryInput, setQueryInput] = useState(query);
  const debouncedQuery = useDebouncedValue(queryInput, 300);

  const patch = useCallback(
    (next: Partial<HomeSearchPatch>): void => {
      void navigate({
        to: '/',
        search: (prev) => ({ ...prev, ...next }),
        replace: true,
      });
    },
    [navigate],
  );

  useEffect(() => {
    if ((debouncedQuery || undefined) !== (query || undefined)) {
      patch({ q: debouncedQuery || undefined });
    }
  }, [debouncedQuery, query, patch]);

  useEffect(() => {
    setQueryInput(query);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    listManifests().then((loaded) => {
      if (!cancelled) {
        setManifests(loaded);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const language = getCurrentLanguage();

  const rows = useMemo<TopicRow[]>(() => {
    if (!manifests) return [];
    const passedByTopic = new Map<string, number>();
    for (const record of progressRecords ?? []) {
      if (record.status === 'pass') {
        passedByTopic.set(record.topicSlug, (passedByTopic.get(record.topicSlug) ?? 0) + 1);
      }
    }
    return manifests.map((manifest) => ({
      manifest,
      total: topicStats[manifest.slug]?.[effectiveLanguage(manifest, language)] ?? 0,
      passed: passedByTopic.get(manifest.slug) ?? 0,
      readConcepts: countReadConcepts(manifest.concepts, readByTopic.get(manifest.slug)),
    }));
  }, [manifests, progressRecords, readByTopic, language]);

  const availableRuntimes = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const row of rows) {
      if (!seen.has(row.manifest.runtime)) {
        seen.add(row.manifest.runtime);
        ordered.push(row.manifest.runtime);
      }
    }
    return ordered;
  }, [rows]);

  const availableTags = useMemo(() => {
    const seen = new Set<string>();
    for (const row of rows) {
      for (const tag of row.manifest.tags) {
        seen.add(tag);
      }
    }
    return [...seen].sort((a, b) => a.localeCompare(b, language));
  }, [rows, language]);

  const filteredRows = useMemo(() => {
    const needle = debouncedQuery.trim().toLowerCase();
    return rows.filter((row) => {
      const { manifest } = row;
      if (difficulty !== 'all' && manifest.difficulty !== difficulty) return false;
      if (runtimeFilter.length > 0 && !runtimeFilter.includes(manifest.runtime)) return false;
      if (tagFilter.length > 0 && !tagFilter.every((tag) => manifest.tags.includes(tag)))
        return false;
      if (status !== 'all' && statusOfRow(row) !== status) return false;
      if (needle) {
        const haystack = [manifest.title, ...manifest.tags].join(' ').toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, difficulty, runtimeFilter, tagFilter, status, debouncedQuery]);

  const totalConcepts = rows.reduce((sum, row) => sum + row.manifest.concepts.length, 0);
  const runtimes = new Set(rows.map((row) => row.manifest.runtime));

  const filtersActive =
    queryInput.trim().length > 0 ||
    difficulty !== 'all' ||
    status !== 'all' ||
    runtimeFilter.length > 0 ||
    tagFilter.length > 0;

  const resetFilters = useCallback((): void => {
    setQueryInput('');
    patch({
      q: undefined,
      difficulty: undefined,
      status: undefined,
      runtime: undefined,
      tags: undefined,
    });
  }, [patch]);

  const toggleRuntime = (value: string): void => {
    const next = toggleInArray(runtimeFilter, value);
    patch({ runtime: next.length > 0 ? next : undefined });
  };

  const toggleTag = (value: string): void => {
    const next = toggleInArray(tagFilter, value);
    patch({ tags: next.length > 0 ? next : undefined });
  };

  return (
    <div className="space-y-14">
      <Hero stats={{ topics: rows.length, concepts: totalConcepts, runtimes: runtimes.size }} />

      <ContinueCard rows={rows} />

      <TodayCard />

      <section className="space-y-5" id="topics">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tightish">{t('topicsHeading')}</h2>
            <p className="mt-1 text-sm text-fg-muted">
              {manifests === undefined
                ? tCommon('loading')
                : t('available', { count: filteredRows.length })}
            </p>
          </div>
          <FilterBar
            value={difficulty}
            onChange={(value) => patch({ difficulty: value === 'all' ? undefined : value })}
          />
        </div>

        <CatalogToolbar
          queryInput={queryInput}
          onQueryChange={setQueryInput}
          status={status}
          onStatusChange={(value) => patch({ status: value === 'all' ? undefined : value })}
          availableRuntimes={availableRuntimes}
          runtimeFilter={runtimeFilter}
          onToggleRuntime={toggleRuntime}
          availableTags={availableTags}
          tagFilter={tagFilter}
          onToggleTag={toggleTag}
          filtersActive={filtersActive}
          onReset={resetFilters}
        />

        {manifests === undefined ? (
          <SkeletonGrid />
        ) : rows.length === 0 ? (
          <EmptyState />
        ) : filteredRows.length === 0 ? (
          <NoMatchesState onReset={resetFilters} />
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger">
            {filteredRows.map((row) => (
              <li key={row.manifest.slug}>
                <TopicCard row={row} activeTags={tagFilter} onToggleTag={toggleTag} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

interface HomeSearchPatch {
  q?: string | undefined;
  difficulty?: string | undefined;
  runtime?: string[] | undefined;
  tags?: string[] | undefined;
  status?: string | undefined;
}

const ContinueCard = ({ rows }: { rows: TopicRow[] }) => {
  const { t } = useTranslation('home');
  const place = useLastPlace();
  const bookmarked = useConceptBookmarked(place?.topicSlug ?? '', place?.conceptId);
  const note = useConceptNote(place?.topicSlug ?? '', place?.conceptId);
  if (!place) return null;
  const row = rows.find((entry) => entry.manifest.slug === place.topicSlug);
  if (!row) return null;
  const hasNote = note !== undefined && note.text.trim().length > 0;
  const conceptIndex = row.manifest.concepts.findIndex((concept) => concept.id === place.conceptId);
  const concept = conceptIndex >= 0 ? row.manifest.concepts[conceptIndex] : undefined;
  const m = computeMastery(row.readConcepts, row.manifest.concepts.length, row.passed, row.total);
  return (
    <Link
      to="/topics/$slug"
      params={{ slug: row.manifest.slug }}
      search={{ concept: place.conceptId, resume: true }}
      onMouseEnter={() => prefetchTopic(row.manifest.slug)}
      onFocus={() => prefetchTopic(row.manifest.slug)}
      className="group block"
    >
      <Surface interactive rule="left" className="border-l-accent">
        <div className="p-5 flex items-center gap-4">
          <DualProgressRing
            reading={m.readingRatio}
            solving={m.solvingRatio}
            size={52}
            stroke={4}
            gap={2}
            label={
              <span className="tabular-nums text-[12px]">
                {Math.round(m.mastery * 100)}
                <span className="text-[8px] text-fg-subtle">%</span>
              </span>
            }
            ariaLabel={`${Math.round(m.mastery * 100)}%`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 eyebrow text-[10px] text-accent">
              <History size={11} />
              {t('continue.eyebrow')}
            </div>
            <h3 className="mt-1 font-display text-xl leading-tight tracking-tightish text-fg truncate">
              {row.manifest.title}
            </h3>
            <div className="mt-0.5 flex items-center gap-2.5 min-w-0">
              {concept && (
                <p className="text-[13px] text-fg-muted truncate">
                  {t('continue.concept', { n: conceptIndex + 1, title: concept.title })}
                </p>
              )}
              {(bookmarked || hasNote) && (
                <span className="flex items-center gap-1.5 shrink-0 text-accent">
                  {bookmarked && <Bookmark size={13} />}
                  {hasNote && <NotebookPen size={13} />}
                </span>
              )}
            </div>
          </div>
          <span className="shrink-0 inline-flex items-center gap-1.5 text-accent text-sm font-medium">
            <span className="hidden sm:inline">{t('continue.cta')}</span>
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </Surface>
    </Link>
  );
};

const TodayCard = () => {
  const { t } = useTranslation('home');
  const nowIso = useMemo(() => new Date().toISOString(), []);
  const failedCount = useLiveQuery(() => db.progress.where('status').equals('fail').count(), [], 0);
  const dueCount = useLiveQuery(
    () => db.flashcardReviews.where('due').below(nowIso).count(),
    [nowIso],
    0,
  );
  if (failedCount === 0 && dueCount === 0) return null;
  return (
    <Link to="/today" className="group block">
      <Surface interactive rule="left" className="border-l-accent">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent/[0.08] text-accent">
            <CalendarCheck size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 eyebrow text-[10px] text-accent">
              {t('today.eyebrow')}
            </div>
            <h3 className="mt-1 font-display text-xl leading-tight tracking-tightish text-fg">
              {t('today.title')}
            </h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {dueCount > 0 && (
                <Badge tone="warning" variant="soft">
                  <span className="inline-flex items-center gap-1.5">
                    <RotateCcw size={12} />
                    {t('today.due', { count: dueCount })}
                  </span>
                </Badge>
              )}
              {failedCount > 0 && (
                <Badge tone="danger" variant="soft">
                  {t('today.mistakes', { count: failedCount })}
                </Badge>
              )}
            </div>
          </div>
          <span className="shrink-0 inline-flex items-center gap-1.5 text-accent text-sm font-medium">
            <span className="hidden sm:inline">{t('today.cta')}</span>
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </Surface>
    </Link>
  );
};

interface HeroStats {
  topics: number;
  concepts: number;
  runtimes: number;
}

const heroRise = (reduceMotion: boolean, delay: number) =>
  reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 14 },
        animate: { opacity: 1, y: 0 },
        transition: { delay, duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
      };

const Hero = ({ stats }: { stats: HeroStats }) => {
  const { t } = useTranslation('home');
  const { t: tCards } = useTranslation('flashcards');
  const reduceMotion = useReducedMotion() ?? false;
  const scrollToTopics = (): void => {
    const el = document.querySelector('#topics');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <section className="relative pt-2">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-6 items-stretch">
        <div className="space-y-6">
          <motion.div
            {...heroRise(reduceMotion, 0)}
            className="inline-flex items-center gap-2 eyebrow border-b-2 border-fg/80 pb-1.5"
          >
            <Sparkles size={12} className="text-accent" />
            <span>{t('eyebrow')}</span>
          </motion.div>
          <h1 className="font-display text-[clamp(40px,7vw,72px)] leading-[1.02] tracking-display text-balance">
            <motion.span {...heroRise(reduceMotion, 0.08)} className="block">
              {t('heroLineA')}
            </motion.span>
            <motion.span {...heroRise(reduceMotion, 0.18)} className="block text-accent italic">
              {t('heroLineB')}
            </motion.span>
          </h1>
          <motion.p
            {...heroRise(reduceMotion, 0.28)}
            className="max-w-prose text-[15px] leading-relaxed text-fg-muted text-balance"
          >
            {t('heroSub')}
          </motion.p>
          <motion.div
            {...heroRise(reduceMotion, 0.36)}
            className="flex flex-wrap items-center gap-2 pt-1"
          >
            <Button
              variant="primary"
              size="lg"
              trailingIcon={<ArrowRight size={16} />}
              onClick={scrollToTopics}
            >
              {t('cta.explore')}
            </Button>
            <Link to="/submit">
              <Button variant="outline" size="lg" trailingIcon={<ArrowUpRight size={16} />}>
                {t('cta.submit')}
              </Button>
            </Link>
            <Link to="/flashcards">
              <Button variant="ghost" size="lg" leadingIcon={<Layers size={16} />}>
                {tCards('title')}
              </Button>
            </Link>
            <Link to="/map">
              <Button variant="ghost" size="lg" leadingIcon={<Waypoints size={16} />}>
                {t('mapCta')}
              </Button>
            </Link>
          </motion.div>
        </div>

        <motion.div {...heroRise(reduceMotion, 0.22)} className="h-full">
          <HeroSidePanel stats={stats} />
        </motion.div>
      </div>
    </section>
  );
};

const HeroSidePanel = ({ stats }: { stats: HeroStats }) => {
  const { t } = useTranslation('home');
  return (
    <Surface variant="inset" rule="top" className="relative overflow-hidden h-full">
      <div className="p-6 flex flex-col h-full justify-between gap-6 min-h-[260px]">
        <p className="text-[13px] leading-relaxed text-fg-muted">
          <Trans
            i18nKey="home:intro"
            components={{ code: <code className="font-mono text-accent" /> }}
          />
        </p>
        <dl className="grid grid-cols-3 gap-3">
          <Stat value={stats.topics} label={t('stats.topics')} />
          <Stat value={stats.concepts} label={t('stats.concepts')} />
          <Stat value={stats.runtimes} label={t('stats.runtimes')} />
        </dl>
      </div>
    </Surface>
  );
};

const Stat = ({ value, label }: { value: number; label: string }) => (
  <div>
    <div className="font-display text-3xl leading-none text-fg tabular-nums">
      <AnimatedNumber value={value} />
    </div>
    <div className="mt-1 text-[10px] uppercase tracking-widest text-fg-subtle">{label}</div>
  </div>
);

const FilterBar = ({
  value,
  onChange,
}: {
  value: DifficultyFilter;
  onChange: (v: DifficultyFilter) => void;
}) => {
  const { t } = useTranslation('home');
  const options: DifficultyFilter[] = ['all', 'beginner', 'intermediate', 'advanced'];
  return (
    <div className="inline-flex items-center gap-4 border-b border-border-base">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={cx(
            '-mb-px h-9 px-1 border-b-2 text-[12px] tracking-snug transition-colors duration-fast',
            value === option
              ? 'border-accent text-fg font-medium'
              : 'border-transparent text-fg-muted hover:text-fg',
          )}
        >
          {t(`filters.${option}` as const)}
        </button>
      ))}
    </div>
  );
};

interface CatalogToolbarProps {
  queryInput: string;
  onQueryChange: (value: string) => void;
  status: StatusFilter;
  onStatusChange: (value: StatusFilter) => void;
  availableRuntimes: string[];
  runtimeFilter: string[];
  onToggleRuntime: (value: string) => void;
  availableTags: string[];
  tagFilter: string[];
  onToggleTag: (value: string) => void;
  filtersActive: boolean;
  onReset: () => void;
}

const CatalogToolbar = ({
  queryInput,
  onQueryChange,
  status,
  onStatusChange,
  availableRuntimes,
  runtimeFilter,
  onToggleRuntime,
  availableTags,
  tagFilter,
  onToggleTag,
  filtersActive,
  onReset,
}: CatalogToolbarProps) => {
  const { t } = useTranslation('home');
  return (
    <Surface variant="chrome" className="p-3 sm:p-4">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative block flex-1">
            <Search
              size={16}
              aria-hidden
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle"
            />
            <input
              type="search"
              value={queryInput}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchPlaceholder')}
              className="form-input pl-10"
            />
          </label>
          {filtersActive && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border-base px-4 min-h-[var(--tap)] sm:min-h-0 sm:py-2 text-[13px] font-medium text-fg-muted transition-colors hover:text-fg hover:bg-fg/[0.04] w-full sm:w-auto shrink-0"
            >
              <X size={14} />
              {t('reset')}
            </button>
          )}
        </div>

        <FacetGroup label={t('facets.status')}>
          {STATUS_FILTERS.map((option) => (
            <Chip key={option} active={status === option} onClick={() => onStatusChange(option)}>
              {t(STATUS_LABEL_KEY[option])}
            </Chip>
          ))}
        </FacetGroup>

        {availableRuntimes.length > 0 && (
          <FacetGroup label={t('facets.runtime')}>
            {availableRuntimes.map((runtime) => (
              <Chip
                key={runtime}
                active={runtimeFilter.includes(runtime)}
                onClick={() => onToggleRuntime(runtime)}
                icon={runtimeIcon(runtime)}
              >
                {t(RUNTIME_LABEL_KEY[runtime] ?? `card.tagline.${runtime}`)}
              </Chip>
            ))}
          </FacetGroup>
        )}

        {availableTags.length > 0 && (
          <FacetGroup label={t('facets.tags')}>
            {availableTags.map((tag) => (
              <Chip key={tag} active={tagFilter.includes(tag)} onClick={() => onToggleTag(tag)}>
                {tag}
              </Chip>
            ))}
          </FacetGroup>
        )}
      </div>
    </Surface>
  );
};

const FacetGroup = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
    <span className="eyebrow text-[10px] text-fg-subtle sm:pt-2 sm:w-20 sm:shrink-0">{label}</span>
    <div className="flex flex-wrap gap-1.5">{children}</div>
  </div>
);

const Chip = ({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={cx(
      'inline-flex items-center gap-1.5 rounded-full border px-3 min-h-[var(--tap)] sm:min-h-0 sm:py-1.5 text-[12px] tracking-snug transition-colors duration-fast',
      active
        ? 'border-accent/50 bg-accent/[0.08] text-accent font-medium'
        : 'border-border-base text-fg-muted hover:text-fg hover:bg-fg/[0.04]',
    )}
  >
    {icon}
    {children}
  </button>
);

interface TopicCardProps {
  row: TopicRow;
  activeTags: string[];
  onToggleTag: (tag: string) => void;
}

const TopicCard = ({ row, activeTags, onToggleTag }: TopicCardProps) => {
  const { t } = useTranslation('home');
  const { manifest, total, passed, readConcepts } = row;
  const totalConcepts = manifest.concepts.length;
  const m = computeMastery(readConcepts, totalConcepts, passed, total);
  const masteryPercent = Math.round(m.mastery * 100);
  const totalMinutes = manifest.concepts.reduce((sum, c) => sum + c.estimatedMinutes, 0);
  const availableLanguages = getAvailableLanguages(manifest);
  const taglineKey = `card.tagline.${manifest.runtime}` as const;
  return (
    <Link
      to="/topics/$slug"
      params={{ slug: manifest.slug }}
      className="group relative z-0 block h-full hover:z-20"
      onMouseEnter={() => prefetchTopic(manifest.slug)}
      onFocus={() => prefetchTopic(manifest.slug)}
      onTouchStart={() => prefetchTopic(manifest.slug)}
    >
      <Surface
        interactive
        className="h-full origin-center group-hover:scale-[1.03] group-focus-visible:scale-[1.03]"
      >
        <div className="p-5 h-full flex flex-col gap-4 min-h-[200px]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-fg-subtle">
                {runtimeIcon(manifest.runtime)}
                <span>{t(taglineKey)}</span>
              </div>
              <h3
                title={manifest.title}
                className="mt-2 font-display text-2xl leading-tight tracking-tightish text-fg truncate group-hover:whitespace-normal group-hover:overflow-visible group-focus-visible:whitespace-normal"
              >
                {manifest.title}
              </h3>
            </div>
            <DualProgressRing
              reading={m.readingRatio}
              solving={m.solvingRatio}
              size={48}
              stroke={4}
              gap={2}
              label={
                <span className="tabular-nums">
                  {masteryPercent}
                  <span className="text-[8px] text-fg-subtle">%</span>
                </span>
              }
              ariaLabel={t('card.masteryAria', { percent: masteryPercent })}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <Stat3
              label={t('card.readStat')}
              value={readConcepts}
              formatter={() => `${readConcepts}/${totalConcepts}`}
            />
            <Stat3
              label={t('card.testsStat')}
              value={total}
              formatter={() => `${passed}/${total}`}
            />
            <Stat3
              label="min"
              value={totalMinutes}
              formatter={(v) => t('card.minutes', { count: v })}
            />
          </div>

          {manifest.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {manifest.tags.map((tag) => {
                const active = activeTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={active}
                    aria-label={t('card.tagFilter', { tag })}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onToggleTag(tag);
                    }}
                    className={cx(
                      'rounded-full border px-2 py-0.5 text-[11px] tracking-snug transition-colors duration-fast',
                      active
                        ? 'border-accent/50 bg-accent/[0.08] text-accent font-medium'
                        : 'border-border-base text-fg-subtle hover:text-fg hover:border-border-strong',
                    )}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-auto pt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge tone={DIFFICULTY_TONE[manifest.difficulty] ?? 'neutral'} variant="soft">
                {manifest.difficulty}
              </Badge>
              {availableLanguages.map((lang) => (
                <Badge key={lang} tone="neutral" variant="outline">
                  {t(`languageBadge.${lang}`)}
                </Badge>
              ))}
            </div>
            <span className="opacity-0 -translate-x-1 transition-all duration-fast group-hover:opacity-100 group-hover:translate-x-0">
              <ArrowRight size={16} className="text-accent" />
            </span>
          </div>
        </div>
      </Surface>
    </Link>
  );
};

const Stat3 = ({
  label,
  value,
  formatter,
}: {
  label: string;
  value: number;
  formatter?: (v: number) => string;
}) => (
  <div className="border-t border-border-strong px-0.5 pt-1.5 min-w-0">
    <div className="text-[10px] uppercase tracking-widest text-fg-subtle">{label}</div>
    <div className="text-[13px] font-medium tabular-nums text-fg">
      {formatter ? formatter(value) : value}
    </div>
  </div>
);

const SkeletonGrid = () => (
  <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" aria-hidden>
    {[0, 1, 2].map((index) => (
      <li key={index}>
        <Skeleton rounded="2xl" className="h-48" />
      </li>
    ))}
  </ul>
);

const EmptyState = () => {
  const { t } = useTranslation('home');
  return (
    <Surface variant="inset">
      <div className="p-8 text-center">
        <h3 className="font-display text-2xl text-fg">{t('empty.title')}</h3>
        <p className="mt-2 text-sm text-fg-muted">
          <Trans
            i18nKey="home:empty.hint"
            components={{ hint: <span className="text-accent" /> }}
          />
        </p>
      </div>
    </Surface>
  );
};

const NoMatchesState = ({ onReset }: { onReset: () => void }) => {
  const { t } = useTranslation('home');
  return (
    <Surface variant="inset">
      <div className="p-8 text-center">
        <h3 className="font-display text-2xl text-fg">{t('noMatches.title')}</h3>
        <p className="mt-2 text-sm text-fg-muted">{t('noMatches.hint')}</p>
        <div className="mt-5 flex justify-center">
          <Button variant="outline" size="sm" leadingIcon={<X size={14} />} onClick={onReset}>
            {t('reset')}
          </Button>
        </div>
      </div>
    </Surface>
  );
};

const getAvailableLanguages = (manifest: TopicManifest): readonly ('ru' | 'en')[] =>
  manifest.availableLanguages;
