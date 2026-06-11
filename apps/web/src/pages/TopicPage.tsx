import { Suspense, useEffect, useMemo, useRef, useState } from 'react';

import type { Exercise } from '@dotlearn/contracts';
import type { TopicBundle } from '@dotlearn/lesson-engine';
import { TopicNotFoundError } from '@dotlearn/lesson-engine';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bookmark,
  BookmarkCheck,
  Check,
  Flame,
  Languages,
  ListTree,
  NotebookPen,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { ExerciseRunner } from '@/components/ExerciseRunner';
import { TheoryContent } from '@/components/TheoryContent';
import { Button } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { Dialog } from '@/components/ui/Dialog';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Skeleton } from '@/components/ui/Skeleton';
import { Surface } from '@/components/ui/Surface';
import { getCurrentLanguage } from '@/lib/i18n';
import { db, recordPlace, saveConceptNote, setBookmark } from '@/lib/progress-db';
import type { ProgressRecord } from '@/lib/progress-db';
import { getTheory } from '@/lib/theory';
import { effectiveLanguage, loadTopic } from '@/lib/topics';
import { useConceptBookmarked } from '@/lib/use-learning';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useStreak, useTopicProgress } from '@/lib/use-progress';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; bundle: TopicBundle }
  | { kind: 'notFound' }
  | { kind: 'error'; message: string };

export const TopicPage = () => {
  const { slug } = useParams({ from: '/topics/$slug' });
  const search = useSearch({ from: '/topics/$slug' });
  const navigate = useNavigate();
  const { t, i18n } = useTranslation('topic');
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [activeConceptId, setActiveConceptId] = useState<string | undefined>(undefined);
  const progress = useTopicProgress(slug);
  const streak = useStreak();
  const reduceMotion = useReducedMotion() ?? false;
  const requestedConceptRef = useRef<string | undefined>(search.concept);
  requestedConceptRef.current = search.concept;

  const selectConcept = (conceptId: string): void => {
    setActiveConceptId(conceptId);
    void navigate({
      to: '/topics/$slug',
      params: { slug },
      search: { concept: conceptId },
      replace: true,
    });
  };

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    const language = getCurrentLanguage();
    loadTopic(slug, language)
      .then(async (bundle) => {
        if (cancelled) return;
        setState({ kind: 'ready', bundle });
        const concepts = bundle.manifest.concepts;
        const requested = requestedConceptRef.current;
        let initial =
          requested && concepts.some((concept) => concept.id === requested)
            ? requested
            : undefined;
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
  }, [slug, i18n.resolvedLanguage]);

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
  }, [slug, activeConceptId, state.kind]);

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
          <p className="mt-2 text-sm text-fg-muted">{state.message}</p>
          <Link to="/" hash="topics">
            <Button variant="ghost" leadingIcon={<ArrowLeft size={14} />} className="mt-4">
              {t('backToCatalog', { defaultValue: 'К каталогу тем' })}
            </Button>
          </Link>
        </div>
      </Surface>
    );
  }

  const { bundle } = state;
  const { manifest } = bundle;
  const currentLang = getCurrentLanguage();
  const usedLang = effectiveLanguage(manifest, currentLang);
  const showFallbackBanner = usedLang !== currentLang;
  const activeIndex = bundle.manifest.concepts.findIndex(
    (concept) => concept.id === activeConceptId,
  );
  const activeConcept =
    bundle.concepts.find((concept) => concept.conceptId === activeConceptId) ?? bundle.concepts[0];
  const activeManifestConcept =
    manifest.concepts.find((concept) => concept.id === activeConcept?.conceptId) ??
    manifest.concepts[0];

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
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  };

  return (
    <div className="space-y-6">
      <TopicHeader
        manifest={manifest}
        passed={progress.passed}
        totalExercises={totalExercises}
        streak={streak}
      />
      {showFallbackBanner && (
        <Surface variant="inset" rule="left" className="border-l-warn">
          <div className="px-4 py-3 text-sm text-warn flex items-center gap-2">
            <Languages size={14} />
            {t('fallbackBanner', { language: t(`languages.${usedLang}` as const) })}
          </div>
        </Surface>
      )}
      <ConceptStrip
        bundle={bundle}
        activeConceptId={activeConcept?.conceptId}
        onSelect={selectConcept}
        progress={progress.byExercise}
      />
      <div className="grid grid-cols-1 lg:grid-cols-[244px_minmax(0,1fr)] xl:grid-cols-[244px_minmax(0,1fr)_220px] gap-6">
        <ConceptRail
          bundle={bundle}
          activeConceptId={activeConcept?.conceptId}
          onSelect={selectConcept}
          progress={progress.byExercise}
        />
        <section className="min-w-0 space-y-6">
          {activeConcept && activeManifestConcept ? (
            <ConceptTransition conceptId={activeConcept.conceptId}>
              <ConceptPanel
                slug={slug}
                concept={activeManifestConcept}
                index={activeIndex}
                theoryFiles={theoryFilenames}
                exercises={conceptExercises}
                passed={conceptPassed}
                ratio={conceptRatio}
              />
            </ConceptTransition>
          ) : (
            <p className="text-fg-subtle">{t('noConcepts')}</p>
          )}
          <ConceptNav
            prevTitle={bundle.manifest.concepts[activeIndex - 1]?.title}
            nextTitle={bundle.manifest.concepts[activeIndex + 1]?.title}
            onPrev={() => handleNav(-1)}
            onNext={() => handleNav(1)}
          />
        </section>
        <TocSidebar conceptId={activeConcept?.conceptId} ratio={conceptRatio} />
      </div>
    </div>
  );
};

interface TopicHeaderProps {
  manifest: TopicBundle['manifest'];
  passed: number;
  totalExercises: number;
  streak: number;
}

const TopicHeader = ({ manifest, passed, totalExercises, streak }: TopicHeaderProps) => {
  const { t } = useTranslation('topic');
  const ratio = totalExercises === 0 ? 0 : passed / totalExercises;
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
            {manifest.title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 eyebrow text-fg-subtle">
            {manifest.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ProgressRing
            value={ratio}
            size={72}
            stroke={3}
            indicatorClassName={ratio === 1 ? 'text-ok' : ratio > 0 ? 'text-accent' : 'text-fg-subtle'}
            label={
              <span className="tabular-nums text-[13px] font-display">
                {Math.round(ratio * 100)}
                <span className="text-[9px] text-fg-subtle">%</span>
              </span>
            }
            ariaLabel={`${Math.round(ratio * 100)}%`}
          />
          <div className="text-[12px] text-fg-muted leading-snug">
            <div className="text-fg font-semibold tabular-nums">
              {t('solved', { passed, total: totalExercises })}
            </div>
            <div className="text-fg-subtle">{manifest.concepts.length} · concepts</div>
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
  const passed = exercises.filter((exercise) => progress.get(exercise.id)?.status === 'pass').length;
  const ratio = exercises.length === 0 ? 0 : passed / exercises.length;
  return {
    passed,
    total: exercises.length,
    ratio,
    done: exercises.length > 0 && passed === exercises.length,
  };
};

const ConceptList = ({ bundle, activeConceptId, onSelect, progress }: ConceptRailProps) => (
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
            {active && <span aria-hidden className="absolute left-0 top-0 bottom-0 w-0.5 bg-accent" />}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-baseline gap-2.5 min-w-0">
                <span
                  className={cx(
                    'chapter-no text-[15px] tabular-nums shrink-0 w-6',
                    done ? 'text-ok' : active ? 'text-accent' : undefined,
                  )}
                >
                  {done ? <Check size={13} className="inline" /> : String(index + 1).padStart(2, '0')}
                </span>
                <span className="text-[13.5px] font-medium truncate">{concept.title}</span>
              </div>
              <span className="text-[10px] text-fg-subtle tabular-nums shrink-0">
                {concept.estimatedMinutes}m
              </span>
            </div>
            <div className="mt-2 pl-[34px] flex items-center gap-2">
              <div className="flex-1 h-px bg-border-base overflow-visible">
                <div
                  className={cx('h-[2px] -mt-px transition-[width] duration-slow', done ? 'bg-ok' : 'bg-accent')}
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

const ConceptStrip = ({ bundle, activeConceptId, onSelect, progress }: ConceptRailProps) => {
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
                      {done ? <Check size={12} className="inline" /> : String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="text-[13px] font-medium truncate max-w-[40vw]">
                      {concept.title}
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
      <Dialog
        open={listOpen}
        onOpenChange={setListOpen}
        title={t('allConcepts')}
        placement="sheet"
      >
        <div className="rounded-xl border border-border-base overflow-hidden">
          <ConceptList
            bundle={bundle}
            activeConceptId={activeConceptId}
            onSelect={(conceptId) => {
              onSelect(conceptId);
              setListOpen(false);
            }}
            progress={progress}
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
  passed: number;
  ratio: number;
}

const ConceptPanel = ({
  slug,
  concept,
  index,
  theoryFiles,
  exercises,
  passed,
  ratio,
}: ConceptPanelProps) => {
  const { t } = useTranslation('topic');
  const [notesOpen, setNotesOpen] = useState(false);
  useEffect(() => {
    setNotesOpen(false);
  }, [concept.id]);
  const theories = useMemo(
    () => theoryFiles.map((filename) => ({ filename, resolved: getTheory(slug, filename) })),
    [slug, theoryFiles],
  );
  return (
    <article className="space-y-8">
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
          />
        </div>
        <h2 className="mt-3 font-display font-medium text-[clamp(26px,3.5vw,34px)] leading-[1.15] tracking-tightish text-fg text-balance">
          {concept.title}
        </h2>
        <span aria-hidden className="mt-4 block h-0.5 w-14 bg-accent" />
      </header>

      {notesOpen && <NotesEditor key={concept.id} slug={slug} conceptId={concept.id} />}

      <div data-toc-root className="theory-root max-w-prose">
        {theories.map(({ filename, resolved }) => (
          <section key={filename}>
            {resolved ? (
              <Suspense fallback={<Skeleton rounded="lg" className="h-40" />}>
                <TheoryContent Component={resolved.Component} />
              </Suspense>
            ) : (
              <p className="text-err text-sm">{t('theoryMissing', { filename })}</p>
            )}
          </section>
        ))}
      </div>

      <section className="space-y-4 pt-4 border-t-2 border-fg/80">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-2xl text-fg tracking-tightish">{t('practice')}</h3>
          <span className="text-[12px] text-fg-muted tabular-nums">
            {passed}/{exercises.length} · {Math.round(ratio * 100)}%
          </span>
        </div>
        {exercises.length === 0 ? (
          <Surface variant="inset">
            <p className="px-4 py-6 text-sm text-fg-subtle italic">{t('noExercises')}</p>
          </Surface>
        ) : (
          <div className="space-y-4 stagger">
            {exercises.map((exercise) => (
              <ExerciseRunner key={exercise.id} topicSlug={slug} exercise={exercise} />
            ))}
          </div>
        )}
      </section>
    </article>
  );
};

interface ConceptToolsProps {
  slug: string;
  conceptId: string;
  notesOpen: boolean;
  onToggleNotes: () => void;
}

const ConceptTools = ({ slug, conceptId, notesOpen, onToggleNotes }: ConceptToolsProps) => {
  const { t } = useTranslation('topic');
  const bookmarked = useConceptBookmarked(slug, conceptId);
  const toggleBookmark = (): void => {
    const next = !bookmarked;
    void setBookmark(slug, conceptId, next);
    toast.success(next ? t('bookmark.added') : t('bookmark.removed'));
  };
  return (
    <div className="flex items-center gap-1.5 shrink-0">
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
          <div className="eyebrow text-[10px]">{t('prevConcept')}</div>
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
          <div className="eyebrow text-[10px]">{t('nextConcept')}</div>
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

  useEffect(() => {
    const collect = (): void => {
      const root = document.querySelector('[data-toc-root]');
      if (!root) {
        setEntries([]);
        return;
      }
      const nodes = root.querySelectorAll<HTMLElement>('[data-toc]');
      const next: TocEntry[] = [];
      nodes.forEach((node) => {
        if (!node.id || !node.textContent) return;
        next.push({
          id: node.id,
          text: node.textContent,
          level: node.dataset.toc === 'h3' ? 3 : 2,
        });
      });
      setEntries(next);
    };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => requestAnimationFrame(collect));
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [conceptId]);

  useEffect(() => {
    if (entries.length === 0) return;
    const observer = new IntersectionObserver(
      (events) => {
        const visible = events.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          const first = visible.sort((a, b) => a.target.getBoundingClientRect().top - b.target.getBoundingClientRect().top)[0];
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
            indicatorClassName={ratio === 1 ? 'text-ok' : ratio > 0 ? 'text-accent' : 'text-fg-subtle'}
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
