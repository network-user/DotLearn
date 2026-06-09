import { Link, useRouterState } from '@tanstack/react-router';

interface Crumb {
  label: string;
  to: string;
}

const titleizeSlug = (slug: string): string =>
  slug
    .split('-')
    .map((part) => (part.length > 0 ? part[0]?.toUpperCase() + part.slice(1) : ''))
    .join(' ');

const buildCrumbs = (pathname: string): Crumb[] => {
  if (pathname === '/' || pathname === '') {
    return [];
  }
  const segments = pathname.split('/').filter(Boolean);
  const crumbs: Crumb[] = [{ label: 'Home', to: '/' }];
  let accumulated = '';
  for (const segment of segments) {
    accumulated += `/${segment}`;
    crumbs.push({
      label: titleizeSlug(segment),
      to: accumulated,
    });
  }
  return crumbs;
};

export const Breadcrumbs = () => {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const crumbs = buildCrumbs(pathname);
  if (crumbs.length === 0) {
    return null;
  }
  return (
    <nav className="text-xs text-zinc-500" aria-label="Breadcrumb">
      <ol className="flex items-center flex-wrap gap-1">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li key={crumb.to} className="flex items-center gap-1">
              {index > 0 && <span aria-hidden>›</span>}
              {isLast ? (
                <span className="text-zinc-300">{crumb.label}</span>
              ) : (
                <Link to={crumb.to} className="hover:text-zinc-300">
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
