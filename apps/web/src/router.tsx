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
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })),
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

const homeRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
});

const topicRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/topics/$slug',
  component: TopicPage,
});

const submitRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/submit',
  component: SubmitTopicPage,
});

const interviewRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/interview',
  component: InterviewListPage,
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

const settingsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: SettingsPage,
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  topicRoute,
  submitRoute,
  interviewRoute,
  interviewQuestionRoute,
  proposalsRoute,
  adminRoute,
  progressRoute,
  settingsRoute,
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
