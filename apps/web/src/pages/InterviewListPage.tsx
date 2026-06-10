import { useMemo, useState } from 'react';

import type { InterviewQuestionMeta, InterviewStage } from '@dotlearn/contracts';
import { Link } from '@tanstack/react-router';
import { CheckCircle2, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/Badge';
import { cx } from '@/components/ui/cx';
import { Surface } from '@/components/ui/Surface';
import {
  interviewCategories,
  interviewQuestions,
  interviewStages,
} from '@/lib/interview';
import { useInterviewStudiedIds } from '@/lib/use-interview';

type SortKey = 'default' | 'title' | 'topic' | 'stage';
type StatusFilter = 'all' | 'studied' | 'not-studied';

const STAGE_ORDER: InterviewStage[] = ['hr', 'tech', 'system-design'];

const stageTone: Record<InterviewStage, 'accent' | 'info' | 'success'> = {
  tech: 'accent',
  'system-design': 'info',
  hr: 'success',
};

const normalize = (value: string): string => value.toLowerCase().trim();

export const InterviewListPage = () => {
  const { t } = useTranslation('interview');
  const studiedIds = useInterviewStudiedIds();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [stage, setStage] = useState<string>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<SortKey>('default');

  const visible = useMemo(() => {
    const needle = normalize(query);
    const filtered = interviewQuestions.filter((question) => {
      if (category !== 'all' && question.category !== category) return false;
      if (stage !== 'all' && question.stage !== stage) return false;
      if (status === 'studied' && !studiedIds.has(question.id)) return false;
      if (status === 'not-studied' && studiedIds.has(question.id)) return false;
      if (needle && !normalize(question.title).includes(needle)) return false;
      return true;
    });

    const byTitle = (a: InterviewQuestionMeta, b: InterviewQuestionMeta): number =>
      a.title.localeCompare(b.title, 'ru');

    const sorted = [...filtered];
    if (sort === 'title') {
      sorted.sort(byTitle);
    } else if (sort === 'topic') {
      sorted.sort(
        (a, b) => a.categoryLabel.localeCompare(b.categoryLabel, 'ru') || byTitle(a, b),
      );
    } else if (sort === 'stage') {
      sorted.sort(
        (a, b) =>
          STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) || byTitle(a, b),
      );
    } else {
      sorted.sort((a, b) => a.id - b.id);
    }
    return sorted;
  }, [query, category, stage, status, sort, studiedIds]);

  const studiedCount = studiedIds.size;

  return (
    <div className="space-y-6">
      <header className="border-y border-border-base py-6 sm:py-8">
        <div className="eyebrow eyebrow-accent mb-3">{t('eyebrow')}</div>
        <h1 className="font-display font-medium text-[clamp(30px,5vw,48px)] leading-[1.1] tracking-tightish text-balance">
          {t('title')}
        </h1>
        <p className="mt-3 max-w-prose text-fg-muted leading-relaxed">{t('subtitle')}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 eyebrow text-fg-subtle">
          <span>{t('totalQuestions', { count: interviewQuestions.length })}</span>
          <span aria-hidden>·</span>
          <span>{t('categoriesCount', { count: interviewCategories.length })}</span>
          {studiedCount > 0 && (
            <>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1 text-ok">
                <CheckCircle2 size={12} />
                {t('studiedCount', { count: studiedCount })}
              </span>
            </>
          )}
        </div>
      </header>

      <Surface variant="chrome" className="p-3 sm:p-4">
        <div className="space-y-3">
          <label className="relative block">
            <Search
              size={16}
              aria-hidden
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('searchPlaceholder')}
              aria-label={t('searchPlaceholder')}
              className="form-input pl-10"
            />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <Field label={t('filterTopic')}>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="form-input"
              >
                <option value="all">{t('allTopics')}</option>
                {interviewCategories.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.label} ({item.count})
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('filterStage')}>
              <select
                value={stage}
                onChange={(event) => setStage(event.target.value)}
                className="form-input"
              >
                <option value="all">{t('allStages')}</option>
                {interviewStages.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.label} ({item.count})
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('filterStatus')}>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as StatusFilter)}
                className="form-input"
              >
                <option value="all">{t('statusAll')}</option>
                <option value="studied">{t('statusStudied')}</option>
                <option value="not-studied">{t('statusNotStudied')}</option>
              </select>
            </Field>
            <Field label={t('sortLabel')}>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                className="form-input"
              >
                <option value="default">{t('sortDefault')}</option>
                <option value="title">{t('sortTitle')}</option>
                <option value="topic">{t('sortTopic')}</option>
                <option value="stage">{t('sortStage')}</option>
              </select>
            </Field>
          </div>
        </div>
      </Surface>

      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow text-fg-subtle">
          {t('shownCount', { count: visible.length })}
        </span>
      </div>

      {visible.length === 0 ? (
        <Surface variant="inset">
          <p className="px-4 py-10 text-center text-sm text-fg-subtle italic">{t('empty')}</p>
        </Surface>
      ) : (
        <ul className="space-y-2.5">
          {visible.map((question) => (
            <li key={question.id}>
              <QuestionCard question={question} studied={studiedIds.has(question.id)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block">
    <span className="eyebrow text-[10px] text-fg-subtle mb-1 block">{label}</span>
    {children}
  </label>
);

const QuestionCard = ({
  question,
  studied,
}: {
  question: InterviewQuestionMeta;
  studied: boolean;
}) => (
  <Link to="/interview/$id" params={{ id: String(question.id) }} className="block">
    <Surface
      interactive
      className={cx('p-4 sm:p-5', studied && 'border-l-2 border-l-ok')}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-2.5">
          <h2 className="font-display text-[17px] sm:text-[18px] leading-snug tracking-snug text-fg text-balance">
            {question.title}
          </h2>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral">{question.categoryLabel}</Badge>
            <Badge tone={stageTone[question.stage]} variant="outline">
              {question.stageLabel}
            </Badge>
          </div>
        </div>
        {studied && (
          <CheckCircle2 size={18} className="shrink-0 text-ok" aria-label="studied" />
        )}
      </div>
    </Surface>
  </Link>
);
