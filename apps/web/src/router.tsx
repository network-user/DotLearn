import { Suspense, lazy } from 'react';

import {
  Outlet,
  RootRoute,
  Route,
  Router,
  createBrowserHistory,
  useRouterState,
} from '@tanstack/react-router';

import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { PageTransition } from './components/ui/PageTransition';
import { Skeleton } from './components/ui/Skeleton';
import { HomePage } from './pages/HomePage';

const TopicPage = lazy(() =>
  import('./pages/TopicPage').then((module) => ({ default: module.TopicPage })),
);
const AdminPage = lazy(() =>
  import('./pages/AdminPage').then((module) => ({ default: module.AdminPage })),
);
const ProgressPage = lazy(() =>
  import('./pages/ProgressPage').then((module) => ({ default: module.ProgressPage })),
);
const ProposalsPage = lazy(() =>
  import('./pages/ProposalsPage').then((module) => ({ default: module.ProposalsPage })),
);
const SubmitTopicPage = lazy(() =>
  import('./pages/SubmitTopicPage').then((module) => ({ default: module.SubmitTopicPage })),
);
const InterviewListPage = lazy(() =>
  import('./pages/InterviewListPage').then((module) => ({ default: module.InterviewListPage })),
);
const InterviewQuestionPage = lazy(() =>
  import('./pages/InterviewQuestionPage').then((module) => ({
    default: module.InterviewQuestionPage,
  })),
);
const InterviewExamPage = lazy(() =>
  import('./pages/InterviewExamPage').then((module) => ({
    default: module.InterviewExamPage,
  })),
);
const FlashcardsIndexPage = lazy(() =>
  import('./pages/FlashcardsIndexPage').then((module) => ({
    default: module.FlashcardsIndexPage,
  })),
);
const FlashcardReviewPage = lazy(() =>
  import('./pages/FlashcardReviewPage').then((module) => ({
    default: module.FlashcardReviewPage,
  })),
);
const SandboxPage = lazy(() =>
  import('./pages/SandboxPage').then((module) => ({
    default: module.SandboxPage,
  })),
);
const LearningMapPage = lazy(() =>
  import('./pages/LearningMapPage').then((module) => ({
    default: module.LearningMapPage,
  })),
);
const TodayPage = lazy(() =>
  import('./pages/TodayPage').then((module) => ({
    default: module.TodayPage,
  })),
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((module) => ({
    default: module.SettingsPage,
  })),
);
const LibraryPage = lazy(() =>
  import('./pages/LibraryPage').then((module) => ({
    default: module.LibraryPage,
  })),
);

const PageFallback = () => (
  <div className="space-y-6" aria-hidden>
    <Skeleton rounded="2xl" className="h-32" />
    <Skeleton rounded="2xl" className="h-72" />
  </div>
);

const RootComponent = () => {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <Layout>
      <PageTransition>
        <ErrorBoundary variant="section" resetKey={pathname}>
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </PageTransition>
    </Layout>
  );
};

const rootRoute = new RootRoute({
  component: RootComponent,
});

export interface HomeSearch {
  q?: string | undefined;
  difficulty?: string | undefined;
  runtime?: string[] | undefined;
  tags?: string[] | undefined;
  status?: string | undefined;
}

const homeRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
  validateSearch: (search: Record<string, unknown>): HomeSearch => {
    const str = (value: unknown): string | undefined =>
      typeof value === 'string' && value.length > 0 ? value : undefined;
    const strArray = (value: unknown): string[] | undefined => {
      const source = Array.isArray(value) ? value : value === undefined ? [] : [value];
      const cleaned = source.filter(
        (entry): entry is string => typeof entry === 'string' && entry.length > 0,
      );
      return cleaned.length > 0 ? cleaned : undefined;
    };
    return {
      q: str(search.q),
      difficulty: str(search.difficulty),
      runtime: strArray(search.runtime),
      tags: strArray(search.tags),
      status: str(search.status),
    };
  },
});

export interface TopicSearch {
  concept?: string | undefined;
  resume?: boolean | undefined;
}

const topicRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/topics/$slug',
  component: TopicPage,
  validateSearch: (search: Record<string, unknown>): TopicSearch => ({
    concept:
      typeof search.concept === 'string' && search.concept.length > 0 ? search.concept : undefined,
    resume:
      search.resume === '1' ||
      search.resume === 1 ||
      search.resume === true ||
      search.resume === 'true'
        ? true
        : undefined,
  }),
});

const submitRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/submit',
  component: SubmitTopicPage,
});

export interface InterviewSearch {
  q?: string | undefined;
  topic?: string | undefined;
  stage?: string | undefined;
  status?: 'studied' | 'not-studied' | undefined;
  sort?: 'title' | 'topic' | 'stage' | undefined;
}

const interviewRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/interview',
  component: InterviewListPage,
  validateSearch: (search: Record<string, unknown>): InterviewSearch => {
    const str = (value: unknown): string | undefined =>
      typeof value === 'string' && value.length > 0 ? value : undefined;
    const status =
      search.status === 'studied' || search.status === 'not-studied' ? search.status : undefined;
    const sort =
      search.sort === 'title' || search.sort === 'topic' || search.sort === 'stage'
        ? search.sort
        : undefined;
    return {
      q: str(search.q),
      topic: str(search.topic),
      stage: str(search.stage),
      status,
      sort,
    };
  },
});

const interviewExamRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/interview/exam',
  component: InterviewExamPage,
});

const interviewQuestionRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/interview/$id',
  component: InterviewQuestionPage,
});

const proposalsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/proposals',
  component: ProposalsPage,
});

const normalizeAdminPath = (raw: string | undefined): string => {
  const fallback = '/admin';
  if (!raw) return fallback;
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  const prefixed = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return prefixed.replace(/\/+$/, '') || fallback;
};

export const adminPath: string = normalizeAdminPath(import.meta.env.VITE_ADMIN_PATH);

const adminRoute = new Route({
  getParentRoute: () => rootRoute,
  path: adminPath,
  component: AdminPage,
});

const progressRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/progress',
  component: ProgressPage,
});

const flashcardsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/flashcards',
  component: FlashcardsIndexPage,
});

const flashcardReviewRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/flashcards/$slug',
  component: FlashcardReviewPage,
});

const sandboxRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/sandbox',
  component: SandboxPage,
});

const mapRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/map',
  component: LearningMapPage,
});

const todayRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/today',
  component: TodayPage,
});

const settingsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
});

const libraryRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/library',
  component: LibraryPage,
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  topicRoute,
  submitRoute,
  interviewRoute,
  interviewExamRoute,
  interviewQuestionRoute,
  proposalsRoute,
  adminRoute,
  progressRoute,
  flashcardsRoute,
  flashcardReviewRoute,
  sandboxRoute,
  mapRoute,
  todayRoute,
  settingsRoute,
  libraryRoute,
]);

export const router = new Router({
  routeTree,
  history: createBrowserHistory(),
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
