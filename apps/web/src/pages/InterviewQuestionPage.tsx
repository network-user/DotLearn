import { Suspense } from 'react';

import type { InterviewStage } from '@dotlearn/contracts';
import { Link, useParams } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, Check, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { TheoryContent } from '@/components/TheoryContent';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { Skeleton } from '@/components/ui/Skeleton';
import { Surface } from '@/components/ui/Surface';
import {
  getInterviewComponent,
  getInterviewQuestion,
  relatedInterviewQuestions,
} from '@/lib/interview';
import { setInterviewStudied } from '@/lib/progress-db';
import { useInterviewStudied } from '@/lib/use-interview';

const stageTone: Record<InterviewStage, 'accent' | 'info' | 'success'> = {
  tech: 'accent',
  'system-design': 'info',
  hr: 'success',
};

export const InterviewQuestionPage = () => {
  const { id } = useParams({ from: '/interview/$id' });
  const { t } = useTranslation('interview');
  const numericId = Number(id);
  const question = Number.isFinite(numericId) ? getInterviewQuestion(numericId) : undefined;
  const studied = useInterviewStudied(question?.id ?? -1);

  if (!question) {
    return (
      <Surface rule="left" className="border-l-err">
        <div className="p-6">
          <h1 className="font-display text-2xl text-err">{t('notFoundTitle')}</h1>
          <p className="mt-2 text-sm text-fg-muted">{t('notFoundBody')}</p>
          <Link to="/interview">
            <Button variant="ghost" leadingIcon={<ArrowLeft size={14} />} className="mt-4">
              {t('backToList')}
            </Button>
          </Link>
        </div>
      </Surface>
    );
  }

  const Component = getInterviewComponent(question.path);
  const related = relatedInterviewQuestions(question);

  const toggleStudied = (): void => {
    void setInterviewStudied(question.id, !studied);
  };

  return (
    <div className="space-y-8">
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

      {related.length > 0 && (
        <section className="space-y-3 pt-6 border-t-2 border-fg/80">
          <h2 className="font-display text-xl text-fg tracking-tightish">
            {t('related', { category: question.categoryLabel })}
          </h2>
          <ul className="space-y-2">
            {related.map((item) => (
              <li key={item.id}>
                <Link
                  to="/interview/$id"
                  params={{ id: String(item.id) }}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-border-base px-4 py-3 transition-colors hover:border-border-strong hover:bg-fg/[0.03]"
                >
                  <span className="text-[14px] text-fg leading-snug group-hover:underline decoration-accent/50 underline-offset-2">
                    {item.title}
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
    </div>
  );
};
