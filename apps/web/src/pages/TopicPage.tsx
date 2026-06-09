import { useEffect, useMemo, useRef, useState } from 'react';

import type { Exercise } from '@dotlearn/contracts';
import type { TopicBundle } from '@dotlearn/lesson-engine';
import { Link, useParams } from '@tanstack/react-router';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, BookOpen, Check, Flame, ListTree } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ExerciseRunner } from '@/components/ExerciseRunner';
import { TheoryContent } from '@/components/TheoryContent';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Skeleton } from '@/components/ui/Skeleton';
import { getCurrentLanguage } from '@/lib/i18n';
import { getTheory } from '@/lib/theory';
import { effectiveLanguage, loadTopic } from '@/lib/topics';
import { useStreak, useTopicProgress } from '@/lib/use-progress';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; bundle: TopicBundle }
  | { kind: 'error'; message: string };

export const TopicPage = () => {
  const { slug } = useParams({ from: '/topics/$slug' });
  const { t, i18n } = useTranslation('topic');
  const { t: tCommon } = useTranslation('common');
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [activeConceptId, setActiveConceptId] = useState<string | undefined>(undefined);
  const progress = useTopicProgress(slug);
  const streak = useStreak();

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    const language = getCurrentLanguage();
    loadTopic(slug, language)
      .then((bundle) => {
        if (cancelled) return;
        setState({ kind: 'ready', bundle });
        setActiveConceptId(bundle.manifest.concepts[0]?.id);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          kind: 'error',
          message: error instanceof Error ? error.message : String(error),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [slug, i18n.resolvedLanguage]);

  if (state.kind === 'loading') {
    return <TopicSkeleton />;
  }

  if (state.kind === 'error') {
    return (
      <GlassSurface intensity="medium" bordered className="rounded-2xl">
        <div className="p-6">
          <h2 className="font-display text-2xl text-rose-300">{t('failed')}</h2>
          <p className="mt-2 text-sm text-fg-muted">{state.message}</p>
          <Link to="/">
            <Button variant="ghost" leadingIcon={<ArrowLeft size={14} />} className="mt-4">
              {tCommon('backToHome')}
            </Button>
          </Link>
        </div>
      </GlassSurface>
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
      setActiveConceptId(nextConcept.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
        <GlassSurface intensity="subtle" bordered className="rounded-xl">
          <div className="px-4 py-3 text-sm text-amber-300 flex items-center gap-2">
            <Flame size={14} />
            {t('fallbackBanner', { language: t(`languages.${usedLang}` as const) })}
          </div>
        </GlassSurface>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-[244px_minmax(0,1fr)] xl:grid-cols-[244px_minmax(0,1fr)_220px] gap-6">
        <ConceptRail
          bundle={bundle}
          activeConceptId={activeConcept?.conceptId}
          onSelect={setActiveConceptId}
          progress={progress.byExercise}
        />
        <section className="min-w-0 space-y-6">
          {activeConcept && activeManifestConcept ? (
            <ConceptTransition conceptId={activeConcept.conceptId}>
              <ConceptPanel
                slug={slug}
                concept={activeManifestConcept}
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
    <GlassSurface intensity="strong" tint="accent" bordered noiseOverlay className="rounded-2xl">
      <div className="p-6 flex flex-wrap items-start justify-between gap-6">
        <div className="space-y-3 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] uppercase tracking-widest text-fg-subtle">
            <Badge tone="accent" variant="soft">
              {manifest.runtime}
            </Badge>
            <Badge tone="neutral" variant="outline">
              {manifest.difficulty}
            </Badge>
            <span>~{manifest.estimatedHours}h</span>
            {streak > 0 && (
              <Badge tone="warning" variant="soft" icon={<Flame size={12} />}>
                {t('streak', { count: streak })}
              </Badge>
            )}
          </div>
          <h1 className="font-display text-[clamp(28px,4vw,40px)] leading-tight tracking-tightish text-balance">
            {manifest.title}
          </h1>
          <div className="flex flex-wrap gap-1.5">
            {manifest.tags.map((tag) => (
              <Badge key={tag} tone="neutral" variant="soft">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ProgressRing
            value={ratio}
            size={72}
            stroke={6}
            indicatorClassName={
              ratio === 1 ? 'text-emerald-400' : ratio > 0 ? 'text-accent' : 'text-fg-subtle'
            }
            label={
              <span className="tabular-nums text-[13px]">
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
    </GlassSurface>
  );
};

interface ConceptRailProps {
  bundle: TopicBundle;
  activeConceptId: string | undefined;
  onSelect: (conceptId: string) => void;
  progress: Map<string, import('@/lib/progress-db').ProgressRecord>;
}

const ConceptRail = ({ bundle, activeConceptId, onSelect, progress }: ConceptRailProps) => (
  <aside className="lg:sticky lg:top-24 self-start">
    <GlassSurface intensity="medium" bordered className="rounded-2xl overflow-hidden">
      <ol>
        {bundle.manifest.concepts.map((concept, index) => {
          const active = concept.id === activeConceptId;
          const conceptBundle = bundle.concepts.find((entry) => entry.conceptId === concept.id);
          const exercises = conceptBundle?.exercises.flatMap((file) => file.exercises) ?? [];
          const passed = exercises.filter(
            (exercise) => progress.get(exercise.id)?.status === 'pass',
          ).length;
          const ratio = exercises.length === 0 ? 0 : passed / exercises.length;
          const done = exercises.length > 0 && passed === exercises.length;
          return (
            <li key={concept.id}>
              <button
                type="button"
                onClick={() => onSelect(concept.id)}
                className={cx(
                  'relative w-full text-left px-4 py-3 border-b border-border-base/40 last:border-b-0 transition-colors',
                  active ? 'bg-accent/8 text-fg' : 'text-fg hover:bg-surface-2/40',
                )}
                aria-current={active ? 'true' : undefined}
              >
                {active && (
                  <span
                    aria-hidden
                    className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-accent via-accent-2 to-accent-3"
                  />
                )}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={cx(
                        'grid place-items-center size-6 rounded-md font-mono text-[11px] tabular-nums shrink-0',
                        done
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : active
                            ? 'bg-accent/15 text-accent'
                            : 'bg-surface-2/80 text-fg-subtle',
                      )}
                    >
                      {done ? <Check size={12} /> : index + 1}
                    </span>
                    <span className="text-[13.5px] font-medium truncate">{concept.title}</span>
                  </div>
                  <span className="text-[10px] text-fg-subtle tabular-nums shrink-0">
                    {concept.estimatedMinutes}m
                  </span>
                </div>
                <div className="mt-2 pl-[34px] flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full bg-surface-2/60 overflow-hidden">
                    <div
                      className={cx(
                        'h-full transition-[width] duration-slow',
                        done ? 'bg-emerald-400' : 'bg-gradient-to-r from-accent to-accent-2',
                      )}
                      style={{ width: `${Math.round(ratio * 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-fg-subtle tabular-nums">
                    {passed}/{exercises.length}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </GlassSurface>
  </aside>
);

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
        initial={{ opacity: 0, y: 10, filter: 'blur(5px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
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
  theoryFiles: string[];
  exercises: Exercise[];
  passed: number;
  ratio: number;
}

const ConceptPanel = ({ slug, concept, theoryFiles, exercises, passed, ratio }: ConceptPanelProps) => {
  const { t } = useTranslation('topic');
  const theories = useMemo(
    () => theoryFiles.map((filename) => ({ filename, resolved: getTheory(slug, filename) })),
    [slug, theoryFiles],
  );
  return (
    <article className="space-y-8">
      <header className="space-y-2">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-fg-subtle">
          <BookOpen size={12} />
          {t('theory')}
          <span>·</span>
          <span className="text-fg-muted">{concept.estimatedMinutes} min</span>
        </div>
        <h2 className="font-display text-3xl leading-tight tracking-tightish text-fg">
          {concept.title}
        </h2>
      </header>

      <div data-toc-root className="theory-root max-w-prose">
        {theories.map(({ filename, resolved }) => (
          <section key={filename}>
            {resolved ? (
              <TheoryContent Component={resolved.Component} />
            ) : (
              <p className="text-rose-300 text-sm">{t('theoryMissing', { filename })}</p>
            )}
          </section>
        ))}
      </div>

      <section className="space-y-4 pt-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-2xl text-fg tracking-tightish">{t('practice')}</h3>
          <span className="text-[12px] text-fg-muted tabular-nums">
            {passed}/{exercises.length} · {Math.round(ratio * 100)}%
          </span>
        </div>
        {exercises.length === 0 ? (
          <GlassSurface intensity="subtle" bordered className="rounded-xl">
            <p className="px-4 py-6 text-sm text-fg-subtle italic">{t('noExercises')}</p>
          </GlassSurface>
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
    <div className="flex items-stretch justify-between gap-3 pt-2">
      <button
        type="button"
        onClick={onPrev}
        disabled={!prevTitle}
        className={cx(
          'flex-1 max-w-[280px] rounded-xl border border-border-base bg-surface/40 backdrop-blur-soft px-4 py-3 text-left transition',
          'hover:border-accent/40 hover:bg-surface-2/40 disabled:opacity-30 disabled:cursor-not-allowed',
          'flex items-center gap-3',
        )}
      >
        <ArrowLeft size={16} className="text-fg-subtle" />
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-fg-subtle">
            {t('prevConcept')}
          </div>
          <div className="text-[13.5px] font-medium text-fg truncate">{prevTitle ?? '—'}</div>
        </div>
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={!nextTitle}
        className={cx(
          'flex-1 max-w-[280px] rounded-xl border border-border-base bg-surface/40 backdrop-blur-soft px-4 py-3 text-right transition',
          'hover:border-accent/40 hover:bg-surface-2/40 disabled:opacity-30 disabled:cursor-not-allowed',
          'flex items-center justify-end gap-3',
        )}
      >
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-fg-subtle">
            {t('nextConcept')}
          </div>
          <div className="text-[13.5px] font-medium text-fg truncate">{nextTitle ?? '—'}</div>
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
      <GlassSurface intensity="subtle" bordered className="rounded-2xl">
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-fg-subtle">
              <ListTree size={11} />
              {t('toc')}
            </div>
            <ProgressRing
              value={ratio}
              size={26}
              stroke={3}
              indicatorClassName={
                ratio === 1 ? 'text-emerald-400' : ratio > 0 ? 'text-accent' : 'text-fg-subtle'
              }
            />
          </div>
          {entries.length === 0 ? (
            <p className="text-[12px] text-fg-subtle">—</p>
          ) : (
            <ul className="space-y-1">
              {entries.map((entry) => (
                <li key={entry.id}>
                  <a
                    href={`#${entry.id}`}
                    className={cx(
                      'block py-1 text-[12.5px] leading-snug transition-colors duration-fast',
                      entry.level === 3 && 'pl-3 text-[12px]',
                      activeId === entry.id
                        ? 'text-accent font-medium'
                        : 'text-fg-muted hover:text-fg',
                    )}
                  >
                    {entry.text}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </GlassSurface>
    </aside>
  );
};

const TopicSkeleton = () => (
  <div className="space-y-6" aria-hidden>
    <Skeleton rounded="2xl" className="h-32" />
    <div className="grid grid-cols-1 lg:grid-cols-[244px_minmax(0,1fr)] xl:grid-cols-[244px_minmax(0,1fr)_220px] gap-6">
      <Skeleton rounded="2xl" className="h-72" />
      <Skeleton rounded="2xl" className="h-96" />
      <Skeleton rounded="2xl" className="hidden xl:block h-72" />
    </div>
  </div>
);
