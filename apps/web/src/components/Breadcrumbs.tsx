import { useEffect, useMemo, useState } from 'react';

import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { topicTitleOf } from '@/lib/topics';

interface Crumb {
  label: string;
  to: string;
}

const titleizeSlug = (slug: string): string =>
  slug
    .split('-')
    .map((part) => (part.length > 0 ? part[0]?.toUpperCase() + part.slice(1) : ''))
    .join(' ');

const KNOWN_SEGMENT_KEYS: Record<string, string> = {
  topics: 'topics',
  interview: 'interview',
  progress: 'progress',
  admin: 'admin',
  flashcards: 'flashcards',
  search: 'openSearch',
};

const interviewQuestionId = (segments: string[]): number | undefined => {
  const index = segments.indexOf('interview');
  if (index === -1) return undefined;
  const next = segments[index + 1];
  if (next === undefined || !/^\d+$/.test(next)) return undefined;
  return Number(next);
};

export const Breadcrumbs = () => {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { t } = useTranslation('nav');
  const [interviewTitle, setInterviewTitle] = useState<{ id: number; title: string } | null>(null);

  const segments = useMemo(() => pathname.split('/').filter(Boolean), [pathname]);
  const questionId = interviewQuestionId(segments);

  // The interview index is ~450KB; it is loaded lazily here (only on an interview
  // question route) so it never reaches the entry chunk through the root layout.
  useEffect(() => {
    if (questionId === undefined) {
      setInterviewTitle(null);
      return;
    }
    let active = true;
    void import('@/lib/interview').then((module) => {
      const title = module.interviewTitleOf(questionId);
      if (active && title) {
        setInterviewTitle({ id: questionId, title });
      }
    });
    return () => {
      active = false;
    };
  }, [questionId]);

  if (pathname === '/' || pathname === '') {
    return null;
  }

  const crumbs: Crumb[] = [{ label: t('home'), to: '/' }];
  let accumulated = '';
  let previousSegment: string | undefined;
  for (const segment of segments) {
    accumulated += `/${segment}`;
    const navKey = KNOWN_SEGMENT_KEYS[segment];
    const topicTitle = previousSegment === 'topics' ? topicTitleOf(segment) : undefined;
    const interviewLabel =
      previousSegment === 'interview' && /^\d+$/.test(segment)
        ? interviewTitle?.id === Number(segment)
          ? interviewTitle.title
          : `#${segment}`
        : undefined;
    crumbs.push({
      label: navKey ? t(navKey) : (interviewLabel ?? topicTitle ?? titleizeSlug(segment)),
      to: accumulated,
    });
    previousSegment = segment;
  }

  return (
    <nav className="text-xs text-fg-subtle" aria-label={t('breadcrumb')}>
      <ol className="flex items-center flex-wrap gap-1">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li key={crumb.to} className="flex items-center gap-1">
              {index > 0 && <span aria-hidden>›</span>}
              {isLast ? (
                <span className="text-fg" aria-current="page">
                  {crumb.label}
                </span>
              ) : (
                <Link to={crumb.to} className="hover:text-fg">
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
