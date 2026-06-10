import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { interviewTitleOf } from '@/lib/interview';
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
  settings: 'settings',
};

export const Breadcrumbs = () => {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { t } = useTranslation('nav');

  if (pathname === '/' || pathname === '') {
    return null;
  }
  const segments = pathname.split('/').filter(Boolean);
  const crumbs: Crumb[] = [{ label: t('home'), to: '/' }];
  let accumulated = '';
  let previousSegment: string | undefined;
  for (const segment of segments) {
    accumulated += `/${segment}`;
    const navKey = KNOWN_SEGMENT_KEYS[segment];
    const topicTitle = previousSegment === 'topics' ? topicTitleOf(segment) : undefined;
    const interviewTitle =
      previousSegment === 'interview' ? interviewTitleOf(Number(segment)) : undefined;
    crumbs.push({
      label: navKey ? t(navKey) : interviewTitle ?? topicTitle ?? titleizeSlug(segment),
      to: accumulated,
    });
    previousSegment = segment;
  }

  return (
    <nav className="text-xs text-fg-subtle" aria-label="Breadcrumb">
      <ol className="flex items-center flex-wrap gap-1">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li key={crumb.to} className="flex items-center gap-1">
              {index > 0 && <span aria-hidden>›</span>}
              {isLast ? (
                <span className="text-fg">{crumb.label}</span>
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
