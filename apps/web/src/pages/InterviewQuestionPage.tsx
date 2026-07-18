import { Suspense, useEffect, useMemo, useState } from 'react';

import type { Exercise, InterviewStage } from '@dotlearn/contracts';
import { Link, useParams } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Dumbbell, GraduationCap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ExerciseRunner } from '@/components/ExerciseRunner';
import { TheoryContent } from '@/components/TheoryContent';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { Skeleton } from '@/components/ui/Skeleton';
import { Surface } from '@/components/ui/Surface';
import { useForcedContentLanguage } from '@/lib/forced-language';
import { getCurrentLanguage } from '@/lib/i18n';
import {
  directionOf,
  filterByDirection,
  getInterviewComponentForLocale,
  getInterviewIndex,
  getInterviewQuestion,
  loadQuestionExercises,
  localizedInterviewTitle,
  relatedInterviewQuestions,
  relatedTopicsForQuestion,
} from '@/lib/interview';
import { directionLabel } from '@/lib/interview-directions';
import { db, INTERVIEW_TOPIC_SLUG, setInterviewStudied } from '@/lib/progress-db';
import { Seo } from '@/lib/seo';
import { topicTitleOf } from '@/lib/topics';
import { useInterviewStudied } from '@/lib/use-interview';

const stageTone: Record<InterviewStage, 'accent' | 'info' | 'success'> = {
  tech: 'accent',
  'system-design': 'info',
  hr: 'success',
};

export const InterviewQuestionPage = () => {
  const { id } = useParams({ strict: false }) as { id: string };
  const { t } = useTranslation('interview');
  const forcedLanguage = useForcedContentLanguage();
  const listTo = forcedLanguage === 'en' ? '/en/interview' : '/interview';
  const questionTo = forcedLanguage === 'en' ? '/en/interview/$id' : '/interview/$id';
  const numericId = Number(id);
  const question = Number.isFinite(numericId) ? getInterviewQuestion(numericId) : undefined;
  const studied = useInterviewStudied(question?.id ?? -1);
  const [exercises, setExercises] = useState<Exercise[] | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    if (!question) {
      setExercises([]);
      return;
    }
    setExercises(undefined);
    void loadQuestionExercises(question).then((list) => {
      if (!cancelled) setExercises(list);
    });
    return () => {
      cancelled = true;
    };
  }, [question]);

  const exerciseKeys = useMemo(
    () => (exercises ?? []).map((exercise) => `${INTERVIEW_TOPIC_SLUG}:${exercise.id}`),
    [exercises],
  );
  const passedRecords = useLiveQuery(
    () => db.progress.where('id').anyOf(exerciseKeys).toArray(),
    [exerciseKeys],
    [],
  );

  useEffect(() => {
    if (!question || studied || !exercises || exercises.length === 0) return;
    const passedCount = (passedRecords ?? []).filter((record) => record.status === 'pass').length;
    if (passedCount === exercises.length) {
      void setInterviewStudied(question.id, true);
    }
  }, [question, studied, exercises, passedRecords]);

  const questions = useMemo(() => {
    if (!question) return getInterviewIndex();
    const itemDirection = directionOf(question);
    if (!itemDirection) return getInterviewIndex();
    return filterByDirection(getInterviewIndex(), itemDirection);
  }, [question]);

  if (!question) {
    return (
      <Surface rule="left" className="border-l-err">
        <div className="p-6">
          <h1 className="font-display text-2xl text-err">{t('notFoundTitle')}</h1>
          <p className="mt-2 text-sm text-fg-muted">{t('notFoundBody')}</p>
          <Link to={listTo}>
            <Button variant="ghost" leadingIcon={<ArrowLeft size={14} />} className="mt-4">
              {t('backToList')}
            </Button>
          </Link>
        </div>
      </Surface>
    );
  }

  const locale = forcedLanguage ?? getCurrentLanguage();
  const Component = getInterviewComponentForLocale(question, locale);
  const related = relatedInterviewQuestions(question);
  const studyLinks = relatedTopicsForQuestion(question)
    .map((entry) => {
      const title = topicTitleOf(entry.slug);
      return title ? { ...entry, title } : undefined;
    })
    .filter(
      (entry): entry is { slug: string; conceptId?: string; title: string } => entry !== undefined,
    );
  const position = questions.findIndex((item) => item.id === question.id);
  const previous = position > 0 ? questions[position - 1] : undefined;
  const next =
    position >= 0 && position < questions.length - 1 ? questions[position + 1] : undefined;

  const toggleStudied = (): void => {
    void setInterviewStudied(question.id, !studied);
  };

  const questionDirection = directionOf(question);
  const questionTitle = localizedInterviewTitle(question, locale);
  const seoDescription =
    locale === 'en'
      ? `Interview prep: ${questionTitle}. ${question.stageLabel}${question.categoryLabel ? ` · ${question.categoryLabel}` : ''}. Free answer on .learn.`
      : `Подготовка к собеседованию: ${questionTitle}. ${question.stageLabel}${question.categoryLabel ? ` · ${question.categoryLabel}` : ''}. Разбор ответа на .learn.`;

  return (
    <div className="space-y-8">
      <Seo
        lang={forcedLanguage ?? 'ru'}
        title={questionTitle}
        description={seoDescription.slice(0, 200)}
        canonicalPath={
          forcedLanguage === 'en' ? `/en/interview/${question.id}` : `/interview/${question.id}`
        }
        alternates={{ ru: `/interview/${question.id}`, en: `/en/interview/${question.id}` }}
        ogType="article"
      />
      <div className="flex items-center justify-between gap-3">
        <Link to="/interview">
          <Button variant="ghost" leadingIcon={<ArrowLeft size={14} />}>
            {t('backToList')}
          </Button>
        </Link>
        <button
          type="button"
          onClick={toggleStudied}
          aria-pressed={studied}
          className={cx(
            'inline-flex items-center gap-2 rounded-full border px-3.5 min-h-[var(--tap)] sm:min-h-0 sm:py-1.5 text-[13px] font-medium transition-colors',
            studied
              ? 'border-ok/50 bg-ok/10 text-ok'
              : 'border-border-base text-fg-muted hover:text-fg hover:bg-fg/[0.04]',
          )}
        >
          {studied ? <CheckCircle2 size={15} /> : <Check size={15} />}
          {studied ? t('studied') : t('markStudied')}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {questionDirection && (
          <Badge tone="accent" variant="outline">
            {directionLabel(questionDirection, locale)}
          </Badge>
        )}
        <Badge tone="neutral">{question.categoryLabel}</Badge>
        <Badge tone={stageTone[question.stage]} variant="outline">
          {question.stageLabel}
        </Badge>
      </div>

      <article data-toc-root className="theory-root max-w-prose">
        {Component ? (
          <Suspense fallback={<Skeleton rounded="lg" className="h-64" />}>
            <TheoryContent Component={Component} />
          </Suspense>
        ) : (
          <p className="text-err text-sm">{t('contentMissing')}</p>
        )}
      </article>

      {exercises && exercises.length > 0 && (
        <section className="space-y-4 pt-6 border-t-2 border-fg/80">
          <div className="flex items-center gap-2">
            <Dumbbell size={18} className="text-accent" />
            <h2 className="font-display text-xl text-fg tracking-tightish">
              {t('practiceHeading')}
            </h2>
          </div>
          <p className="text-sm text-fg-muted">{t('practiceSubtitle')}</p>
          <div className="space-y-4">
            {exercises.map((exercise) => (
              <ExerciseRunner
                key={exercise.id}
                topicSlug={INTERVIEW_TOPIC_SLUG}
                exercise={exercise}
              />
            ))}
          </div>
        </section>
      )}

      {studyLinks.length > 0 && (
        <section className="space-y-3 pt-6 border-t-2 border-fg/80">
          <div className="flex items-center gap-2">
            <GraduationCap size={18} className="text-accent" />
            <h2 className="font-display text-xl text-fg tracking-tightish">{t('studyHeading')}</h2>
          </div>
          <p className="text-sm text-fg-muted">{t('studySubtitle')}</p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {studyLinks.map((link) => (
              <li key={link.conceptId ? `${link.slug}:${link.conceptId}` : link.slug}>
                <Link
                  to="/topics/$slug"
                  params={{ slug: link.slug }}
                  search={{ concept: link.conceptId }}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-border-base px-4 py-3 transition-colors hover:border-border-strong hover:bg-fg/[0.03]"
                >
                  <span className="text-[14px] text-fg leading-snug group-hover:underline decoration-accent/50 underline-offset-2">
                    {link.title}
                  </span>
                  <ArrowRight
                    size={15}
                    className="shrink-0 text-fg-subtle group-hover:text-accent transition-colors"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {related.length > 0 && (
        <section className="space-y-3 pt-6 border-t-2 border-fg/80">
          <h2 className="font-display text-xl text-fg tracking-tightish">
            {t('related', { category: question.categoryLabel })}
          </h2>
          <ul className="space-y-2">
            {related.map((item) => (
              <li key={item.id}>
                <Link
                  to={questionTo}
                  params={{ id: String(item.id) }}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-border-base px-4 py-3 transition-colors hover:border-border-strong hover:bg-fg/[0.03]"
                >
                  <span className="text-[14px] text-fg leading-snug group-hover:underline decoration-accent/50 underline-offset-2">
                    {localizedInterviewTitle(item, locale)}
                  </span>
                  <ArrowRight
                    size={15}
                    className="shrink-0 text-fg-subtle group-hover:text-accent transition-colors"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(previous || next) && (
        <nav className="flex items-stretch justify-between gap-3 pt-6 border-t border-border-base">
          {previous ? (
            <Link
              to={questionTo}
              params={{ id: String(previous.id) }}
              className="group flex flex-1 max-w-none sm:max-w-[280px] items-center gap-3 min-h-[var(--tap-comfort)] px-2 py-2 text-left"
            >
              <ArrowLeft
                size={16}
                className="shrink-0 text-fg-subtle group-hover:text-accent transition-colors"
              />
              <span className="min-w-0">
                <span className="eyebrow text-[10px] block">{t('previous')}</span>
                <span className="block text-[14px] font-serif text-fg truncate group-hover:underline decoration-accent/50 underline-offset-2">
                  {localizedInterviewTitle(previous, locale)}
                </span>
              </span>
            </Link>
          ) : (
            <span className="flex-1" />
          )}
          {next ? (
            <Link
              to={questionTo}
              params={{ id: String(next.id) }}
              className="group flex flex-1 max-w-none sm:max-w-[280px] items-center justify-end gap-3 min-h-[var(--tap-comfort)] px-2 py-2 text-right"
            >
              <span className="min-w-0">
                <span className="eyebrow text-[10px] block">{t('next')}</span>
                <span className="block text-[14px] font-serif text-fg truncate group-hover:underline decoration-accent/50 underline-offset-2">
                  {localizedInterviewTitle(next, locale)}
                </span>
              </span>
              <ArrowRight size={16} className="shrink-0 text-accent" />
            </Link>
          ) : (
            <span className="flex-1" />
          )}
        </nav>
      )}
    </div>
  );
};
