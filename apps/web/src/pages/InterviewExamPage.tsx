import { useEffect, useMemo, useState } from 'react';

import type { Exercise, InterviewExerciseMeta } from '@dotlearn/contracts';
import { Link } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight, GraduationCap, RotateCcw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ExerciseRunner } from '@/components/ExerciseRunner';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Surface } from '@/components/ui/Surface';
import {
  interviewExercises,
  interviewExerciseTypes,
  interviewDifficulties,
  loadExerciseById,
} from '@/lib/interview';
import { db, INTERVIEW_TOPIC_SLUG } from '@/lib/progress-db';
import { useInterviewStudiedIds } from '@/lib/use-interview';

interface Facet {
  slug: string;
  label: string;
  count: number;
}

const buildFacet = (pick: (meta: InterviewExerciseMeta) => { slug: string; label: string }): Facet[] => {
  const map = new Map<string, Facet>();
  for (const meta of interviewExercises) {
    const { slug, label } = pick(meta);
    const existing = map.get(slug);
    if (existing) existing.count += 1;
    else map.set(slug, { slug, label, count: 1 });
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'ru'));
};

const shuffle = <T,>(input: T[]): T[] => {
  const result = [...input];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
};

interface Session {
  pool: InterviewExerciseMeta[];
  index: number;
}

export const InterviewExamPage = () => {
  const { t } = useTranslation('interview');

  const categories = useMemo(
    () => buildFacet((meta) => ({ slug: meta.category, label: meta.categoryLabel })),
    [],
  );
  const stages = useMemo(
    () => buildFacet((meta) => ({ slug: meta.stage, label: meta.stageLabel })),
    [],
  );

  const [category, setCategory] = useState('all');
  const [stage, setStage] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [type, setType] = useState('all');
  const [studied, setStudied] = useState('all');
  const [count, setCount] = useState('10');
  const [session, setSession] = useState<Session | undefined>(undefined);
  const studiedIds = useInterviewStudiedIds();

  const matching = useMemo(
    () =>
      interviewExercises.filter((meta) => {
        if (category !== 'all' && meta.category !== category) return false;
        if (stage !== 'all' && meta.stage !== stage) return false;
        if (difficulty !== 'all' && String(meta.difficulty) !== difficulty) return false;
        if (type !== 'all' && meta.type !== type) return false;
        if (studied === 'studied' && !studiedIds.has(meta.qid)) return false;
        if (studied === 'not-studied' && studiedIds.has(meta.qid)) return false;
        return true;
      }),
    [category, stage, difficulty, type, studied, studiedIds],
  );

  const start = (): void => {
    const shuffled = shuffle(matching);
    const limit = count === 'all' ? shuffled.length : Number(count);
    setSession({ pool: shuffled.slice(0, limit), index: 0 });
  };

  if (session) {
    return <ExamSession session={session} setSession={setSession} />;
  }

  return (
    <div className="space-y-6">
      <header className="border-y border-border-base py-6 sm:py-8">
        <div className="eyebrow eyebrow-accent mb-3 flex items-center gap-2">
          <GraduationCap size={13} />
          {t('exam.eyebrow')}
        </div>
        <h1 className="font-display font-medium text-[clamp(28px,5vw,44px)] leading-[1.1] tracking-tightish text-balance">
          {t('exam.title')}
        </h1>
        <p className="mt-3 max-w-prose text-fg-muted leading-relaxed">{t('exam.subtitle')}</p>
      </header>

      <Surface variant="chrome" className="p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <ExamField label={t('exam.filterCategory')}>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="form-input">
              <option value="all">{t('allTopics')}</option>
              {categories.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.label} ({item.count})
                </option>
              ))}
            </select>
          </ExamField>
          <ExamField label={t('exam.filterStage')}>
            <select value={stage} onChange={(e) => setStage(e.target.value)} className="form-input">
              <option value="all">{t('allStages')}</option>
              {stages.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.label} ({item.count})
                </option>
              ))}
            </select>
          </ExamField>
          <ExamField label={t('exam.filterType')}>
            <select value={type} onChange={(e) => setType(e.target.value)} className="form-input">
              <option value="all">{t('exam.allTypes')}</option>
              {interviewExerciseTypes.map((value) => (
                <option key={value} value={value}>
                  {t(`exam.types.${value}`, { defaultValue: value })}
                </option>
              ))}
            </select>
          </ExamField>
          <ExamField label={t('exam.filterDifficulty')}>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
              className="form-input"
            >
              <option value="all">{t('exam.allDifficulties')}</option>
              {interviewDifficulties.map((value) => (
                <option key={value} value={String(value)}>
                  {t('exam.difficulty', { level: value })}
                </option>
              ))}
            </select>
          </ExamField>
          <ExamField label={t('filterStatus')}>
            <select value={studied} onChange={(e) => setStudied(e.target.value)} className="form-input">
              <option value="all">{t('statusAll')}</option>
              <option value="studied">{t('statusStudied')}</option>
              <option value="not-studied">{t('statusNotStudied')}</option>
            </select>
          </ExamField>
          <ExamField label={t('exam.filterCount')}>
            <select value={count} onChange={(e) => setCount(e.target.value)} className="form-input">
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="all">{t('exam.countAll')}</option>
            </select>
          </ExamField>
        </div>
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <Button onClick={start} disabled={matching.length === 0} className="w-full sm:w-auto">
            {t('exam.start')}
          </Button>
          <span className="text-sm text-fg-subtle">
            {t('exam.matching', { count: matching.length })}
          </span>
        </div>
      </Surface>

      <p className="text-sm text-fg-subtle">
        <Link to="/interview" className="text-accent hover:underline underline-offset-2">
          {t('exam.backToList')}
        </Link>
      </p>
    </div>
  );
};

const ExamField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="eyebrow text-[10px] text-fg-subtle mb-1 block">{label}</span>
    {children}
  </label>
);

interface ExamSessionProps {
  session: Session;
  setSession: (session: Session | undefined) => void;
}

const ExamSession = ({ session, setSession }: ExamSessionProps) => {
  const { t } = useTranslation('interview');
  const { pool, index } = session;
  const current = pool[index];
  const [exercise, setExercise] = useState<Exercise | undefined>(undefined);
  const finished = index >= pool.length;

  const progressIds = useMemo(
    () => pool.map((meta) => `${INTERVIEW_TOPIC_SLUG}:${meta.exerciseId}`),
    [pool],
  );
  const records = useLiveQuery(
    () => db.progress.where('id').anyOf(progressIds).toArray(),
    [progressIds],
    [],
  );
  const statusByExercise = useMemo(() => {
    const map = new Map<string, string>();
    for (const record of records ?? []) map.set(record.exerciseId, record.status);
    return map;
  }, [records]);
  const passed = pool.filter((meta) => statusByExercise.get(meta.exerciseId) === 'pass').length;
  const byType = useMemo(() => {
    const acc: Record<string, { passed: number; total: number }> = {};
    for (const meta of pool) {
      const entry = (acc[meta.type] ??= { passed: 0, total: 0 });
      entry.total += 1;
      if (statusByExercise.get(meta.exerciseId) === 'pass') entry.passed += 1;
    }
    return acc;
  }, [pool, statusByExercise]);

  useEffect(() => {
    let cancelled = false;
    setExercise(undefined);
    if (!current) return;
    void loadExerciseById(current).then((loaded) => {
      if (!cancelled) setExercise(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [current]);

  if (finished) {
    return (
      <div className="space-y-6">
        <Surface variant="accent" className="p-8 text-center">
          <GraduationCap size={32} className="mx-auto text-accent" />
          <h1 className="mt-3 font-display text-2xl text-fg">{t('exam.doneTitle')}</h1>
          <div className="mt-3 inline-flex items-baseline gap-2">
            <span className="font-display text-4xl text-accent tabular-nums">{passed}</span>
            <span className="text-fg-subtle">
              / {pool.length} {t('exam.solvedWord')}
            </span>
          </div>
          <ul className="mt-4 mx-auto max-w-xs space-y-1.5 text-left">
            {Object.entries(byType).map(([type, score]) => (
              <li key={type} className="flex items-center justify-between text-[13px]">
                <span className="text-fg-muted">
                  {t(`exam.types.${type}`, { defaultValue: type })}
                </span>
                <span className="tabular-nums text-fg">
                  {score.passed}/{score.total}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-col sm:flex-row justify-center gap-3">
            <Button onClick={() => setSession(undefined)} leadingIcon={<RotateCcw size={14} />}>
              {t('exam.restart')}
            </Button>
            <Link to="/interview">
              <Button variant="ghost" className="w-full sm:w-auto">
                {t('exam.backToList')}
              </Button>
            </Link>
          </div>
        </Surface>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center justify-between text-[12px] text-fg-subtle mb-1.5 tabular-nums">
            <span>{t('exam.progress', { current: index + 1, total: pool.length })}</span>
            {current && <span>{current.categoryLabel}</span>}
          </div>
          <div className="h-1 rounded-full bg-surface-2 overflow-hidden">
            <div
              className="h-full bg-accent transition-[width] duration-med"
              style={{ width: `${Math.round((index / pool.length) * 100)}%` }}
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setSession(undefined)}
          aria-label={t('exam.exit')}
          className="shrink-0 grid place-items-center size-11 rounded-xl border border-border-base text-fg-muted hover:text-fg hover:bg-surface-2/40 transition-colors"
        >
          <X size={18} />
        </button>
      </div>

      {exercise ? (
        <ExerciseRunner key={`${current?.path}:${current?.exerciseId}`} topicSlug={INTERVIEW_TOPIC_SLUG} exercise={exercise} />
      ) : current ? (
        <Skeleton rounded="2xl" className="h-56" />
      ) : (
        <p className="text-sm text-err">{t('exam.loadError')}</p>
      )}

      <div className="flex justify-end">
        <Button
          onClick={() => setSession({ pool, index: index + 1 })}
          trailingIcon={<ArrowRight size={14} />}
        >
          {index + 1 >= pool.length ? t('exam.finish') : t('exam.next')}
        </Button>
      </div>
    </div>
  );
};
