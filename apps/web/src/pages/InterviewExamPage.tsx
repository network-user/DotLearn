import { useEffect, useMemo, useRef, useState } from 'react';

import type { Exercise, InterviewDirection, InterviewExerciseMeta } from '@dotlearn/contracts';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  History,
  MinusCircle,
  RotateCcw,
  X,
  XCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ExerciseRunner } from '@/components/ExerciseRunner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Surface } from '@/components/ui/Surface';
import type { InterviewExamSearch } from '@/router';
import {
  filterByDirection,
  getInterviewDifficulties,
  getInterviewExerciseTypes,
  getInterviewExercisesIndex,
  getInterviewQuestion,
  loadExerciseById,
  localizedInterviewTitle,
  relatedTopicsForQuestion,
} from '@/lib/interview';
import {
  directionLabel,
  getInterviewDirections,
  isInterviewDirection,
  readStoredInterviewDirection,
  writeStoredInterviewDirection,
} from '@/lib/interview-directions';
import { getCurrentLanguage } from '@/lib/i18n';
import {
  db,
  INTERVIEW_TOPIC_SLUG,
  recordExamResult,
  type ExamResultRecord,
  type ExamScoreBucket,
} from '@/lib/progress-db';
import { Seo } from '@/lib/seo';
import { topicTitleOf } from '@/lib/topics';
import { useExamResults, useInterviewStudiedIds } from '@/lib/use-interview';

const EXAM_SCOPE = 'interview';

interface Facet {
  slug: string;
  label: string;
  count: number;
}

const buildFacet = (
  items: InterviewExerciseMeta[],
  pick: (meta: InterviewExerciseMeta) => { slug: string; label: string },
): Facet[] => {
  const map = new Map<string, Facet>();
  for (const meta of items) {
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
  startedAt: number;
  baseline: Record<string, string>;
  filters: Record<string, string>;
}

export const InterviewExamPage = () => {
  const { t } = useTranslation('interview');
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as InterviewExamSearch;
  const locale = getCurrentLanguage();
  const activeDirection: InterviewDirection =
    search.direction && isInterviewDirection(search.direction)
      ? search.direction
      : (readStoredInterviewDirection() ?? 'python');

  const directionExercises = useMemo(
    () => filterByDirection(getInterviewExercisesIndex(), activeDirection),
    [activeDirection],
  );

  const categories = useMemo(
    () =>
      buildFacet(directionExercises, (meta) => ({
        slug: meta.category,
        label: meta.categoryLabel,
      })),
    [directionExercises],
  );
  const stages = useMemo(
    () => buildFacet(directionExercises, (meta) => ({ slug: meta.stage, label: meta.stageLabel })),
    [directionExercises],
  );

  const [category, setCategory] = useState('all');
  const [stage, setStage] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [type, setType] = useState('all');
  const [studied, setStudied] = useState('all');
  const [count, setCount] = useState('10');
  const [session, setSession] = useState<Session | undefined>(undefined);
  const studiedIds = useInterviewStudiedIds();
  const pastExams = useExamResults(EXAM_SCOPE);

  useEffect(() => {
    if (search.direction !== activeDirection) {
      void navigate({
        to: '/interview/exam',
        search: { direction: activeDirection },
        replace: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const matching = useMemo(
    () =>
      directionExercises.filter((meta) => {
        if (category !== 'all' && meta.category !== category) return false;
        if (stage !== 'all' && meta.stage !== stage) return false;
        if (difficulty !== 'all' && String(meta.difficulty) !== difficulty) return false;
        if (type !== 'all' && meta.type !== type) return false;
        if (studied === 'studied' && !studiedIds.has(meta.qid)) return false;
        if (studied === 'not-studied' && studiedIds.has(meta.qid)) return false;
        return true;
      }),
    [directionExercises, category, stage, difficulty, type, studied, studiedIds],
  );

  const setDirection = (value: InterviewDirection): void => {
    writeStoredInterviewDirection(value);
    setCategory('all');
    setStage('all');
    void navigate({
      to: '/interview/exam',
      search: { direction: value },
      replace: true,
    });
  };

  const start = async (): Promise<void> => {
    const shuffled = shuffle(matching);
    const limit = count === 'all' ? shuffled.length : Number(count);
    const pool = shuffled.slice(0, limit);
    const ids = pool.map((meta) => `${INTERVIEW_TOPIC_SLUG}:${meta.exerciseId}`);
    const existing = await db.progress.where('id').anyOf(ids).toArray();
    const baseline: Record<string, string> = {};
    for (const record of existing) baseline[record.exerciseId] = record.lastAttemptAt;
    setSession({
      pool,
      index: 0,
      startedAt: Date.now(),
      baseline,
      filters: { direction: activeDirection, category, stage, difficulty, type, studied },
    });
  };

  if (session) {
    return (
      <ExamSession
        session={session}
        setSession={setSession}
        directionLabel={directionLabel(activeDirection, locale)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Seo robots="noindex,nofollow" title={t('exam.title')} />
      <header className="border-y border-border-base py-6 sm:py-8">
        <div className="eyebrow eyebrow-accent mb-3 flex items-center gap-2">
          <GraduationCap size={13} />
          {t('exam.eyebrow')}
        </div>
        <h1 className="font-display font-medium text-[clamp(28px,5vw,44px)] leading-[1.1] tracking-tightish text-balance">
          {t('exam.title')}
        </h1>
        <p className="mt-3 max-w-prose text-fg-muted leading-relaxed">{t('exam.subtitle')}</p>
        <div className="mt-4">
          <Badge tone="accent" variant="outline">
            {directionLabel(activeDirection, locale)}
          </Badge>
        </div>
      </header>

      <Surface variant="chrome" className="p-3 sm:p-4">
        <div className="eyebrow text-fg-subtle mb-2">{t('filterDirection')}</div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {getInterviewDirections().map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setDirection(entry.id)}
              aria-pressed={activeDirection === entry.id}
              className={`shrink-0 rounded-full border px-4 min-h-[var(--tap)] sm:min-h-0 sm:py-2 text-[13px] font-medium transition-colors ${
                activeDirection === entry.id
                  ? 'border-accent/70 bg-accent/[0.16] text-accent'
                  : 'border-border-base text-fg-muted hover:text-fg hover:bg-fg/[0.04]'
              }`}
            >
              {directionLabel(entry.id, locale)}
            </button>
          ))}
        </div>
      </Surface>

      <Surface variant="chrome" className="p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <ExamField label={t('exam.filterCategory')}>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="form-input"
            >
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
              {getInterviewExerciseTypes().map((value) => (
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
              {getInterviewDifficulties().map((value) => (
                <option key={value} value={String(value)}>
                  {t('exam.difficulty', { level: value })}
                </option>
              ))}
            </select>
          </ExamField>
          <ExamField label={t('filterStatus')}>
            <select
              value={studied}
              onChange={(e) => setStudied(e.target.value)}
              className="form-input"
            >
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
          <Button
            onClick={() => void start()}
            disabled={matching.length === 0}
            className="w-full sm:w-auto"
          >
            {t('exam.start')}
          </Button>
          <span className="text-sm text-fg-subtle">
            {t('exam.matching', { count: matching.length })}
          </span>
        </div>
      </Surface>

      <PastExams exams={pastExams} />

      <p className="text-sm text-fg-subtle">
        <Link
          to="/interview"
          search={{ direction: activeDirection }}
          className="text-accent hover:underline underline-offset-2"
        >
          {t('exam.backToList')}
        </Link>
      </p>
    </div>
  );
};

const scorePercent = (exam: ExamResultRecord): number =>
  exam.total > 0 ? Math.round((exam.correct / exam.total) * 100) : 0;

const PastExams = ({ exams }: { exams: ExamResultRecord[] }) => {
  const { t } = useTranslation('interview');
  if (exams.length === 0) return null;

  const last = exams[0] as ExamResultRecord;
  const best = exams.reduce((acc, exam) => (scorePercent(exam) > scorePercent(acc) ? exam : acc));
  const trend = [...exams].reverse().map(scorePercent);

  return (
    <Surface variant="chrome" className="p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2">
        <History size={16} className="text-accent" />
        <h2 className="font-display text-lg text-fg tracking-tightish">{t('exam.pastTitle')}</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 sm:items-center">
        <div className="flex gap-5">
          <div>
            <p className="eyebrow text-[10px] text-fg-subtle">{t('exam.lastScore')}</p>
            <p className="font-display text-2xl text-fg tabular-nums">
              {scorePercent(last)}
              <span className="text-base text-fg-subtle">%</span>
            </p>
            <p className="text-[11px] text-fg-subtle tabular-nums">
              {last.correct}/{last.total}
            </p>
          </div>
          <div>
            <p className="eyebrow text-[10px] text-fg-subtle">{t('exam.bestScore')}</p>
            <p className="font-display text-2xl text-accent tabular-nums">
              {scorePercent(best)}
              <span className="text-base text-accent/70">%</span>
            </p>
            <p className="text-[11px] text-fg-subtle tabular-nums">
              {best.correct}/{best.total}
            </p>
          </div>
        </div>
        {trend.length > 1 && <ScoreTrend values={trend} />}
      </div>
      <ul className="mt-4 space-y-1.5">
        {exams.map((exam) => (
          <li
            key={exam.id}
            className="flex items-center justify-between gap-3 text-[12.5px] text-fg-muted tabular-nums"
          >
            <span>{new Date(exam.finishedAt).toLocaleDateString(undefined, dateOpts)}</span>
            <span className="text-fg">
              {scorePercent(exam)}% · {exam.correct}/{exam.total}
            </span>
          </li>
        ))}
      </ul>
    </Surface>
  );
};

const dateOpts: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

const ScoreTrend = ({ values }: { values: number[] }) => {
  const width = 132;
  const height = 36;
  const max = 100;
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const points = values
    .map((value, index) => {
      const x = index * step;
      const y = height - (value / max) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className="text-accent shrink-0 justify-self-start sm:justify-self-end"
      role="img"
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
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
  directionLabel: string;
}

const ExamSession = ({ session, setSession, directionLabel: directionBadge }: ExamSessionProps) => {
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
  const recordByExercise = useMemo(() => {
    const map = new Map<string, { status: string; lastAttemptAt: string }>();
    for (const record of records ?? [])
      map.set(record.exerciseId, { status: record.status, lastAttemptAt: record.lastAttemptAt });
    return map;
  }, [records]);

  const attemptedInSession = (meta: InterviewExerciseMeta): boolean => {
    const record = recordByExercise.get(meta.exerciseId);
    if (!record) return false;
    return record.lastAttemptAt !== session.baseline[meta.exerciseId];
  };

  type ItemResult = 'pass' | 'fail' | 'skipped';
  const resultOf = (meta: InterviewExerciseMeta): ItemResult => {
    if (!attemptedInSession(meta)) return 'skipped';
    return recordByExercise.get(meta.exerciseId)?.status === 'pass' ? 'pass' : 'fail';
  };

  const correct = pool.filter((meta) => resultOf(meta) === 'pass').length;

  const buckets = useMemo(() => {
    const byType: Record<string, ExamScoreBucket> = {};
    const byDifficulty: Record<string, ExamScoreBucket> = {};
    for (const meta of pool) {
      const typeBucket = (byType[meta.type] ??= { total: 0, correct: 0 });
      const diffKey = String(meta.difficulty);
      const diffBucket = (byDifficulty[diffKey] ??= { total: 0, correct: 0 });
      typeBucket.total += 1;
      diffBucket.total += 1;
      if (resultOf(meta) === 'pass') {
        typeBucket.correct += 1;
        diffBucket.correct += 1;
      }
    }
    return { byType, byDifficulty };
  }, [pool, recordByExercise, session.baseline]);

  const persistedRef = useRef(false);
  useEffect(() => {
    if (!finished || persistedRef.current) return;
    if (records === undefined) return;
    persistedRef.current = true;
    const finishedAt = new Date();
    void recordExamResult({
      scope: EXAM_SCOPE,
      filters: session.filters,
      total: pool.length,
      correct,
      byType: buckets.byType,
      byDifficulty: buckets.byDifficulty,
      durationMs: finishedAt.getTime() - session.startedAt,
      startedAt: new Date(session.startedAt).toISOString(),
      finishedAt: finishedAt.toISOString(),
    });
  }, [finished, records, correct, buckets, pool.length, session]);

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
      <ExamDebrief
        session={session}
        setSession={setSession}
        resultOf={resultOf}
        buckets={buckets}
        correct={correct}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center justify-between text-[12px] text-fg-subtle mb-1.5 tabular-nums">
            <span>{t('exam.progress', { current: index + 1, total: pool.length })}</span>
            <span className="flex items-center gap-2">
              <Badge tone="accent" variant="outline">
                {directionBadge}
              </Badge>
              {current && <span>{current.categoryLabel}</span>}
            </span>
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
        <ExerciseRunner
          key={`${current?.path}:${current?.exerciseId}`}
          topicSlug={INTERVIEW_TOPIC_SLUG}
          exercise={exercise}
        />
      ) : current ? (
        <Skeleton rounded="2xl" className="h-56" />
      ) : (
        <p className="text-sm text-err">{t('exam.loadError')}</p>
      )}

      <div className="flex justify-end">
        <Button
          onClick={() => setSession({ ...session, index: index + 1 })}
          trailingIcon={<ArrowRight size={14} />}
        >
          {index + 1 >= pool.length ? t('exam.finish') : t('exam.next')}
        </Button>
      </div>
    </div>
  );
};

interface DebriefProps {
  session: Session;
  setSession: (session: Session | undefined) => void;
  resultOf: (meta: InterviewExerciseMeta) => 'pass' | 'fail' | 'skipped';
  buckets: {
    byType: Record<string, ExamScoreBucket>;
    byDifficulty: Record<string, ExamScoreBucket>;
  };
  correct: number;
}

const ExamDebrief = ({ session, setSession, resultOf, buckets, correct }: DebriefProps) => {
  const { t } = useTranslation('interview');
  const { pool } = session;
  const total = pool.length;
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
  const readiness = readinessLevel(percent);

  const retry = (meta: InterviewExerciseMeta): void => {
    const baseline = { ...session.baseline };
    delete baseline[meta.exerciseId];
    setSession({ ...session, pool: [meta], index: 0, startedAt: Date.now(), baseline });
  };

  const restartMissed = (): void => {
    const missed = pool.filter((meta) => resultOf(meta) !== 'pass');
    if (missed.length === 0) return;
    const baseline = { ...session.baseline };
    for (const meta of missed) delete baseline[meta.exerciseId];
    setSession({ ...session, pool: missed, index: 0, startedAt: Date.now(), baseline });
  };

  const missedCount = pool.filter((meta) => resultOf(meta) !== 'pass').length;

  return (
    <div className="space-y-6">
      <Surface variant="accent" className="p-6 sm:p-8 text-center">
        <GraduationCap size={30} className="mx-auto text-accent" />
        <h1 className="mt-3 font-display text-2xl text-fg">{t('exam.doneTitle')}</h1>
        <div className="mt-3 inline-flex items-baseline gap-2">
          <span className="font-display text-4xl text-accent tabular-nums">{percent}%</span>
          <span className="text-fg-subtle tabular-nums">
            {correct} / {total} {t('exam.solvedWord')}
          </span>
        </div>
        <p className="mt-2 text-sm text-fg-muted">{t(`exam.readiness.${readiness}`)}</p>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
          <ScoreBreakdown title={t('exam.byType')} buckets={buckets.byType} labelKey="exam.types" />
          <ScoreBreakdown
            title={t('exam.byDifficulty')}
            buckets={buckets.byDifficulty}
            difficulty
          />
        </div>

        <div className="mt-5 flex flex-col sm:flex-row justify-center gap-3">
          <Button onClick={() => setSession(undefined)} leadingIcon={<RotateCcw size={14} />}>
            {t('exam.restart')}
          </Button>
          {missedCount > 0 && (
            <Button variant="outline" onClick={restartMissed} className="w-full sm:w-auto">
              {t('exam.retryMissed', { count: missedCount })}
            </Button>
          )}
          <Link to="/interview">
            <Button variant="ghost" className="w-full sm:w-auto">
              {t('exam.backToList')}
            </Button>
          </Link>
        </div>
        <p className="mt-4 text-[11px] text-fg-subtle leading-relaxed max-w-prose mx-auto">
          {t('exam.gradingNote')}
        </p>
      </Surface>

      <section className="space-y-3">
        <h2 className="font-display text-xl text-fg tracking-tightish">{t('exam.reviewTitle')}</h2>
        <ul className="space-y-3">
          {pool.map((meta, position) => (
            <DebriefItem
              key={`${meta.path}:${meta.exerciseId}`}
              meta={meta}
              position={position}
              result={resultOf(meta)}
              onRetry={() => retry(meta)}
            />
          ))}
        </ul>
      </section>
    </div>
  );
};

const readinessLevel = (percent: number): 'low' | 'medium' | 'high' =>
  percent >= 80 ? 'high' : percent >= 50 ? 'medium' : 'low';

interface ScoreBreakdownProps {
  title: string;
  buckets: Record<string, ExamScoreBucket>;
  labelKey?: string;
  difficulty?: boolean;
}

const ScoreBreakdown = ({ title, buckets, labelKey, difficulty }: ScoreBreakdownProps) => {
  const { t } = useTranslation('interview');
  const entries = Object.entries(buckets).sort((a, b) => a[0].localeCompare(b[0]));
  if (entries.length === 0) return null;
  return (
    <div className="rounded-xl border border-border-base bg-surface/60 p-3.5">
      <p className="eyebrow text-[10px] text-fg-subtle mb-2">{title}</p>
      <ul className="space-y-1.5">
        {entries.map(([key, bucket]) => (
          <li key={key} className="flex items-center justify-between gap-3 text-[13px]">
            <span className="text-fg-muted truncate">
              {difficulty
                ? t('exam.difficulty', { level: key })
                : t(`${labelKey}.${key}`, { defaultValue: key })}
            </span>
            <span className="tabular-nums text-fg">
              {bucket.correct}/{bucket.total}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

interface DebriefItemProps {
  meta: InterviewExerciseMeta;
  position: number;
  result: 'pass' | 'fail' | 'skipped';
  onRetry: () => void;
}

const DebriefItem = ({ meta, position, result, onRetry }: DebriefItemProps) => {
  const { t } = useTranslation('interview');
  const [exercise, setExercise] = useState<Exercise | undefined>(undefined);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadExerciseById(meta).then((loaded) => {
      if (!cancelled) setExercise(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [meta]);

  const question = getInterviewQuestion(meta.qid);
  const locale = getCurrentLanguage();
  const conceptLink = useMemo(() => {
    if (!question) return undefined;
    const related = relatedTopicsForQuestion(question);
    const first = related.find((entry) => topicTitleOf(entry.slug));
    if (!first) return undefined;
    return {
      slug: first.slug,
      conceptId: first.conceptId,
      title: topicTitleOf(first.slug) as string,
    };
  }, [question]);

  const tone =
    result === 'pass'
      ? { ring: 'border-l-2 border-l-ok', icon: <CheckCircle2 size={16} className="text-ok" /> }
      : result === 'fail'
        ? { ring: 'border-l-2 border-l-err', icon: <XCircle size={16} className="text-err" /> }
        : {
            ring: 'border-l-2 border-l-warn',
            icon: <MinusCircle size={16} className="text-warn" />,
          };

  return (
    <li>
      <Surface className={tone.ring}>
        <div className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0">{tone.icon}</span>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[12px] uppercase tracking-widest text-fg-subtle tabular-nums">
                  {position + 1}
                </span>
                <Badge tone="neutral" variant="outline">
                  {t(`exam.types.${meta.type}`, { defaultValue: meta.type })}
                </Badge>
                <Badge tone="neutral" variant="outline">
                  {t('exam.difficulty', { level: meta.difficulty })}
                </Badge>
                <span className="text-[12px] text-fg-subtle">{meta.categoryLabel}</span>
              </div>
              <p className="text-sm text-fg leading-snug">
                {exercise ? exercise.prompt : <Skeleton className="h-4 w-2/3" />}
              </p>
            </div>
          </div>

          {exercise && (
            <div className="pl-7 space-y-2">
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-accent hover:underline underline-offset-2 min-h-[var(--tap)] sm:min-h-0"
              >
                <BookOpen size={13} />
                {expanded ? t('exam.hideAnswer') : t('exam.showAnswer')}
              </button>
              {expanded && <AnswerSummary exercise={exercise} />}
            </div>
          )}

          <div className="pl-7 flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              leadingIcon={<RotateCcw size={13} />}
              className="w-full sm:w-auto"
            >
              {t('exam.retry')}
            </Button>
            {conceptLink ? (
              <Link
                to="/topics/$slug"
                params={{ slug: conceptLink.slug }}
                search={{ concept: conceptLink.conceptId }}
                className="w-full sm:w-auto"
              >
                <Button
                  variant="ghost"
                  size="sm"
                  trailingIcon={<ArrowRight size={13} />}
                  className="w-full sm:w-auto"
                >
                  {t('exam.studyConcept', { title: conceptLink.title })}
                </Button>
              </Link>
            ) : question ? (
              <Link
                to="/interview/$id"
                params={{ id: String(question.id) }}
                className="w-full sm:w-auto"
              >
                <Button
                  variant="ghost"
                  size="sm"
                  trailingIcon={<ArrowRight size={13} />}
                  className="w-full sm:w-auto"
                >
                  {t('exam.studyQuestion', {
                    title: localizedInterviewTitle(question, locale),
                  })}
                </Button>
              </Link>
            ) : null}
          </div>
        </div>
      </Surface>
    </li>
  );
};

const AnswerSummary = ({ exercise }: { exercise: Exercise }) => {
  const { t } = useTranslation('interview');
  const lines = answerLines(exercise);
  const explanation = exercise.type === 'theory-quiz' ? exercise.explanation : undefined;
  return (
    <div className="rounded-lg border border-ok/30 bg-ok/8 px-3.5 py-2.5 text-[13px] text-fg space-y-1.5">
      <p className="font-medium text-ok">{t('exam.correctAnswer')}</p>
      {lines.map((line, i) => (
        <pre
          key={i}
          className="whitespace-pre-wrap break-words font-mono text-[12.5px] text-fg leading-relaxed"
        >
          {line}
        </pre>
      ))}
      {explanation && <p className="text-fg-muted leading-relaxed">{explanation}</p>}
    </div>
  );
};

const stringifyExpected = (expected: unknown): string => {
  if (typeof expected !== 'object' || expected === null) return String(expected);
  const value = expected as { kind?: string; value?: unknown; rows?: unknown };
  if (value.kind === 'scalar' || value.kind === 'stdout') return JSON.stringify(value.value);
  if (value.kind === 'result-set') return JSON.stringify(value.rows, null, 2);
  return JSON.stringify(expected);
};

const answerLines = (exercise: Exercise): string[] => {
  switch (exercise.type) {
    case 'theory-quiz': {
      const correct = exercise.choices.filter((choice) => exercise.correct.includes(choice.id));
      return correct.map((choice) => `• ${choice.text}`);
    }
    case 'predict-output':
      return [stringifyExpected(exercise.expected)];
    case 'fill-in-blanks':
      return Object.entries(exercise.blanks).map(([blank, spec]) => {
        const accept = spec.accept?.[0] ?? spec.accept_regex ?? '';
        return `${blank} = ${accept}`;
      });
    case 'sql-query':
    case 'python-function':
    case 'javascript-function':
      return [exercise.solution];
    case 'git-challenge':
      return exercise.solution;
    default:
      return [];
  }
};
