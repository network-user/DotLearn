import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from 'react';

import type { Exercise, TopicLanguage, TopicSourceRef } from '@dotlearn/contracts';
import type { TopicBundle } from '@dotlearn/lesson-engine';
import { TopicNotFoundError } from '@dotlearn/lesson-engine';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, m as motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BookOpenCheck,
  Bookmark,
  BookmarkCheck,
  Check,
  Compass,
  ExternalLink,
  Flame,
  Focus,
  Languages,
  Layers,
  Library,
  ListTree,
  Minimize2,
  NotebookPen,
  RotateCcw,
  Wand2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { ExerciseRunner } from '@/components/ExerciseRunner';
import { FreeRecall } from '@/components/FreeRecall';
import { ReadingSettingsButton } from '@/components/ReadingSettingsButton';
import { ReadingPositionTracker, ResumeBanner } from '@/components/ResumeReading';
import { TheoryContent } from '@/components/TheoryContent';
import { TheoryHighlighter } from '@/components/TheoryHighlighter';
import { Button } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { Dialog } from '@/components/ui/Dialog';
import { DualProgressRing } from '@/components/ui/DualProgressRing';
import { Kbd } from '@/components/ui/Kbd';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Skeleton } from '@/components/ui/Skeleton';
import { Surface } from '@/components/ui/Surface';
import { THEORY_HIGHLIGHTS_ENABLED } from '@/lib/feature-flags';
import { useForcedContentLanguage } from '@/lib/forced-language';
import { getCurrentLanguage } from '@/lib/i18n';
import { nextTargetDifficulty, reorderByTargetDifficulty } from '@/lib/learner-model';
import { computeMastery, countReadConcepts, useReadConceptsByTopic } from '@/lib/mastery';
import { db, recordPlace, saveConceptNote, setBookmark, setConceptRead } from '@/lib/progress-db';
import type { ProgressRecord } from '@/lib/progress-db';
import { getTheory, prefetchTheory } from '@/lib/theory';
import { isConstrainedConnection } from '@/lib/connection';
import { programmaticScrollTo } from '@/lib/reading-position';
import { recordRecentVisit } from '@/lib/recent-visits';
import { prewarmPythonRuntime } from '@/lib/python-runtime';
import { prewarmSqlRuntime } from '@/lib/sql-runtime';
import { sanitizeHref } from '@/lib/safe-url';
import { Seo } from '@/lib/seo';
import {
  conceptTitle,
  effectiveLanguage,
  getAllManifests,
  loadTopic,
  topicHasEn,
  topicTitle,
  useContentLanguage,
} from '@/lib/topics';
import type { TopicSearch } from '@/router';
import { useConceptBookmarked, useConceptRead, useTopicReadConceptIds } from '@/lib/use-learning';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useStreak, useTopicProgress } from '@/lib/use-progress';
import topicStats from 'virtual:topic-stats';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; bundle: TopicBundle }
  | { kind: 'notFound' }
  | { kind: 'error'; message: string };

const RAIL_WIDTH_KEY = 'dotlearn:topic-rail-w';
const TOC_WIDTH_KEY = 'dotlearn:topic-toc-w';
const FOCUS_KEY = 'dotlearn:topic-focus';
const RAIL_WIDTH_DEFAULT = 244;
const TOC_WIDTH_DEFAULT = 220;
const RAIL_WIDTH_MIN = 180;
const RAIL_WIDTH_MAX = 360;
const TOC_WIDTH_MIN = 160;
const TOC_WIDTH_MAX = 320;
const RESIZE_STEP = 16;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const readStoredWidth = (key: string, fallback: number, min: number, max: number): number => {
  if (typeof window === 'undefined') return fallback;
  const raw = window.localStorage.getItem(key);
  if (raw === null) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback;
};

const readStoredFocus = (): boolean => {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(FOCUS_KEY) === 'on';
};

type ResizeEdge = 'rail' | 'toc';

interface ResizeHandleProps {
  edge: ResizeEdge;
  width: number;
  min: number;
  max: number;
  ariaLabel: string;
  onResize: (next: number) => void;
  className?: string;
}

const ResizeHandle = ({
  edge,
  width,
  min,
  max,
  ariaLabel,
  onResize,
  className,
}: ResizeHandleProps) => {
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(width);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    draggingRef.current = true;
    startXRef.current = event.clientX;
    startWidthRef.current = width;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (!draggingRef.current) return;
    const direction = edge === 'rail' ? 1 : -1;
    const delta = (event.clientX - startXRef.current) * direction;
    onResize(clamp(startWidthRef.current + delta, min, max));
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>): void => {
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const direction = edge === 'rail' ? 1 : -1;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      onResize(clamp(width - RESIZE_STEP * direction, min, max));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      onResize(clamp(width + RESIZE_STEP * direction, min, max));
    }
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Math.round(width)}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      className={cx(
        'group relative w-2 -mx-3 self-stretch cursor-col-resize touch-none select-none',
        'focus-visible:outline-none',
        className,
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-border-base transition-colors group-hover:bg-accent group-focus-visible:bg-accent"
      />
    </div>
  );
};

export const TopicPage = () => {
  const { slug } = useParams({ strict: false }) as { slug: string };
  const search = useSearch({ strict: false });
  const navigate = useNavigate();
  const { t } = useTranslation('topic');
  const forcedLanguage = useForcedContentLanguage();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [retryToken, setRetryToken] = useState(0);
  const [activeConceptId, setActiveConceptId] = useState<string | undefined>(undefined);
  const progress = useTopicProgress(slug);
  const streak = useStreak();
  const readConceptIds = useTopicReadConceptIds(slug);
  const contentLanguage = useContentLanguage();
  const reduceMotion = useReducedMotion() ?? false;
  const requestedConceptRef = useRef<string | undefined>(search.concept);
  requestedConceptRef.current = search.concept;
  const [railWidth, setRailWidth] = useState(() =>
    readStoredWidth(RAIL_WIDTH_KEY, RAIL_WIDTH_DEFAULT, RAIL_WIDTH_MIN, RAIL_WIDTH_MAX),
  );
  const [tocWidth, setTocWidth] = useState(() =>
    readStoredWidth(TOC_WIDTH_KEY, TOC_WIDTH_DEFAULT, TOC_WIDTH_MIN, TOC_WIDTH_MAX),
  );
  const [focusMode, setFocusMode] = useState(readStoredFocus);

  useEffect(() => {
    window.localStorage.setItem(RAIL_WIDTH_KEY, String(Math.round(railWidth)));
  }, [railWidth]);

  useEffect(() => {
    window.localStorage.setItem(TOC_WIDTH_KEY, String(Math.round(tocWidth)));
  }, [tocWidth]);

  useEffect(() => {
    window.localStorage.setItem(FOCUS_KEY, focusMode ? 'on' : 'off');
    const root = document.documentElement;
    if (focusMode) {
      root.dataset.focus = 'on';
    } else {
      delete root.dataset.focus;
    }
    return () => {
      delete document.documentElement.dataset.focus;
    };
  }, [focusMode]);

  const selectConcept = useCallback(
    (conceptId: string): void => {
      setActiveConceptId(conceptId);
      void navigate({
        to: forcedLanguage === 'en' ? '/en/topics/$slug' : '/topics/$slug',
        params: { slug },
        search: { concept: conceptId },
        replace: true,
      });
    },
    [navigate, slug, forcedLanguage],
  );

  const clearResume = useCallback((): void => {
    void navigate({
      to: forcedLanguage === 'en' ? '/en/topics/$slug' : '/topics/$slug',
      params: { slug },
      search: (prev: TopicSearch) => ({ concept: prev.concept }),
      replace: true,
    });
  }, [navigate, slug, forcedLanguage]);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    loadTopic(slug, contentLanguage)
      .then(async (bundle) => {
        if (cancelled) return;
        setState({ kind: 'ready', bundle });
        const concepts = bundle.manifest.concepts;
        const requested = requestedConceptRef.current;
        let initial =
          requested && concepts.some((concept) => concept.id === requested) ? requested : undefined;
        if (!initial) {
          const place = await db.topicPlace.get(slug);
          if (cancelled) return;
          if (place && concepts.some((concept) => concept.id === place.conceptId)) {
            initial = place.conceptId;
          }
        }
        if (cancelled) return;
        setActiveConceptId(initial ?? concepts[0]?.id);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (
          error instanceof TopicNotFoundError ||
          (error instanceof Error && error.name === 'TopicNotFoundError')
        ) {
          setState({ kind: 'notFound' });
          return;
        }
        setState({
          kind: 'error',
          message: error instanceof Error ? error.message : String(error),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [slug, contentLanguage, retryToken]);

  useEffect(() => {
    if (state.kind !== 'ready') return;
    const requested = search.concept;
    if (!requested || requested === activeConceptId) return;
    if (state.bundle.manifest.concepts.some((concept) => concept.id === requested)) {
      setActiveConceptId(requested);
    }
  }, [search.concept, state, activeConceptId]);

  useEffect(() => {
    if (state.kind !== 'ready' || !activeConceptId) return;
    void recordPlace(slug, activeConceptId);
    recordRecentVisit(slug, activeConceptId);
  }, [slug, activeConceptId, state.kind]);

  useEffect(() => {
    if (state.kind !== 'ready') return;
    const concepts = state.bundle.manifest.concepts;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.closest('.monaco-editor'))
      ) {
        return;
      }
      if (event.key === 'f') {
        event.preventDefault();
        setFocusMode((value) => !value);
        return;
      }
      if (event.key === 'Escape') {
        setFocusMode((value) => {
          if (value) event.preventDefault();
          return false;
        });
        return;
      }
      let delta = 0;
      if (event.key === 'j' || event.key === 'ArrowRight') delta = 1;
      else if (event.key === 'k' || event.key === 'ArrowLeft') delta = -1;
      else return;
      const index = concepts.findIndex((concept) => concept.id === activeConceptId);
      const next = concepts[index + delta];
      if (next) {
        event.preventDefault();
        selectConcept(next.id);
        programmaticScrollTo(0, !reduceMotion);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state, activeConceptId, selectConcept, reduceMotion]);

  useEffect(() => {
    if (state.kind !== 'ready') return;
    const concepts = state.bundle.manifest.concepts;
    let startX = 0;
    let startY = 0;
    let ignore = false;
    const onStart = (event: TouchEvent): void => {
      if (event.touches.length !== 1) {
        ignore = true;
        return;
      }
      const touch = event.touches[0];
      if (!touch) {
        ignore = true;
        return;
      }
      startX = touch.clientX;
      startY = touch.clientY;
      ignore = false;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        target.closest(
          '.monaco-editor, input, textarea, select, pre, .overflow-x-auto, [data-no-swipe]',
        )
      ) {
        ignore = true;
      }
    };
    const onEnd = (event: TouchEvent): void => {
      if (ignore) return;
      const touch = event.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (Math.abs(dx) < 70 || Math.abs(dy) > 50) return;
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed && selection.toString().trim().length > 0) return;
      const index = concepts.findIndex((concept) => concept.id === activeConceptId);
      const next = concepts[index + (dx < 0 ? 1 : -1)];
      if (next) {
        selectConcept(next.id);
        programmaticScrollTo(0, !reduceMotion);
      }
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchend', onEnd);
    };
  }, [state, activeConceptId, selectConcept, reduceMotion]);

  const readyRuntime = state.kind === 'ready' ? state.bundle.manifest.runtime : undefined;
  useEffect(() => {
    if (readyRuntime !== 'pyodide' && readyRuntime !== 'sql.js') return;
    if (isConstrainedConnection()) return;
    const prewarm = readyRuntime === 'pyodide' ? prewarmPythonRuntime : prewarmSqlRuntime;
    const win = window as typeof window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (typeof win.requestIdleCallback === 'function') {
      const handle = win.requestIdleCallback(() => prewarm(), { timeout: 3_000 });
      return () => win.cancelIdleCallback?.(handle);
    }
    const timer = window.setTimeout(prewarm, 1_500);
    return () => window.clearTimeout(timer);
  }, [readyRuntime]);

  useEffect(() => {
    if (state.kind !== 'ready' || !activeConceptId) return;
    if (isConstrainedConnection()) return;
    const concepts = state.bundle.manifest.concepts;
    const index = concepts.findIndex((concept) => concept.id === activeConceptId);
    const next = concepts[index + 1];
    if (!next) return;
    const nextBundle = state.bundle.concepts.find((concept) => concept.conceptId === next.id);
    const filenames = nextBundle?.theory.map((file) => file.filename) ?? [];
    if (filenames.length === 0) return;
    const run = (): void => {
      for (const filename of filenames) {
        prefetchTheory(slug, filename);
      }
    };
    const win = window as typeof window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    if (typeof win.requestIdleCallback === 'function') {
      const handle = win.requestIdleCallback(run, { timeout: 2_000 });
      return () => win.cancelIdleCallback?.(handle);
    }
    const timer = window.setTimeout(run, 400);
    return () => window.clearTimeout(timer);
  }, [state, activeConceptId, slug]);

  if (state.kind === 'loading') {
    return <TopicSkeleton />;
  }

  if (state.kind === 'notFound') {
    return (
      <Surface rule="left" className="border-l-err">
        <div className="p-6">
          <h1 className="font-display text-2xl text-err">
            {t('notFoundTitle', { defaultValue: 'Тема не найдена' })}
          </h1>
          <p className="mt-2 text-sm text-fg-muted">
            {t('notFoundBody', {
              defaultValue: 'Такой темы нет в каталоге. Возможно, ссылка устарела.',
            })}
          </p>
          <Link to="/" hash="topics">
            <Button variant="ghost" leadingIcon={<ArrowLeft size={14} />} className="mt-4">
              {t('backToCatalog', { defaultValue: 'К каталогу тем' })}
            </Button>
          </Link>
        </div>
      </Surface>
    );
  }

  if (state.kind === 'error') {
    return (
      <Surface rule="left" className="border-l-err">
        <div className="p-6">
          <h2 className="font-display text-2xl text-err">{t('failed')}</h2>
          <p className="mt-2 text-sm text-fg-muted">{t('failedBody')}</p>
          <p className="mt-1 text-[12px] text-fg-subtle break-words">{state.message}</p>
          <div className="mt-4 flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Button
              variant="primary"
              size="md"
              leadingIcon={<RotateCcw size={14} />}
              className="w-full min-h-[var(--tap)] sm:min-h-0 sm:w-auto"
              onClick={() => setRetryToken((value) => value + 1)}
            >
              {t('retry')}
            </Button>
            <Link to="/" hash="topics" className="block w-full sm:w-auto">
              <Button
                variant="ghost"
                size="md"
                leadingIcon={<ArrowLeft size={14} />}
                className="w-full min-h-[var(--tap)] sm:min-h-0 sm:w-auto"
              >
                {t('backToCatalog')}
              </Button>
            </Link>
          </div>
        </div>
      </Surface>
    );
  }

  const { bundle } = state;
  const { manifest } = bundle;
  const usedLang = effectiveLanguage(manifest, contentLanguage);
  const showFallbackBanner = usedLang !== contentLanguage;
  const activeIndex = bundle.manifest.concepts.findIndex(
    (concept) => concept.id === activeConceptId,
  );
  const activeConcept =
    bundle.concepts.find((concept) => concept.conceptId === activeConceptId) ?? bundle.concepts[0];
  const activeManifestConcept =
    manifest.concepts.find((concept) => concept.id === activeConcept?.conceptId) ??
    manifest.concepts[0];
  const prevManifestConcept = bundle.manifest.concepts[activeIndex - 1];
  const nextManifestConcept = bundle.manifest.concepts[activeIndex + 1];

  const totalExercises = bundle.concepts.reduce(
    (sum, concept) => sum + concept.exercises.reduce((s, file) => s + file.exercises.length, 0),
    0,
  );

  const theoryFilenames = activeConcept ? activeConcept.theory.map((file) => file.filename) : [];
  const conceptExercises = activeConcept
    ? activeConcept.exercises.flatMap((file) => file.exercises)
    : [];
  const conceptPassed = conceptExercises.filter(
    (ex) => progress.byExercise.get(ex.id)?.status === 'pass',
  ).length;
  const conceptRatio = conceptExercises.length === 0 ? 0 : conceptPassed / conceptExercises.length;

  const handleNav = (delta: 1 | -1): void => {
    const next = activeIndex + delta;
    const nextConcept = bundle.manifest.concepts[next];
    if (nextConcept) {
      selectConcept(nextConcept.id);
      programmaticScrollTo(0, !reduceMotion);
    }
  };

  return (
    <div className="space-y-6">
      <Seo
        lang={forcedLanguage ?? 'ru'}
        title={forcedLanguage === 'en' ? (manifest.titleEn ?? manifest.title) : manifest.title}
        description={manifest.descriptions?.[forcedLanguage ?? 'ru']}
        canonicalPath={forcedLanguage === 'en' ? `/en/topics/${slug}` : `/topics/${slug}`}
        alternates={
          topicHasEn(slug) ? { ru: `/topics/${slug}`, en: `/en/topics/${slug}` } : undefined
        }
        ogImagePath={`/og/${slug}.png`}
        ogType="article"
      />
      {activeConcept && (
        <ReadingProgress
          slug={slug}
          conceptId={activeConcept.conceptId}
          solvedRatio={conceptRatio}
        />
      )}
      {activeConcept && (
        <>
          <ReadingPositionTracker slug={slug} conceptId={activeConcept.conceptId} />
          <ResumeBanner
            slug={slug}
            conceptId={activeConcept.conceptId}
            resume={search.resume ?? false}
            onResumeHandled={clearResume}
          />
        </>
      )}
      <TopicHeader
        manifest={manifest}
        passed={progress.passed}
        totalExercises={totalExercises}
        streak={streak}
        readCount={readConceptIds.size}
        language={usedLang}
      />
      <PrerequisitesBanner prerequisites={manifest.prerequisites} />
      {showFallbackBanner && (
        <Surface variant="inset" rule="left" className="border-l-warn">
          <div className="px-4 py-3 text-sm text-warn flex items-center gap-2">
            <Languages size={14} />
            {t('fallbackBanner', { language: t(`languages.${usedLang}` as const) })}
          </div>
        </Surface>
      )}
      {focusMode && (
        <button
          type="button"
          onClick={() => setFocusMode(false)}
          aria-label={t('focus.exitButton')}
          title={t('focus.exitButton')}
          className="fixed right-[calc(env(safe-area-inset-right,0px)+12px)] top-[calc(var(--safe-top)+12px)] z-[var(--z-modal)] inline-flex items-center gap-2 h-11 px-4 rounded-full border border-border-base glass-strong text-sm font-medium text-fg shadow-float hover:bg-fg/[0.04] transition-colors"
        >
          <Minimize2 size={15} />
          <span>{t('focus.exitButton')}</span>
        </button>
      )}
      {!focusMode && (
        <ConceptStrip
          bundle={bundle}
          activeConceptId={activeConcept?.conceptId}
          onSelect={selectConcept}
          progress={progress.byExercise}
          language={usedLang}
        />
      )}
      <div
        className={cx(
          'grid grid-cols-1 gap-6 lg:gap-10 xl:gap-12',
          !focusMode &&
            'lg:[grid-template-columns:var(--rail-w)_minmax(0,1fr)] xl:[grid-template-columns:var(--rail-w)_minmax(0,1fr)_var(--toc-w)]',
        )}
        style={{ '--rail-w': `${railWidth}px`, '--toc-w': `${tocWidth}px` } as React.CSSProperties}
      >
        {!focusMode && (
          <div className="hidden lg:flex items-stretch min-w-0">
            <div className="min-w-0 flex-1">
              <ConceptRail
                bundle={bundle}
                activeConceptId={activeConcept?.conceptId}
                onSelect={selectConcept}
                progress={progress.byExercise}
                language={usedLang}
              />
            </div>
            <ResizeHandle
              edge="rail"
              width={railWidth}
              min={RAIL_WIDTH_MIN}
              max={RAIL_WIDTH_MAX}
              ariaLabel={t('resize.railAria')}
              onResize={setRailWidth}
            />
          </div>
        )}
        <section className={cx('min-w-0 space-y-6', focusMode && 'mx-auto w-full max-w-3xl')}>
          <InPageSkipLinks
            hasExercises={conceptExercises.length > 0}
            hasNextConcept={Boolean(bundle.manifest.concepts[activeIndex + 1])}
            onSkipToNextConcept={() => handleNav(1)}
          />
          {activeConcept && activeManifestConcept ? (
            <ConceptTransition conceptId={activeConcept.conceptId}>
              <ConceptPanel
                slug={slug}
                concept={activeManifestConcept}
                index={activeIndex}
                theoryFiles={theoryFilenames}
                exercises={conceptExercises}
                progressByExercise={progress.byExercise}
                passed={conceptPassed}
                ratio={conceptRatio}
                focusMode={focusMode}
                onToggleFocus={() => setFocusMode((value) => !value)}
                language={usedLang}
              />
            </ConceptTransition>
          ) : (
            <p className="text-fg-subtle">{t('noConcepts')}</p>
          )}
          <ConceptNav
            prevTitle={prevManifestConcept && conceptTitle(prevManifestConcept, usedLang)}
            nextTitle={nextManifestConcept && conceptTitle(nextManifestConcept, usedLang)}
            onPrev={() => handleNav(-1)}
            onNext={() => handleNav(1)}
          />
        </section>
        {!focusMode && (
          <div className="hidden xl:flex items-stretch min-w-0">
            <ResizeHandle
              edge="toc"
              width={tocWidth}
              min={TOC_WIDTH_MIN}
              max={TOC_WIDTH_MAX}
              ariaLabel={t('resize.tocAria')}
              onResize={setTocWidth}
            />
            <div className="min-w-0 flex-1">
              <TocSidebar conceptId={activeConcept?.conceptId} ratio={conceptRatio} />
            </div>
          </div>
        )}
      </div>
      {!focusMode && manifest.sources && manifest.sources.length > 0 && (
        <SourcesBlock sources={manifest.sources} />
      )}
    </div>
  );
};

interface PrerequisiteState {
  slug: string;
  title: string;
  mastered: boolean;
}

const PREREQ_MASTERY_THRESHOLD = 0.6;

const PrerequisitesBanner = ({ prerequisites }: { prerequisites: string[] }) => {
  const { t } = useTranslation('topic');
  const forcedLanguage = useForcedContentLanguage();
  const language = getCurrentLanguage();
  const prereqKey = prerequisites.join('|');
  const progressRecords = useLiveQuery(
    () =>
      prerequisites.length === 0
        ? Promise.resolve<ProgressRecord[]>([])
        : db.progress.where('topicSlug').anyOf(prerequisites).toArray(),
    [prereqKey],
    [],
  );
  const readByTopic = useReadConceptsByTopic();

  const prereqs = useMemo<PrerequisiteState[]>(() => {
    if (prerequisites.length === 0) return [];
    const manifests = getAllManifests();
    const passedByTopic = new Map<string, number>();
    for (const record of progressRecords ?? []) {
      if (record.status === 'pass') {
        passedByTopic.set(record.topicSlug, (passedByTopic.get(record.topicSlug) ?? 0) + 1);
      }
    }
    return prerequisites
      .map((slug) => {
        const manifest = manifests.find((entry) => entry.slug === slug);
        if (!manifest) return undefined;
        const totalExercises = topicStats[slug]?.[effectiveLanguage(manifest, language)] ?? 0;
        const readConcepts = countReadConcepts(manifest.concepts, readByTopic.get(slug));
        const m = computeMastery(
          readConcepts,
          manifest.concepts.length,
          passedByTopic.get(slug) ?? 0,
          totalExercises,
        );
        return {
          slug,
          title: topicTitle(manifest, language),
          mastered: m.mastery >= PREREQ_MASTERY_THRESHOLD,
        };
      })
      .filter((entry): entry is PrerequisiteState => entry !== undefined);
  }, [prerequisites, progressRecords, readByTopic, language]);

  if (prereqs.length === 0) return null;

  const masteredCount = prereqs.filter((entry) => entry.mastered).length;

  return (
    <Surface variant="inset" rule="left" className="border-l-accent/50">
      <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="inline-flex items-center gap-1.5 text-fg-muted">
            <Layers size={14} className="text-accent" />
            {t('prereqs.buildsOn')}
          </span>
          {prereqs.map((entry, index) => (
            <span key={entry.slug} className="inline-flex items-center">
              {index > 0 && (
                <span aria-hidden className="mr-2 text-fg-subtle">
                  ·
                </span>
              )}
              <Link
                to={
                  forcedLanguage === 'en' && topicHasEn(entry.slug)
                    ? '/en/topics/$slug'
                    : '/topics/$slug'
                }
                params={{ slug: entry.slug }}
                className={cx(
                  'inline-flex items-center gap-1 underline decoration-accent/40 underline-offset-2 transition-colors hover:decoration-accent',
                  entry.mastered ? 'text-ok' : 'text-accent',
                )}
              >
                {entry.mastered && <Check size={13} aria-hidden />}
                {entry.title}
              </Link>
            </span>
          ))}
        </div>
        <span className="text-[12px] text-fg-subtle tabular-nums shrink-0">
          {t('prereqs.mastered', { mastered: masteredCount, total: prereqs.length })}
        </span>
      </div>
    </Surface>
  );
};

const SourcesBlock = ({ sources }: { sources: TopicSourceRef[] }) => {
  const { t } = useTranslation('topic');
  return (
    <section className="border-t-2 border-fg/80 pt-5">
      <div className="mb-3 flex items-center gap-1.5 eyebrow eyebrow-accent">
        <Library size={12} />
        {t('sources.title')}
      </div>
      <ul className="space-y-2">
        {sources.map((source) => (
          <li key={source.url}>
            <a
              href={sanitizeHref(source.url)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-start gap-1.5 text-[14px] text-accent underline decoration-accent/40 underline-offset-2 transition-colors hover:decoration-accent"
            >
              <ExternalLink size={13} className="mt-1 shrink-0" aria-hidden />
              <span>{source.title}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
};

interface ReadingProgressProps {
  slug: string;
  conceptId: string;
  solvedRatio: number;
}

const ReadingProgress = ({ slug, conceptId, solvedRatio }: ReadingProgressProps) => {
  const { t } = useTranslation('topic');
  const [readRatio, setReadRatio] = useState(0);
  const markedRef = useRef(false);

  useEffect(() => {
    markedRef.current = false;
    setReadRatio(0);
  }, [conceptId]);

  useEffect(() => {
    let rafScheduled = false;
    let lastPercent = -1;
    const compute = (): void => {
      rafScheduled = false;
      const el = document.documentElement;
      const max = el.scrollHeight - el.clientHeight;
      const ratio = max <= 0 ? 0 : Math.min(1, Math.max(0, el.scrollTop / max));
      const percent = Math.round(ratio * 100);
      if (percent !== lastPercent) {
        lastPercent = percent;
        setReadRatio(ratio);
      }
      if (max > 120 && ratio >= 0.95 && !markedRef.current) {
        markedRef.current = true;
        void setConceptRead(slug, conceptId, true);
      }
    };
    const onScroll = (): void => {
      if (rafScheduled) return;
      rafScheduled = true;
      window.requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [slug, conceptId]);

  return (
    <div
      className="fixed top-0 inset-x-0 z-[calc(var(--z-nav)+1)] h-[3px] pointer-events-none"
      role="progressbar"
      aria-label={t('readingProgress')}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(readRatio * 100)}
    >
      <div
        className="absolute inset-y-0 left-0 bg-accent/25"
        style={{ width: `${readRatio * 100}%` }}
      />
      <div
        className="absolute inset-y-0 left-0 bg-accent transition-[width] duration-500"
        style={{ width: `${solvedRatio * 100}%` }}
      />
    </div>
  );
};

interface TopicHeaderProps {
  manifest: TopicBundle['manifest'];
  passed: number;
  totalExercises: number;
  streak: number;
  readCount: number;
  language: TopicLanguage;
}

const TopicHeader = ({
  manifest,
  passed,
  totalExercises,
  streak,
  readCount,
  language,
}: TopicHeaderProps) => {
  const { t } = useTranslation('topic');
  const totalConcepts = manifest.concepts.length;
  const m = computeMastery(readCount, totalConcepts, passed, totalExercises);
  const masteryPercent = Math.round(m.mastery * 100);
  return (
    <header className="border-y border-border-base py-6 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="space-y-4 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 eyebrow">
            <span className="text-accent">{manifest.runtime}</span>
            <span aria-hidden>·</span>
            <span>{manifest.difficulty}</span>
            <span aria-hidden>·</span>
            <span>~{manifest.estimatedHours}h</span>
            {streak > 0 && (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1 text-warn">
                  <Flame size={12} />
                  {t('streak', { count: streak })}
                </span>
              </>
            )}
          </div>
          <h1 className="font-display font-medium text-[clamp(32px,5vw,52px)] leading-[1.08] tracking-tightish text-balance">
            {topicTitle(manifest, language)}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 eyebrow text-fg-subtle">
            {manifest.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <DualProgressRing
            reading={m.readingRatio}
            solving={m.solvingRatio}
            size={72}
            stroke={4}
            gap={3}
            label={
              <span className="tabular-nums text-[13px] font-display">
                {masteryPercent}
                <span className="text-[9px] text-fg-subtle">%</span>
              </span>
            }
            ariaLabel={t('masteryAria', { percent: masteryPercent })}
          />
          <div className="text-[12px] text-fg-muted leading-snug">
            <div className="text-fg font-semibold tabular-nums">
              {t('solved', { passed, total: totalExercises })}
            </div>
            <div className="text-fg-subtle tabular-nums">
              {t('readConcepts', { read: readCount, total: totalConcepts })}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

interface ConceptRailProps {
  bundle: TopicBundle;
  activeConceptId: string | undefined;
  onSelect: (conceptId: string) => void;
  progress: Map<string, ProgressRecord>;
  language: TopicLanguage;
}

interface ConceptStat {
  passed: number;
  total: number;
  ratio: number;
  done: boolean;
}

const conceptStatOf = (
  bundle: TopicBundle,
  progress: ConceptRailProps['progress'],
  conceptId: string,
): ConceptStat => {
  const conceptBundle = bundle.concepts.find((entry) => entry.conceptId === conceptId);
  const exercises = conceptBundle?.exercises.flatMap((file) => file.exercises) ?? [];
  const passed = exercises.filter(
    (exercise) => progress.get(exercise.id)?.status === 'pass',
  ).length;
  const ratio = exercises.length === 0 ? 0 : passed / exercises.length;
  return {
    passed,
    total: exercises.length,
    ratio,
    done: exercises.length > 0 && passed === exercises.length,
  };
};

const ConceptList = ({
  bundle,
  activeConceptId,
  onSelect,
  progress,
  language,
}: ConceptRailProps) => (
  <ol>
    {bundle.manifest.concepts.map((concept, index) => {
      const active = concept.id === activeConceptId;
      const { passed, total, ratio, done } = conceptStatOf(bundle, progress, concept.id);
      return (
        <li key={concept.id}>
          <button
            type="button"
            onClick={() => onSelect(concept.id)}
            className={cx(
              'relative w-full text-left px-4 py-3 border-b border-border-base/60 last:border-b-0 transition-colors',
              active ? 'bg-accent/[0.06] text-fg' : 'text-fg hover:bg-surface-2/50',
            )}
            aria-current={active ? 'true' : undefined}
          >
            {active && (
              <span aria-hidden className="absolute left-0 top-0 bottom-0 w-0.5 bg-accent" />
            )}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-baseline gap-2.5 min-w-0">
                <span
                  className={cx(
                    'chapter-no text-[15px] tabular-nums shrink-0 w-6',
                    done ? 'text-ok' : active ? 'text-accent' : undefined,
                  )}
                >
                  {done ? (
                    <Check size={13} className="inline" />
                  ) : (
                    String(index + 1).padStart(2, '0')
                  )}
                </span>
                <span className="text-[13.5px] font-medium truncate">
                  {conceptTitle(concept, language)}
                </span>
              </div>
              <span className="text-[10px] text-fg-subtle tabular-nums shrink-0">
                {concept.estimatedMinutes}m
              </span>
            </div>
            <div className="mt-2 pl-[34px] flex items-center gap-2">
              <div className="flex-1 h-px bg-border-base overflow-visible">
                <div
                  className={cx(
                    'h-[2px] -mt-px transition-[width] duration-slow',
                    done ? 'bg-ok' : 'bg-accent',
                  )}
                  style={{ width: `${Math.round(ratio * 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-fg-subtle tabular-nums">
                {passed}/{total}
              </span>
            </div>
          </button>
        </li>
      );
    })}
  </ol>
);

const ConceptRail = (props: ConceptRailProps) => {
  const { t } = useTranslation('topic');
  return (
    <aside className="hidden lg:block lg:sticky lg:top-24 self-start">
      <div className="eyebrow pb-2 border-b-2 border-fg/80 mb-0">{t('contents')}</div>
      <Surface bordered={false} className="rounded-none border-b border-border-base">
        <ConceptList {...props} />
      </Surface>
    </aside>
  );
};

const ConceptStrip = ({
  bundle,
  activeConceptId,
  onSelect,
  progress,
  language,
}: ConceptRailProps) => {
  const { t } = useTranslation('topic');
  const reduceMotion = useReducedMotion() ?? false;
  const [listOpen, setListOpen] = useState(false);
  const activeChipRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeChipRef.current?.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  }, [activeConceptId, reduceMotion]);

  return (
    <div className="lg:hidden sticky top-[calc(var(--layout-nav-h)+2px)] z-[var(--z-aside)]">
      <Surface variant="chrome" className="rounded-lg">
        <div className="flex items-center gap-2 px-2 py-2">
          <button
            type="button"
            onClick={() => setListOpen(true)}
            aria-label={t('openConceptList')}
            className="shrink-0 grid place-items-center size-11 rounded-xl border border-border-base text-fg-muted hover:text-fg hover:bg-surface-2/40 transition-colors"
          >
            <ListTree size={18} />
          </button>
          <ol className="flex items-center gap-2 overflow-x-auto snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {bundle.manifest.concepts.map((concept, index) => {
              const active = concept.id === activeConceptId;
              const { ratio, done } = conceptStatOf(bundle, progress, concept.id);
              return (
                <li key={concept.id} className="shrink-0 snap-start">
                  <button
                    type="button"
                    ref={active ? activeChipRef : undefined}
                    onClick={() => onSelect(concept.id)}
                    aria-current={active ? 'true' : undefined}
                    className={cx(
                      'relative h-11 pl-2 pr-3 rounded-md border flex items-center gap-2 transition-colors',
                      active
                        ? 'border-accent/50 bg-accent/[0.07] text-fg'
                        : 'border-border-base text-fg-muted hover:bg-surface-2/50',
                    )}
                  >
                    <span
                      className={cx(
                        'chapter-no text-[13px] tabular-nums shrink-0',
                        done ? 'text-ok' : active ? 'text-accent' : undefined,
                      )}
                    >
                      {done ? (
                        <Check size={12} className="inline" />
                      ) : (
                        String(index + 1).padStart(2, '0')
                      )}
                    </span>
                    <span className="text-[13px] font-medium truncate max-w-[40vw]">
                      {conceptTitle(concept, language)}
                    </span>
                    <span
                      aria-hidden
                      className="absolute inset-x-2 bottom-[3px] h-px bg-border-base overflow-visible"
                    >
                      <span
                        className={cx('block h-[2px] -mt-px', done ? 'bg-ok' : 'bg-accent')}
                        style={{ width: `${Math.round(ratio * 100)}%` }}
                      />
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </Surface>
      <Dialog open={listOpen} onOpenChange={setListOpen} title={t('allConcepts')} placement="sheet">
        <div className="rounded-xl border border-border-base overflow-hidden">
          <ConceptList
            bundle={bundle}
            activeConceptId={activeConceptId}
            onSelect={(conceptId) => {
              onSelect(conceptId);
              setListOpen(false);
            }}
            progress={progress}
            language={language}
          />
        </div>
      </Dialog>
    </div>
  );
};

const ConceptTransition = ({
  conceptId,
  children,
}: {
  conceptId: string;
  children: React.ReactNode;
}) => {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return <>{children}</>;
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={conceptId}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

interface ConceptPanelProps {
  slug: string;
  concept: TopicBundle['manifest']['concepts'][number];
  index: number;
  theoryFiles: string[];
  exercises: Exercise[];
  progressByExercise: Map<string, ProgressRecord>;
  passed: number;
  ratio: number;
  focusMode: boolean;
  onToggleFocus: () => void;
  language: TopicLanguage;
}

const recentResultsForExercises = (
  exercises: Exercise[],
  progressByExercise: Map<string, ProgressRecord>,
): ('pass' | 'fail')[] =>
  exercises
    .map((exercise) => progressByExercise.get(exercise.id))
    .filter((record): record is ProgressRecord => record !== undefined)
    .sort((a, b) => a.lastAttemptAt.localeCompare(b.lastAttemptAt))
    .map((record) => record.status);

const orderExercisesByTarget = (
  exercises: Exercise[],
  progressByExercise: Map<string, ProgressRecord>,
): Exercise[] => {
  if (exercises.length < 2) return exercises;
  const recentResults = recentResultsForExercises(exercises, progressByExercise);
  const target = nextTargetDifficulty({ recentResults, baseDifficulty: 2 });
  return reorderByTargetDifficulty(exercises, target);
};

const adaptiveOrderKey = (slug: string): string => `dotlearn:adaptive-order:${slug}`;

const readAdaptiveOrder = (slug: string): boolean => {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(adaptiveOrderKey(slug)) === 'on';
};

const ConceptPanel = ({
  slug,
  concept,
  index,
  theoryFiles,
  exercises,
  progressByExercise,
  passed,
  ratio,
  focusMode,
  onToggleFocus,
  language,
}: ConceptPanelProps) => {
  const { t } = useTranslation('topic');
  const [notesOpen, setNotesOpen] = useState(false);
  const [adaptiveOrder, setAdaptiveOrder] = useState(() => readAdaptiveOrder(slug));
  useEffect(() => {
    setNotesOpen(false);
  }, [concept.id]);
  useEffect(() => {
    window.localStorage.setItem(adaptiveOrderKey(slug), adaptiveOrder ? 'on' : 'off');
  }, [slug, adaptiveOrder]);

  // Read the freshest exercises/progress at snapshot time without making the
  // visible order depend on their identity. The parent rebuilds the exercises
  // array (via flatMap) and the progress map on every answer, so depending on
  // them is what reshuffled blocks mid-answer.
  const exercisesRef = useRef(exercises);
  exercisesRef.current = exercises;
  const progressRef = useRef(progressByExercise);
  progressRef.current = progressByExercise;

  // Stable signature of the exercise set: changes only when navigating to a
  // different concept, not when the parent re-renders on a progress write.
  const exerciseSetKey = exercises.map((exercise) => exercise.id).join(',');

  // The practice order is a snapshot. It recomputes only when the exercise set
  // changes or when the adaptive toggle flips, never on a progress write, so
  // answering keeps blocks in place. The next visit/remount takes a fresh
  // snapshot from the updated progress.
  const [orderedExercises, setOrderedExercises] = useState<Exercise[]>(() =>
    readAdaptiveOrder(slug) ? orderExercisesByTarget(exercises, progressByExercise) : exercises,
  );
  useEffect(() => {
    setOrderedExercises(
      adaptiveOrder
        ? orderExercisesByTarget(exercisesRef.current, progressRef.current)
        : exercisesRef.current,
    );
  }, [adaptiveOrder, exerciseSetKey]);
  const theories = useMemo(
    () => theoryFiles.map((filename) => ({ filename, resolved: getTheory(slug, filename) })),
    [slug, theoryFiles],
  );
  const overview = useMemo(
    () =>
      index === 0
        ? theories.find((entry) => /(^|\/)00-overview\.(ru|en)\.mdx$/.test(entry.filename))
        : undefined,
    [theories, index],
  );
  const bodyTheories = overview ? theories.filter((entry) => entry !== overview) : theories;
  return (
    <article className="space-y-8">
      {overview?.resolved && <TopicOverview Component={overview.resolved.Component} />}
      <header>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 eyebrow">
            <span className="text-accent">{t('chapter', { n: index + 1 })}</span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1">
              <BookOpen size={12} />
              {t('readingTime', { minutes: concept.estimatedMinutes })}
            </span>
          </div>
          <ConceptTools
            slug={slug}
            conceptId={concept.id}
            notesOpen={notesOpen}
            onToggleNotes={() => setNotesOpen((value) => !value)}
            focusMode={focusMode}
            onToggleFocus={onToggleFocus}
          />
        </div>
        <h2 className="mt-3 font-display font-medium text-[clamp(26px,3.5vw,34px)] leading-[1.15] tracking-tightish text-fg text-balance">
          {conceptTitle(concept, language)}
        </h2>
        <span aria-hidden className="mt-4 block h-0.5 w-14 bg-accent" />
      </header>

      {notesOpen && <NotesEditor key={concept.id} slug={slug} conceptId={concept.id} />}

      <div data-toc-root className="theory-root max-w-prose">
        {bodyTheories.map(({ filename, resolved }, sectionIndex) => (
          <section key={filename} className={cx(sectionIndex > 0 && 'cv-auto-theory')}>
            {resolved ? (
              <Suspense fallback={<Skeleton rounded="lg" className="h-40" />}>
                <TheoryContent
                  Component={resolved.Component}
                  topicSlug={slug}
                  conceptId={concept.id}
                  conceptTitle={conceptTitle(concept, language)}
                />
              </Suspense>
            ) : (
              <p className="text-err text-sm">{t('theoryMissing', { filename })}</p>
            )}
          </section>
        ))}
      </div>

      {THEORY_HIGHLIGHTS_ENABLED ? <TheoryHighlighter slug={slug} conceptId={concept.id} /> : null}

      <FreeRecall
        slug={slug}
        conceptId={concept.id}
        conceptTitle={conceptTitle(concept, language)}
      />

      <section
        id="concept-exercises"
        tabIndex={-1}
        className="space-y-4 pt-4 border-t-2 border-fg/80 outline-none scroll-mt-24"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-2xl text-fg tracking-tightish">{t('practice')}</h3>
          <div className="flex items-center gap-3">
            {exercises.length >= 2 && (
              <button
                type="button"
                onClick={() => setAdaptiveOrder((value) => !value)}
                aria-pressed={adaptiveOrder}
                title={adaptiveOrder ? t('adaptive.showOriginal') : t('adaptive.matchToMe')}
                className={cx(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 min-h-[var(--tap)] sm:min-h-0 sm:py-1.5 text-[12px] font-medium tracking-snug transition-colors',
                  adaptiveOrder
                    ? 'border-accent/50 bg-accent/[0.08] text-accent'
                    : 'border-border-base text-fg-muted hover:text-fg hover:bg-fg/[0.04]',
                )}
              >
                <Wand2 size={13} />
                {adaptiveOrder ? t('adaptive.matched') : t('adaptive.matchToMe')}
              </button>
            )}
            <span className="text-[12px] text-fg-muted tabular-nums">
              {passed}/{exercises.length} · {Math.round(ratio * 100)}%
            </span>
          </div>
        </div>
        {orderedExercises.length === 0 ? (
          <Surface variant="inset">
            <p className="px-4 py-6 text-sm text-fg-subtle italic">{t('noExercises')}</p>
          </Surface>
        ) : (
          <div className="space-y-4 stagger">
            {orderedExercises.map((exercise, exerciseIndex) => (
              <div key={exercise.id} className={cx(exerciseIndex > 0 && 'cv-auto-exercise')}>
                <ExerciseRunner topicSlug={slug} exercise={exercise} conceptId={concept.id} />
              </div>
            ))}
          </div>
        )}
      </section>
    </article>
  );
};

const TopicOverview = ({ Component }: { Component: ComponentType<Record<string, unknown>> }) => {
  const { t } = useTranslation('topic');
  return (
    <aside className="rounded-xl border border-border-base bg-surface-2/30 p-5 sm:p-6 [&_p]:text-[16.5px] [&_p]:my-3.5 [&_li]:text-[15.5px] [&_li]:leading-[1.6] [&_.theory-content>*:first-child]:mt-0 [&_.theory-content>*:last-child]:mb-0">
      <div className="eyebrow eyebrow-accent mb-3 flex items-center gap-1.5">
        <Compass size={12} />
        {t('overviewLabel', { defaultValue: 'Об этой теме' })}
      </div>
      <TheoryContent Component={Component} />
    </aside>
  );
};

interface ConceptToolsProps {
  slug: string;
  conceptId: string;
  notesOpen: boolean;
  onToggleNotes: () => void;
  focusMode: boolean;
  onToggleFocus: () => void;
}

const ConceptTools = ({
  slug,
  conceptId,
  notesOpen,
  onToggleNotes,
  focusMode,
  onToggleFocus,
}: ConceptToolsProps) => {
  const { t } = useTranslation('topic');
  const bookmarked = useConceptBookmarked(slug, conceptId);
  const read = useConceptRead(slug, conceptId);
  const toggleBookmark = (): void => {
    const next = !bookmarked;
    void setBookmark(slug, conceptId, next);
    toast.success(next ? t('bookmark.added') : t('bookmark.removed'));
  };
  const toggleRead = (): void => {
    const next = !read;
    void setConceptRead(slug, conceptId, next);
    toast.success(next ? t('read.markedRead') : t('read.markedUnread'));
  };
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <button
        type="button"
        onClick={toggleRead}
        aria-pressed={read}
        title={read ? t('read.markUnread') : t('read.markRead')}
        aria-label={read ? t('read.markUnread') : t('read.markRead')}
        className={cx(
          'grid place-items-center size-9 rounded-lg border transition-colors',
          read
            ? 'border-ok/50 bg-ok/[0.08] text-ok'
            : 'border-border-base text-fg-muted hover:text-fg hover:bg-surface-2/50',
        )}
      >
        {read ? <BookOpenCheck size={16} /> : <BookOpen size={16} />}
      </button>
      <button
        type="button"
        onClick={toggleBookmark}
        aria-pressed={bookmarked}
        title={bookmarked ? t('bookmark.remove') : t('bookmark.add')}
        aria-label={bookmarked ? t('bookmark.remove') : t('bookmark.add')}
        className={cx(
          'grid place-items-center size-9 rounded-lg border transition-colors',
          bookmarked
            ? 'border-accent/50 bg-accent/[0.08] text-accent'
            : 'border-border-base text-fg-muted hover:text-fg hover:bg-surface-2/50',
        )}
      >
        {bookmarked ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
      </button>
      <button
        type="button"
        onClick={onToggleNotes}
        aria-pressed={notesOpen}
        title={t('notes.label')}
        aria-label={t('notes.label')}
        className={cx(
          'grid place-items-center size-9 rounded-lg border transition-colors',
          notesOpen
            ? 'border-accent/50 bg-accent/[0.08] text-accent'
            : 'border-border-base text-fg-muted hover:text-fg hover:bg-surface-2/50',
        )}
      >
        <NotebookPen size={16} />
      </button>
      <button
        type="button"
        onClick={onToggleFocus}
        aria-pressed={focusMode}
        title={focusMode ? t('focus.exit') : t('focus.enter')}
        aria-label={focusMode ? t('focus.exit') : t('focus.enter')}
        className={cx(
          'grid place-items-center size-9 rounded-lg border transition-colors',
          focusMode
            ? 'border-accent/50 bg-accent/[0.08] text-accent'
            : 'border-border-base text-fg-muted hover:text-fg hover:bg-surface-2/50',
        )}
      >
        {focusMode ? <Minimize2 size={16} /> : <Focus size={16} />}
      </button>
      <ReadingSettingsButton />
    </div>
  );
};

const NotesEditor = ({ slug, conceptId }: { slug: string; conceptId: string }) => {
  const { t } = useTranslation('topic');
  const [text, setText] = useState<string | null>(null);
  const initialRef = useRef<string>('');
  useEffect(() => {
    let active = true;
    void db.conceptNotes.get(`${slug}:${conceptId}`).then((record) => {
      if (!active) return;
      const value = record?.text ?? '';
      initialRef.current = value;
      setText(value);
    });
    return () => {
      active = false;
    };
  }, [slug, conceptId]);
  const debounced = useDebouncedValue(text, 600);
  useEffect(() => {
    if (debounced === null || debounced === initialRef.current) return;
    initialRef.current = debounced;
    void saveConceptNote(slug, conceptId, debounced);
  }, [debounced, slug, conceptId]);
  return (
    <Surface variant="inset" rule="left" className="border-l-accent/40">
      <div className="p-3 space-y-2">
        <div className="flex items-center gap-1.5 eyebrow text-[10px]">
          <NotebookPen size={11} />
          {t('notes.label')}
        </div>
        <textarea
          value={text ?? ''}
          onChange={(event) => setText(event.target.value)}
          placeholder={t('notes.placeholder')}
          rows={4}
          className="w-full rounded-lg border border-border-base bg-surface px-3 py-2 text-[16px] sm:text-sm leading-relaxed text-fg placeholder:text-fg-subtle outline-none transition-colors focus:border-accent/50 focus:ring-2 focus:ring-accent/20 resize-y min-h-[96px]"
        />
        <p className="text-[10px] text-fg-subtle">{t('notes.hint')}</p>
      </div>
    </Surface>
  );
};

interface InPageSkipLinksProps {
  hasExercises: boolean;
  hasNextConcept: boolean;
  onSkipToNextConcept: () => void;
}

const skipLinkClassName =
  'sr-only focus:not-sr-only focus:inline-flex focus:items-center focus:min-h-[var(--tap)] focus:rounded-md focus:border focus:border-border-base focus:bg-surface focus:px-4 focus:text-sm focus:font-medium focus:text-fg focus:shadow-float focus:outline-none focus:ring-2 focus:ring-accent/50';

const InPageSkipLinks = ({
  hasExercises,
  hasNextConcept,
  onSkipToNextConcept,
}: InPageSkipLinksProps) => {
  const { t } = useTranslation('topic');
  if (!hasExercises && !hasNextConcept) return null;
  const focusExercises = (event: React.MouseEvent<HTMLAnchorElement>): void => {
    const target = document.getElementById('concept-exercises');
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ block: 'start' });
    target.focus({ preventScroll: true });
  };
  return (
    <div className="flex flex-wrap gap-2 focus-within:gap-2">
      {hasExercises && (
        <a href="#concept-exercises" onClick={focusExercises} className={skipLinkClassName}>
          {t('skipToExercises')}
        </a>
      )}
      {hasNextConcept && (
        <button type="button" onClick={onSkipToNextConcept} className={skipLinkClassName}>
          {t('skipToNextConcept')}
        </button>
      )}
    </div>
  );
};

interface ConceptNavProps {
  prevTitle: string | undefined;
  nextTitle: string | undefined;
  onPrev: () => void;
  onNext: () => void;
}

const ConceptNav = ({ prevTitle, nextTitle, onPrev, onNext }: ConceptNavProps) => {
  const { t } = useTranslation('topic');
  if (!prevTitle && !nextTitle) return null;
  return (
    <div className="flex items-stretch justify-between gap-3 pt-4 border-t border-border-base">
      <button
        type="button"
        onClick={onPrev}
        disabled={!prevTitle}
        className={cx(
          'flex-1 max-w-none sm:max-w-[280px] min-h-[var(--tap-comfort)] px-2 py-2 text-left transition-colors',
          'disabled:opacity-30 disabled:cursor-not-allowed group',
          'flex items-center gap-3',
        )}
      >
        <ArrowLeft size={16} className="text-fg-subtle group-hover:text-accent transition-colors" />
        <div className="min-w-0">
          <div className="eyebrow text-[10px] flex items-center gap-1.5">
            {t('prevConcept')}
            <span className="hidden sm:inline-flex">
              <Kbd>k</Kbd>
            </span>
          </div>
          <div className="text-[14px] font-serif text-fg truncate group-hover:underline decoration-accent/50 underline-offset-2">
            {prevTitle ?? '—'}
          </div>
        </div>
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={!nextTitle}
        className={cx(
          'flex-1 max-w-none sm:max-w-[280px] min-h-[var(--tap-comfort)] px-2 py-2 text-right transition-colors',
          'disabled:opacity-30 disabled:cursor-not-allowed group',
          'flex items-center justify-end gap-3',
        )}
      >
        <div className="min-w-0">
          <div className="eyebrow text-[10px] flex items-center justify-end gap-1.5">
            <span className="hidden sm:inline-flex">
              <Kbd>j</Kbd>
            </span>
            {t('nextConcept')}
          </div>
          <div className="text-[14px] font-serif text-fg truncate group-hover:underline decoration-accent/50 underline-offset-2">
            {nextTitle ?? '—'}
          </div>
        </div>
        <ArrowRight size={16} className="text-accent" />
      </button>
    </div>
  );
};

interface TocEntry {
  id: string;
  text: string;
  level: 2 | 3;
}

const TocSidebar = ({ conceptId, ratio }: { conceptId: string | undefined; ratio: number }) => {
  const { t } = useTranslation('topic');
  const [entries, setEntries] = useState<TocEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastSigRef = useRef('');

  useEffect(() => {
    let cancelled = false;
    let observer: MutationObserver | null = null;
    let scheduled = false;
    const collect = (): void => {
      if (cancelled) return;
      const root = document.querySelector('[data-toc-root]');
      const next: TocEntry[] = [];
      if (root) {
        root.querySelectorAll<HTMLElement>('[data-toc]').forEach((node) => {
          if (!node.id || !node.textContent) return;
          next.push({
            id: node.id,
            text: node.textContent,
            level: node.dataset.toc === 'h3' ? 3 : 2,
          });
        });
      }
      const signature = next.map((entry) => `${entry.level}:${entry.id}:${entry.text}`).join('|');
      if (signature === lastSigRef.current) return;
      lastSigRef.current = signature;
      setEntries(next);
    };
    const schedule = (): void => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        collect();
      });
    };
    const attach = (): void => {
      if (cancelled) return;
      const root = document.querySelector('[data-toc-root]');
      if (!root) {
        rafRef.current = requestAnimationFrame(attach);
        return;
      }
      collect();
      observer = new MutationObserver(schedule);
      observer.observe(root, { childList: true, subtree: true });
    };
    setEntries([]);
    lastSigRef.current = '';
    rafRef.current = requestAnimationFrame(attach);
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      observer?.disconnect();
    };
  }, [conceptId]);

  useEffect(() => {
    if (entries.length === 0) return;
    const observer = new IntersectionObserver(
      (events) => {
        const visible = events.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          const first = visible.sort(
            (a, b) => a.target.getBoundingClientRect().top - b.target.getBoundingClientRect().top,
          )[0];
          if (first) setActiveId(first.target.id);
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: [0, 1] },
    );
    entries.forEach((entry) => {
      const el = document.getElementById(entry.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [entries]);

  return (
    <aside className="hidden xl:block xl:sticky xl:top-24 self-start">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 pb-2 border-b-2 border-fg/80">
          <div className="flex items-center gap-1.5 eyebrow text-[10px]">
            <ListTree size={11} />
            {t('toc')}
          </div>
          <ProgressRing
            value={ratio}
            size={24}
            stroke={2}
            indicatorClassName={
              ratio === 1 ? 'text-ok' : ratio > 0 ? 'text-accent' : 'text-fg-subtle'
            }
          />
        </div>
        {entries.length === 0 ? (
          <p className="text-[12px] text-fg-subtle">—</p>
        ) : (
          <ul className="border-l border-border-base">
            {entries.map((entry) => (
              <li key={entry.id}>
                <a
                  href={`#${entry.id}`}
                  className={cx(
                    'block py-1 pl-3 -ml-px border-l-2 text-[12.5px] leading-snug transition-colors duration-fast',
                    entry.level === 3 && 'pl-6 text-[12px]',
                    activeId === entry.id
                      ? 'border-accent text-accent font-medium'
                      : 'border-transparent text-fg-muted hover:text-fg',
                  )}
                >
                  {entry.text}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
};

const TopicSkeleton = () => (
  <div className="space-y-6" aria-hidden>
    <Skeleton rounded="2xl" className="h-32" />
    <Skeleton rounded="2xl" className="lg:hidden h-[60px]" />
    <div className="grid grid-cols-1 lg:grid-cols-[244px_minmax(0,1fr)] xl:grid-cols-[244px_minmax(0,1fr)_220px] gap-6">
      <Skeleton rounded="2xl" className="hidden lg:block h-72" />
      <Skeleton rounded="2xl" className="h-96" />
      <Skeleton rounded="2xl" className="hidden xl:block h-72" />
    </div>
  </div>
);
