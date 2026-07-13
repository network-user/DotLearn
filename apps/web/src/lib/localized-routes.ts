import { getCurrentLanguage, setLanguage, type SupportedLanguage } from './i18n';

export type LanguageNavigate = (options: {
  to: string;
  search?: Record<string, unknown>;
  replace?: boolean;
}) => void | Promise<unknown>;

const TOPIC_PATH_PATTERN = /^\/(?:en\/)?topics\/([^/]+)$/;
const INTERVIEW_QUESTION_PATTERN = /^\/(?:en\/)?interview\/([^/]+)$/;

const STATIC_EN_PATHS: Record<string, string> = {
  '/glossary': '/en/glossary',
  '/analytics': '/en/analytics',
  '/interview': '/en/interview',
};

export const routeLanguageFromPathname = (pathname: string): SupportedLanguage | undefined => {
  if (pathname === '/en' || pathname.startsWith('/en/')) return 'en';
  if (pathname === '/') return 'ru';
  if (TOPIC_PATH_PATTERN.test(pathname)) return 'ru';
  if (pathname in STATIC_EN_PATHS) return 'ru';
  if (INTERVIEW_QUESTION_PATTERN.test(pathname) && !pathname.startsWith('/en/')) return 'ru';
  return undefined;
};

export const localizedPathForLanguage = (
  pathname: string,
  lang: SupportedLanguage,
): string | undefined => {
  if (lang === 'en') {
    if (pathname === '/' || pathname === '/en') return pathname === '/en' ? undefined : '/en';
    if (pathname.startsWith('/en')) return undefined;

    const topicMatch = TOPIC_PATH_PATTERN.exec(pathname);
    const slug = topicMatch?.[1];
    if (slug) return `/en/topics/${slug}`;

    const staticTarget = STATIC_EN_PATHS[pathname];
    if (staticTarget) return staticTarget;

    const interviewMatch = /^\/interview\/([^/]+)$/.exec(pathname);
    if (interviewMatch) return `/en/interview/${interviewMatch[1]}`;

    return undefined;
  }

  if (pathname === '/en') return '/';
  if (!pathname.startsWith('/en')) return undefined;

  const stripped = pathname.slice(3) || '/';
  if (stripped === '/') return '/';

  const topicMatch = /^\/topics\/([^/]+)$/.exec(stripped);
  if (topicMatch) return `/topics/${topicMatch[1]}`;

  if (stripped === '/glossary' || stripped === '/analytics' || stripped === '/interview') {
    return stripped;
  }

  const interviewMatch = /^\/interview\/([^/]+)$/.exec(stripped);
  if (interviewMatch) return `/interview/${interviewMatch[1]}`;

  return '/';
};

export const applyLanguageSelection = async (
  lang: SupportedLanguage,
  options: {
    pathname: string;
    search?: Record<string, unknown>;
    navigate: LanguageNavigate;
  },
): Promise<void> => {
  const current = getCurrentLanguage();
  if (lang !== current) await setLanguage(lang);

  const routeLanguage = routeLanguageFromPathname(options.pathname);
  if (lang === routeLanguage) return;

  const localizedPath = localizedPathForLanguage(options.pathname, lang);
  if (localizedPath) {
    const navOptions: { to: string; search?: Record<string, unknown>; replace: boolean } = {
      to: localizedPath,
      replace: true,
    };
    if (options.search !== undefined) navOptions.search = options.search;
    await options.navigate(navOptions);
  }
};
