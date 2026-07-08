import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import type { TopicManifest } from '@dotlearn/contracts';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, m as motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  BookOpen,
  CalendarCheck,
  ChevronDown,
  Code2,
  Database,
  FileText,
  FlaskConical,
  GitBranch,
  History,
  Layers,
  NotebookPen,
  RotateCcw,
  Route as RouteIcon,
  Search,
  SlidersHorizontal,
  Sparkles,
  Waypoints,
  X,
} from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import type { SearchEntry } from 'virtual:search-index';

import { NextActionBanner } from '@/components/NextActionCard';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { DualProgressRing } from '@/components/ui/DualProgressRing';
import { EmptyState as EmptyStateCard } from '@/components/ui/EmptyState';
import { Surface } from '@/components/ui/Surface';
import {
  categoryLabelKey,
  groupByCatalogCategory,
  type CatalogCategoryId,
} from '@/lib/catalog-categories';
import { fuzzyScore } from '@/lib/fuzzy';
import { computeMastery, countReadConcepts, useReadConceptsByTopic } from '@/lib/mastery';
import { db } from '@/lib/progress-db';
import { effectiveLanguage, prefetchTopic, useContentLanguage } from '@/lib/topics';
import { tracks } from '@/lib/tracks';
import { useConceptBookmarked, useConceptNote, useLastPlace } from '@/lib/use-learning';
import { useVisibleManifests } from '@/lib/use-manifests';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useTrackAggregates } from '@/lib/use-tracks';
import type { HomeDuration, HomeSortKey } from '@/router';
import topicStats from 'virtual:topic-stats';

interface TopicRow {
  manifest: TopicManifest;
  total: number;
  passed: number;
  readConcepts: number;
  totalMinutes: number;
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

const SORT_KEYS: HomeSortKey[] = ['relevance', 'difficulty', 'shortest', 'in-progress'];
const SORT_LABEL_KEY: Record<HomeSortKey, string> = {
  relevance: 'sort.relevance',
  difficulty: 'sort.difficulty',
  shortest: 'sort.shortest',
  'in-progress': 'sort.inProgress',
};
const SORT_DEFAULT_LABEL: Record<HomeSortKey, string> = {
  relevance: 'По релевантности',
  difficulty: 'По сложности',
  shortest: 'Сначала короткие',
  'in-progress': 'Сначала начатые',
};

const DURATION_FILTERS: HomeDuration[] = ['short', 'medium', 'long'];
const DURATION_LABEL_KEY: Record<HomeDuration, string> = {
  short: 'duration.short',
  medium: 'duration.medium',
  long: 'duration.long',
};
const DURATION_DEFAULT_LABEL: Record<HomeDuration, string> = {
  short: 'До 30 мин',
  medium: '30-90 мин',
  long: 'Более 90 мин',
};

const DIFFICULTY_RANK: Record<string, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

const CONTENT_RESULTS_LIMIT = 6;
const CONCEPT_MATCHES_LIMIT = 3;

const durationOfMinutes = (minutes: number): HomeDuration => {
  if (minutes <= 30) return 'short';
  if (minutes <= 90) return 'medium';
  return 'long';
};

const RUNTIME_LABEL_KEY: Record<string, string> = {
  'sql.js': 'runtimeLabel.sql',
  pyodide: 'runtimeLabel.python',
  javascript: 'runtimeLabel.javascript',
  git: 'runtimeLabel.git',
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
  if (runtime === 'git') return <GitBranch size={14} />;
  return <FileText size={14} />;
};

const statusOfRow = (row: TopicRow): StatusFilter => {
  const m = computeMastery(row.readConcepts, row.manifest.concepts.length, row.passed, row.total);
  if (m.mastery >= 0.999) return 'mastered';
  if (row.passed === 0 && row.readConcepts === 0 && m.mastery === 0) return 'not-started';
  return 'in-progress';
};

const statusRank = (row: TopicRow): number => {
  const status = statusOfRow(row);
  if (status === 'in-progress') return 2;
  if (status === 'mastered') return 1;
  return 0;
};

const effectiveSearchLanguage = (language: string): 'en' | 'ru' =>
  language === 'en' ? 'en' : 'ru';

interface ContentHit {
  slug: string;
  conceptId: string;
  conceptTitle: string;
  score: number;
}

const useContentSearchIndex = (enabled: boolean, language: 'en' | 'ru'): SearchEntry[] => {
  const [entries, setEntries] = useState<SearchEntry[]>([]);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const loadIndex =
      language === 'en' ? import('virtual:search-index/en') : import('virtual:search-index/ru');
    void loadIndex.then((module) => {
      if (cancelled) return;
      try {
        setEntries(JSON.parse(module.default) as SearchEntry[]);
      } catch {
        setEntries([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, language]);
  return entries;
};

const toggleInArray = (values: string[], value: string): string[] =>
  values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];

const isDifficultyFilter = (value: string | undefined): value is DifficultyFilter =>
  value === 'beginner' || value === 'intermediate' || value === 'advanced';

const isStatusFilter = (value: string | undefined): value is StatusFilter =>
  value === 'not-started' || value === 'in-progress' || value === 'mastered';

export const HomePage = () => {
  const { t } = useTranslation('home');
  const manifests = useVisibleManifests();
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
  const duration = search.duration;
  const query = search.q ?? '';

  const [queryInput, setQueryInput] = useState(query);
  const debouncedQuery = useDebouncedValue(queryInput, 300);

  const trimmedQuery = debouncedQuery.trim();
  const hasQuery = trimmedQuery.length > 0;
  const sort: HomeSortKey = search.sort ?? (hasQuery ? 'relevance' : 'difficulty');

  const language = useContentLanguage();
  const contentEntries = useContentSearchIndex(hasQuery, effectiveSearchLanguage(language));

  const patch = useCallback(
    (next: Partial<HomeSearchPatch>): void => {
      void navigate({
        to: '/',
        search: (prev) => ({ ...prev, ...next }),
        replace: true,
        resetScroll: false,
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

  const rows = useMemo<TopicRow[]>(() => {
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
      totalMinutes: manifest.concepts.reduce((sum, concept) => sum + concept.estimatedMinutes, 0),
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

  const contentBySlug = useMemo(() => {
    if (!hasQuery) return new Map<string, ContentHit[]>();
    const byConcept = new Map<string, ContentHit>();
    for (const entry of contentEntries) {
      const score = fuzzyScore(trimmedQuery, [
        { text: entry.conceptTitle, weight: 4 },
        { text: entry.text, weight: 1 },
      ]);
      if (score <= 0) continue;
      const key = `${entry.slug}:${entry.conceptId}`;
      const existing = byConcept.get(key);
      if (!existing || score > existing.score) {
        byConcept.set(key, {
          slug: entry.slug,
          conceptId: entry.conceptId,
          conceptTitle: entry.conceptTitle,
          score,
        });
      }
    }
    const grouped = new Map<string, ContentHit[]>();
    for (const hit of byConcept.values()) {
      const list = grouped.get(hit.slug) ?? [];
      list.push(hit);
      grouped.set(hit.slug, list);
    }
    for (const list of grouped.values()) {
      list.sort((a, b) => b.score - a.score);
    }
    return grouped;
  }, [hasQuery, contentEntries, trimmedQuery]);

  const scoredRows = useMemo(() => {
    return rows
      .filter((row) => {
        const { manifest } = row;
        if (difficulty !== 'all' && manifest.difficulty !== difficulty) return false;
        if (runtimeFilter.length > 0 && !runtimeFilter.includes(manifest.runtime)) return false;
        if (tagFilter.length > 0 && !tagFilter.every((tag) => manifest.tags.includes(tag)))
          return false;
        if (status !== 'all' && statusOfRow(row) !== status) return false;
        if (duration !== undefined && durationOfMinutes(row.totalMinutes) !== duration)
          return false;
        return true;
      })
      .map((row) => {
        const contentHits = contentBySlug.get(row.manifest.slug) ?? [];
        const metaScore = hasQuery
          ? fuzzyScore(trimmedQuery, [
              { text: row.manifest.title, weight: 6 },
              { text: row.manifest.tags.join(' '), weight: 3 },
            ])
          : 0;
        const contentScore = contentHits[0]?.score ?? 0;
        return { row, contentHits, score: metaScore + contentScore };
      })
      .filter((entry) => !hasQuery || entry.score > 0);
  }, [
    rows,
    difficulty,
    runtimeFilter,
    tagFilter,
    status,
    duration,
    hasQuery,
    trimmedQuery,
    contentBySlug,
  ]);

  const sortedRows = useMemo(() => {
    const entries = [...scoredRows];
    if (sort === 'relevance' && hasQuery) {
      entries.sort((a, b) => b.score - a.score);
    } else if (sort === 'shortest') {
      entries.sort((a, b) => a.row.totalMinutes - b.row.totalMinutes);
    } else if (sort === 'in-progress') {
      entries.sort((a, b) => statusRank(b.row) - statusRank(a.row));
    } else {
      entries.sort(
        (a, b) =>
          (DIFFICULTY_RANK[a.row.manifest.difficulty] ?? 99) -
          (DIFFICULTY_RANK[b.row.manifest.difficulty] ?? 99),
      );
    }
    return entries;
  }, [scoredRows, sort, hasQuery]);

  const filteredRows = useMemo(() => sortedRows.map((entry) => entry.row), [sortedRows]);

  const contentResults = useMemo(() => {
    if (!hasQuery) return [];
    const all: ContentHit[] = [];
    for (const list of contentBySlug.values()) {
      for (const hit of list) all.push(hit);
    }
    all.sort((a, b) => b.score - a.score);
    return all.slice(0, CONTENT_RESULTS_LIMIT);
  }, [hasQuery, contentBySlug]);

  const topicTitleBySlug = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) map.set(row.manifest.slug, row.manifest.title);
    return map;
  }, [rows]);

  const conceptMatchesByRow = useMemo(() => {
    const map = new Map<string, ContentHit[]>();
    for (const entry of sortedRows) {
      const hits = entry.contentHits;
      if (hits.length > 0) map.set(entry.row.manifest.slug, hits.slice(0, CONCEPT_MATCHES_LIMIT));
    }
    return map;
  }, [sortedRows]);

  const totalConcepts = rows.reduce((sum, row) => sum + row.manifest.concepts.length, 0);
  const runtimes = new Set(rows.map((row) => row.manifest.runtime));

  const filtersActive =
    queryInput.trim().length > 0 ||
    difficulty !== 'all' ||
    status !== 'all' ||
    runtimeFilter.length > 0 ||
    tagFilter.length > 0 ||
    duration !== undefined ||
    search.sort !== undefined;

  const categoryGroups = useMemo(
    () => (filtersActive ? [] : groupByCatalogCategory(filteredRows, (row) => row.manifest.slug)),
    [filtersActive, filteredRows],
  );

  const resetFilters = useCallback((): void => {
    setQueryInput('');
    patch({
      q: undefined,
      difficulty: undefined,
      status: undefined,
      runtime: undefined,
      tags: undefined,
      duration: undefined,
      sort: undefined,
    });
  }, [patch]);

  const setSort = useCallback(
    (value: HomeSortKey): void => {
      const fallback: HomeSortKey = hasQuery ? 'relevance' : 'difficulty';
      patch({ sort: value === fallback ? undefined : value });
    },
    [patch, hasQuery],
  );

  const setDuration = useCallback(
    (value: HomeDuration): void => {
      patch({ duration: duration === value ? undefined : value });
    },
    [patch, duration],
  );

  const toggleRuntime = (value: string): void => {
    const next = toggleInArray(runtimeFilter, value);
    patch({ runtime: next.length > 0 ? next : undefined });
  };

  const toggleTag = useCallback(
    (value: string): void => {
      const next = toggleInArray(tagFilter, value);
      patch({ tags: next.length > 0 ? next : undefined });
    },
    [tagFilter, patch],
  );

  return (
    <div className="space-y-14">
      <Hero stats={{ topics: rows.length, concepts: totalConcepts, runtimes: runtimes.size }} />

      <NextActionBanner />

      <ContinueCard rows={rows} />

      <TodayCard />

      <TracksBand />

      <section className="space-y-5" id="topics">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tightish">{t('topicsHeading')}</h2>
            <p className="mt-1 text-sm text-fg-muted">
              {t('available', { count: filteredRows.length })}
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
          duration={duration}
          onToggleDuration={setDuration}
          sort={sort}
          onSortChange={setSort}
          hasQuery={hasQuery}
          filtersActive={filtersActive}
          onReset={resetFilters}
        />

        {hasQuery && contentResults.length > 0 && (
          <ContentResultsSection results={contentResults} topicTitleBySlug={topicTitleBySlug} />
        )}

        {rows.length === 0 ? (
          <EmptyState />
        ) : filteredRows.length === 0 ? (
          <NoMatchesState onReset={resetFilters} />
        ) : filtersActive ? (
          <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger">
            {filteredRows.map((row) => (
              <li key={row.manifest.slug} className="relative z-0 hover:z-20 focus-within:z-20">
                <TopicCard
                  row={row}
                  activeTags={tagFilter}
                  onToggleTag={toggleTag}
                  conceptMatches={conceptMatchesByRow.get(row.manifest.slug)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-10">
            {categoryGroups.map((group) => (
              <CatalogCategorySection
                key={group.id}
                id={group.id}
                rows={group.items}
                activeTags={tagFilter}
                onToggleTag={toggleTag}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

interface CatalogCategorySectionProps {
  id: CatalogCategoryId;
  rows: TopicRow[];
  activeTags: string[];
  onToggleTag: (tag: string) => void;
}

const CATEGORY_PREVIEW_COUNT = 6;

const CatalogCategorySection = ({
  id,
  rows,
  activeTags,
  onToggleTag,
}: CatalogCategorySectionProps) => {
  const { t } = useTranslation('home');
  const [expanded, setExpanded] = useState(false);
  const headingId = `catalog-category-${id}`;
  const listId = `catalog-category-list-${id}`;
  const collapsible = rows.length > CATEGORY_PREVIEW_COUNT;
  const visibleRows = collapsible && !expanded ? rows.slice(0, CATEGORY_PREVIEW_COUNT) : rows;
  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <div className="flex items-baseline gap-2.5">
        <h2 id={headingId} className="text-lg font-semibold tracking-tightish text-fg">
          {t(categoryLabelKey(id))}
        </h2>
        <span className="text-[13px] tabular-nums text-fg-subtle">{rows.length}</span>
      </div>
      <ul id={listId} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger">
        {visibleRows.map((row) => (
          <li key={row.manifest.slug} className="relative z-0 hover:z-20 focus-within:z-20">
            <TopicCard row={row} activeTags={activeTags} onToggleTag={onToggleTag} />
          </li>
        ))}
      </ul>
      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          aria-controls={listId}
          className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border-base px-4 min-h-[var(--tap)] sm:min-h-0 sm:py-2 text-[13px] font-medium text-fg-muted transition-colors hover:text-fg hover:bg-fg/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/55 w-full sm:w-auto"
        >
          {expanded ? t('categories.collapse') : t('categories.showAll', { total: rows.length })}
        </button>
      )}
    </section>
  );
};

interface HomeSearchPatch {
  q?: string | undefined;
  difficulty?: string | undefined;
  runtime?: string[] | undefined;
  tags?: string[] | undefined;
  status?: string | undefined;
  sort?: HomeSortKey | undefined;
  duration?: HomeDuration | undefined;
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
            <ArrowRight
              size={16}
              className="transition-transform duration-fast ease-standard group-hover:translate-x-0.5"
            />
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
            <ArrowRight
              size={16}
              className="transition-transform duration-fast ease-standard group-hover:translate-x-0.5"
            />
          </span>
        </div>
      </Surface>
    </Link>
  );
};

const TracksBand = () => {
  const { t } = useTranslation('tracks');
  const aggregates = useTrackAggregates();
  const visible = tracks.filter(
    (track) => (aggregates.get(track.id)?.presentSlugs.length ?? 0) > 0,
  );
  if (visible.length === 0) return null;
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 eyebrow text-fg-subtle">
            <RouteIcon size={12} className="text-accent" />
            <span>{t('eyebrow')}</span>
          </div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tightish">{t('title')}</h2>
        </div>
        <Link
          to="/tracks"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline underline-offset-2"
        >
          {t('open')}
          <ArrowRight size={15} />
        </Link>
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {visible.map((track) => {
          const aggregate = aggregates.get(track.id);
          const percent = Math.round((aggregate?.masteryAverage ?? 0) * 100);
          const presentCount = aggregate?.presentSlugs.length ?? 0;
          return (
            <li key={track.id}>
              <Link to="/tracks/$id" params={{ id: track.id }} className="group block h-full">
                <Surface interactive className="h-full">
                  <div className="flex h-full flex-col gap-3 p-4">
                    {track.targetRole && (
                      <div className="eyebrow text-[10px] text-accent">{track.targetRole}</div>
                    )}
                    <h3 className="font-display text-lg leading-tight tracking-tightish text-fg">
                      {track.title}
                    </h3>
                    <div className="mt-auto space-y-1.5">
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                        <div
                          className={cx('h-full', percent === 100 ? 'bg-ok' : 'bg-accent')}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-fg-subtle tabular-nums">
                        <span>{t('home.topicCount', { count: presentCount })}</span>
                        <span>{percent}%</span>
                      </div>
                    </div>
                  </div>
                </Surface>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
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
  duration: HomeDuration | undefined;
  onToggleDuration: (value: HomeDuration) => void;
  sort: HomeSortKey;
  onSortChange: (value: HomeSortKey) => void;
  hasQuery: boolean;
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
  duration,
  onToggleDuration,
  sort,
  onSortChange,
  hasQuery,
  filtersActive,
  onReset,
}: CatalogToolbarProps) => {
  const { t } = useTranslation('home');
  const reduceMotion = useReducedMotion() ?? false;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const sortLabel = (key: HomeSortKey): string =>
    t(SORT_LABEL_KEY[key], { defaultValue: SORT_DEFAULT_LABEL[key] });
  const sortOptions = hasQuery ? SORT_KEYS : SORT_KEYS.filter((key) => key !== 'relevance');
  const activeFacetCount =
    (status !== 'all' ? 1 : 0) +
    runtimeFilter.length +
    tagFilter.length +
    (duration !== undefined ? 1 : 0);

  const facets = (
    <div className="space-y-4">
      <FacetGroup label={t('facets.status')}>
        {STATUS_FILTERS.map((option) => (
          <Chip key={option} active={status === option} onClick={() => onStatusChange(option)}>
            {t(STATUS_LABEL_KEY[option])}
          </Chip>
        ))}
      </FacetGroup>

      <FacetGroup label={t('facets.duration', { defaultValue: 'Длительность' })}>
        {DURATION_FILTERS.map((option) => (
          <Chip key={option} active={duration === option} onClick={() => onToggleDuration(option)}>
            {t(DURATION_LABEL_KEY[option], { defaultValue: DURATION_DEFAULT_LABEL[option] })}
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
  );

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
          <label className="relative block w-full sm:w-auto shrink-0">
            <span className="sr-only">{t('sort.label', { defaultValue: 'Сортировка' })}</span>
            <select
              value={sort}
              onChange={(event) => onSortChange(event.target.value as HomeSortKey)}
              aria-label={t('sort.label', { defaultValue: 'Сортировка' })}
              className="form-input appearance-none pr-9 text-[16px] sm:text-sm w-full sm:w-auto cursor-pointer"
            >
              {sortOptions.map((key) => (
                <option key={key} value={key}>
                  {sortLabel(key)}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              aria-hidden
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle"
            />
          </label>
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            aria-controls="catalog-facets"
            aria-label={t('filtersToggle.aria')}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border-base px-4 min-h-[var(--tap)] sm:min-h-0 sm:py-2 text-[13px] font-medium text-fg-muted transition-colors hover:text-fg hover:bg-fg/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/55 w-full sm:w-auto shrink-0"
          >
            <SlidersHorizontal size={14} />
            {filtersOpen ? t('filtersToggle.hide') : t('filtersToggle.show')}
            {activeFacetCount > 0 && (
              <span className="inline-flex min-w-[18px] items-center justify-center rounded-full bg-accent/[0.12] px-1.5 text-[11px] font-semibold tabular-nums text-accent">
                {activeFacetCount}
              </span>
            )}
            <ChevronDown
              size={14}
              className={cx('transition-transform duration-fast', filtersOpen && 'rotate-180')}
            />
          </button>
          {filtersActive && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border-base px-4 min-h-[var(--tap)] sm:min-h-0 sm:py-2 text-[13px] font-medium text-fg-muted transition-colors hover:text-fg hover:bg-fg/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/55 w-full sm:w-auto shrink-0"
            >
              <X size={14} />
              {t('reset')}
            </button>
          )}
        </div>

        {reduceMotion ? (
          filtersOpen && <div id="catalog-facets">{facets}</div>
        ) : (
          <AnimatePresence initial={false}>
            {filtersOpen && (
              <motion.div
                key="facets"
                id="catalog-facets"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="pt-1">{facets}</div>
              </motion.div>
            )}
          </AnimatePresence>
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
      'inline-flex items-center gap-1.5 rounded-full border px-3 min-h-[var(--tap)] sm:min-h-0 sm:py-1.5 text-[12px] tracking-snug transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/55',
      active
        ? 'border-accent/70 bg-accent/[0.16] text-accent font-medium'
        : 'border-border-base text-fg-muted hover:text-fg hover:bg-fg/[0.04]',
    )}
  >
    {icon}
    {children}
  </button>
);

const ContentResultsSection = ({
  results,
  topicTitleBySlug,
}: {
  results: ContentHit[];
  topicTitleBySlug: Map<string, string>;
}) => {
  const { t } = useTranslation('home');
  return (
    <Surface variant="inset" className="p-4 sm:p-5">
      <div className="eyebrow flex items-center gap-2 text-[10px] text-fg-subtle">
        <BookOpen size={14} className="text-accent" />
        <span>{t('contentResults.heading', { defaultValue: 'Совпадения в материалах' })}</span>
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {results.map((hit) => (
          <li key={`${hit.slug}:${hit.conceptId}`}>
            <Link
              to="/topics/$slug"
              params={{ slug: hit.slug }}
              search={{ concept: hit.conceptId }}
              onMouseEnter={() => prefetchTopic(hit.slug)}
              onFocus={() => prefetchTopic(hit.slug)}
              className="group flex min-h-[var(--tap)] items-center justify-between gap-3 rounded-xl border border-border-base px-3 py-2 transition-colors hover:border-border-strong hover:bg-fg/[0.03]"
            >
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-fg">
                  {hit.conceptTitle}
                </span>
                <span className="block truncate text-[11px] text-fg-subtle">
                  {topicTitleBySlug.get(hit.slug) ?? hit.slug}
                </span>
              </span>
              <ArrowRight
                size={14}
                className="shrink-0 text-fg-subtle transition-transform duration-fast ease-standard group-hover:translate-x-0.5 group-hover:text-accent"
              />
            </Link>
          </li>
        ))}
      </ul>
    </Surface>
  );
};

interface TopicCardProps {
  row: TopicRow;
  activeTags: string[];
  onToggleTag: (tag: string) => void;
  conceptMatches?: ContentHit[] | undefined;
}

const TopicCard = memo(function TopicCard({
  row,
  activeTags,
  onToggleTag,
  conceptMatches,
}: TopicCardProps) {
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
              <div className="eyebrow flex items-center gap-1.5 text-[10px] text-fg-subtle">
                {runtimeIcon(manifest.runtime)}
                <span>{t(taglineKey)}</span>
              </div>
              <h3
                title={manifest.title}
                className="mt-2 line-clamp-1 max-h-[1.875rem] overflow-hidden font-display text-2xl leading-tight tracking-tightish text-fg transition-[max-height] duration-[var(--dur-med)] ease-standard group-hover:line-clamp-4 group-hover:max-h-[7.5rem] group-focus-visible:line-clamp-4 group-focus-visible:max-h-[7.5rem]"
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
                      'rounded-full border px-2 py-0.5 text-[11px] tracking-snug transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/55',
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

          {conceptMatches && conceptMatches.length > 0 && (
            <div className="flex items-start gap-1.5 text-[11px] text-fg-muted">
              <BookOpen size={12} className="mt-0.5 shrink-0 text-accent" />
              <span className="min-w-0">
                <span className="text-fg-subtle">
                  {t('matches.label', { defaultValue: 'Совпадения' })}:{' '}
                </span>
                {conceptMatches.map((hit) => hit.conceptTitle).join(', ')}
              </span>
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
            <span className="opacity-0 -translate-x-1 transition-[transform,opacity] duration-fast ease-standard group-hover:opacity-100 group-hover:translate-x-0">
              <ArrowRight size={16} className="text-accent" />
            </span>
          </div>
        </div>
      </Surface>
    </Link>
  );
});

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

const EmptyState = () => {
  const { t } = useTranslation('home');
  return (
    <EmptyStateCard
      icon={<Layers size={22} className="text-accent" />}
      title={t('empty.title')}
      body={
        <Trans i18nKey="home:empty.hint" components={{ hint: <span className="text-accent" /> }} />
      }
    />
  );
};

const NoMatchesState = ({ onReset }: { onReset: () => void }) => {
  const { t } = useTranslation('home');
  return (
    <EmptyStateCard
      icon={<Search size={22} className="text-fg-subtle" />}
      title={t('noMatches.title')}
      body={t('noMatches.hint')}
      primaryAction={
        <Button
          variant="outline"
          size="md"
          className="w-full min-h-[var(--tap)] sm:min-h-0 sm:w-auto"
          leadingIcon={<X size={15} />}
          onClick={onReset}
        >
          {t('reset')}
        </Button>
      }
    />
  );
};

const getAvailableLanguages = (manifest: TopicManifest): readonly ('ru' | 'en')[] =>
  manifest.availableLanguages;
