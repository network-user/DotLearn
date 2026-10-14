import { lazy, Suspense, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

import { Link, useNavigate, useRouterState } from '@tanstack/react-router';
import { ChevronDown, Keyboard, Search, Settings, Shield } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cx } from '@/components/ui/cx';
import { useAuth } from '@/lib/auth/AuthContext';
import { openCommandPalette } from '@/lib/command-palette';
import { isNavItemActive, isNavPathActive } from '@/lib/navigation';
import { primaryNavItems, secondaryNavItems, type NavItem } from '@/lib/navigation-items';
import { openPersonalizeWizard } from '@/lib/personalize-wizard';
import { adminPath } from '@/router';

import { AddTopicButton } from './AddTopicButton';
import { BottomTabBar } from './BottomTabBar';
import { Breadcrumbs } from './Breadcrumbs';
import { InstallPrompt } from './InstallPrompt';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Onboarding } from './Onboarding';
import { OnlineIndicator } from './OnlineIndicator';
import { PersonalizeWizard } from './PersonalizeWizard';
import { ShortcutsHost, openShortcuts } from './ShortcutsDialog';
import { ThemeToggle } from './ThemeToggle';

// The sync engine (+merge+codec) lives in an async chunk; a static import here would drag it into
// Layout's eager entry chunk and blow the check:bundle budget. Lazy-load so it only loads for the
// (rare) linked-device case — see SyncIndicator.tsx, which itself imports `useSync` statically.
const SyncIndicator = lazy(() =>
  import('./SyncIndicator').then((module) => ({ default: module.SyncIndicator })),
);

type LayoutProps = {
  children: ReactNode;
};

interface NavLinkProps {
  to: string;
  active: boolean;
  label: string;
  clipped: boolean;
}

const adminNavItem = (path: string): NavItem => ({
  key: 'admin',
  to: path,
  labelKey: 'admin',
  icon: Shield,
  primary: true,
});

const NavLink = ({ to, active, label, clipped }: NavLinkProps) => (
  <Link
    to={to}
    data-nav-link=""
    tabIndex={clipped ? -1 : undefined}
    aria-hidden={clipped ? true : undefined}
    className={cx(
      'inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-full px-2.5 text-[13px] font-medium tracking-snug transition-colors duration-fast lg:px-3.5',
      clipped && 'pointer-events-none invisible',
      active ? 'bg-fg/[0.07] text-fg' : 'text-fg-muted hover:text-fg hover:bg-fg/[0.04]',
    )}
  >
    {label}
  </Link>
);

const DesktopNav = ({ pathname, showAdminLink }: { pathname: string; showAdminLink: boolean }) => {
  const { t, i18n } = useTranslation('nav');
  const rowRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const links = showAdminLink ? [...primaryNavItems, adminNavItem(adminPath)] : primaryNavItems;
  const [visibleCount, setVisibleCount] = useState(primaryNavItems.length + 1);

  useLayoutEffect(() => {
    const row = rowRef.current;
    const track = trackRef.current;
    if (!row || !track) return;

    let alive = true;
    const update = (): void => {
      if (!alive) return;
      const available = row.clientWidth;
      const nodes = track.querySelectorAll<HTMLElement>(':scope > [data-nav-link]');
      let next = nodes.length;
      for (let index = 0; index < nodes.length; index += 1) {
        const node = nodes.item(index);
        if (node.offsetLeft + node.offsetWidth > available + 1) {
          next = index;
          break;
        }
      }
      setVisibleCount((current) => (current === next ? current : next));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(row);
    observer.observe(track);
    void document.fonts?.ready.then(update);
    return () => {
      alive = false;
      observer.disconnect();
    };
  }, [showAdminLink, i18n.language]);

  const menuItems = [
    ...links.slice(visibleCount),
    ...secondaryNavItems.filter((item) => item.to !== '/settings'),
  ];
  const menuActive = menuItems.some((item) => isNavItemActive(pathname, item));

  return (
    <nav aria-label={t('primaryNavigation')} className="hidden min-w-0 flex-1 items-center md:flex">
      <div className="flex min-w-0 flex-1 items-center gap-0.5">
        <div ref={rowRef} className="relative min-w-0 overflow-hidden">
          <div ref={trackRef} className="flex w-max items-center gap-0.5">
            {links.map((item, index) => (
              <NavLink
                key={item.key}
                to={item.to}
                active={isNavItemActive(pathname, item)}
                label={t(item.labelKey)}
                clipped={index >= visibleCount}
              />
            ))}
          </div>
        </div>
        <details
          key={pathname}
          className="group/more relative shrink-0 [&>summary]:list-none [&>summary::-webkit-details-marker]:hidden"
        >
          <summary
            aria-label={t('more')}
            className={cx(
              'inline-flex h-9 shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-[13px] font-medium tracking-snug transition-colors duration-fast lg:px-3.5',
              menuActive
                ? 'bg-fg/[0.07] text-fg'
                : 'text-fg-muted hover:text-fg hover:bg-fg/[0.04]',
            )}
          >
            {t('more')}
            <ChevronDown
              size={14}
              aria-hidden
              className="transition-transform duration-fast group-open/more:rotate-180"
            />
          </summary>
          <div className="absolute right-0 top-[calc(100%+6px)] z-[var(--z-sheet)] min-w-[180px] rounded-xl border border-border-base glass-strong bg-surface/95 p-1.5 shadow-float">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const active = isNavItemActive(pathname, item);
              return (
                <Link
                  key={item.key}
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={cx(
                    'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors duration-fast',
                    active
                      ? 'bg-accent/[0.08] text-accent'
                      : 'text-fg-muted hover:text-fg hover:bg-fg/[0.04]',
                  )}
                >
                  <Icon size={15} aria-hidden />
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </div>
        </details>
      </div>
    </nav>
  );
};

const githubUrl: string = import.meta.env.VITE_GITHUB_URL ?? '';

export const Layout = ({ children }: LayoutProps) => {
  const { t } = useTranslation('nav');
  const { t: tCommon } = useTranslation('common');
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const { state: authState } = useAuth();
  const showAdminLink = authState.status === 'authenticated' || pathname.startsWith(adminPath);

  const isActive = (path: string): boolean => isNavPathActive(pathname, path);

  const handleSearchClick = (): void => {
    if (window.matchMedia('(min-width: 768px)').matches) {
      openCommandPalette();
      return;
    }
    void navigate({ to: '/search' });
  };

  return (
    <div className="min-h-full flex flex-col pb-[calc(var(--mobile-tabbar-h)+var(--safe-bottom)+16px)] md:pb-0">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[var(--z-modal)] focus:rounded-md focus:border focus:border-border-base focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-fg focus:shadow-float focus:outline-none focus:ring-2 focus:ring-accent/50"
      >
        {t('skipToContent', { defaultValue: 'Перейти к содержимому' })}
      </a>
      <header className="sticky top-0 z-[var(--z-nav)] glass-chrome border-b border-border-base/70">
        <div className="mx-auto max-w-layout px-[var(--layout-content-gutter)]">
          <div className="flex h-14 min-w-0 items-center justify-between gap-2 lg:gap-4">
            <Link to="/" className="group flex items-baseline gap-0.5 shrink-0">
              <span className="font-display font-semibold text-[22px] leading-none text-accent">
                .
              </span>
              <span className="font-display font-semibold text-[21px] leading-none text-fg tracking-tightish">
                learn
              </span>
            </Link>

            <DesktopNav pathname={pathname} showAdminLink={showAdminLink} />

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleSearchClick}
                aria-label={t('openSearch')}
                title={t('openSearch')}
                className="group inline-flex items-center gap-2 h-9 rounded-full border border-border-base/70 text-fg-muted hover:text-fg hover:bg-fg/[0.04] transition-colors px-2.5 lg:px-3.5"
              >
                <Search size={15} aria-hidden />
                <span className="hidden text-[13px] lg:inline">{t('openSearch')}</span>
              </button>
              <button
                type="button"
                onClick={openShortcuts}
                aria-label={t('openShortcuts')}
                title={t('openShortcuts')}
                className="hidden items-center justify-center rounded-md border border-border-base px-2 py-1.5 text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg lg:inline-flex"
              >
                <Keyboard size={15} aria-hidden />
              </button>
              <LanguageSwitcher />
              <ThemeToggle />
              <Link
                to="/settings"
                aria-label={t('settings')}
                title={t('settings')}
                className={cx(
                  'hidden md:inline-flex items-center justify-center rounded-md border border-border-base px-2 py-1.5 transition-colors',
                  isActive('/settings')
                    ? 'text-fg bg-fg/[0.06]'
                    : 'text-fg-muted hover:text-fg hover:bg-surface-2',
                )}
              >
                <Settings size={15} aria-hidden />
              </Link>
              <OnlineIndicator />
              <Suspense fallback={null}>
                <SyncIndicator />
              </Suspense>
              <span className="hidden lg:block h-5 w-px bg-border-base mx-1" aria-hidden />
              <AddTopicButton />
            </div>
          </div>
        </div>
      </header>

      <main
        id="main"
        tabIndex={-1}
        className="flex-1 mx-auto w-full max-w-layout px-[var(--layout-content-gutter)] py-8 outline-none"
      >
        <div className="mb-4">
          <Breadcrumbs />
        </div>
        {children}
      </main>

      <footer className="mt-12 rule-double-b border-t border-border-base bg-surface/60">
        <div className="mx-auto max-w-layout px-[var(--layout-content-gutter)] py-6 flex items-center justify-between gap-3">
          <span className="text-xs text-fg-subtle">{t('brandTagline')}</span>
          {githubUrl ? (
            <a
              href={githubUrl}
              className="text-xs text-fg-subtle hover:text-fg transition-colors"
              target="_blank"
              rel="noreferrer"
            >
              {tCommon('github')}
            </a>
          ) : null}
        </div>
      </footer>

      <BottomTabBar />
      <ShortcutsHost />
      <InstallPrompt />
      <Onboarding onDismiss={openPersonalizeWizard} />
      <PersonalizeWizard />
    </div>
  );
};
