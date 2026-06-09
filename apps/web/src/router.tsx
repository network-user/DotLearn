import {
  Outlet,
  RootRoute,
  Route,
  Router,
  createBrowserHistory,
} from '@tanstack/react-router';

import { Layout } from './components/Layout';
import { PageTransition } from './components/ui/PageTransition';
import { AdminPage } from './pages/AdminPage';
import { HomePage } from './pages/HomePage';
import { ProgressPage } from './pages/ProgressPage';
import { ProposalsPage } from './pages/ProposalsPage';
import { SettingsPage } from './pages/SettingsPage';
import { SubmitTopicPage } from './pages/SubmitTopicPage';
import { TopicPage } from './pages/TopicPage';

const rootRoute = new RootRoute({
  component: () => (
    <Layout>
      <PageTransition>
        <Outlet />
      </PageTransition>
    </Layout>
  ),
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

const proposalsRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/proposals',
  component: ProposalsPage,
});

const adminRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/admin',
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
