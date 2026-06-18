import type { ReactNode } from 'react';

import { Link, useRouterState } from '@tanstack/react-router';
import { ChevronDown, Keyboard, Search, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cx } from '@/components/ui/cx';
import { useAuth } from '@/lib/auth/AuthContext';
import { openCommandPalette } from '@/lib/command-palette';
import { isNavPathActive } from '@/lib/navigation';
import { primaryNavItems, secondaryNavItems } from '@/lib/navigation-items';
import { adminPath } from '@/router';

import { AddTopicButton } from './AddTopicButton';
import { BottomTabBar } from './BottomTabBar';
import { Breadcrumbs } from './Breadcrumbs';
import { InstallPrompt } from './InstallPrompt';
import { LanguageSwitcher } from './LanguageSwitcher';
import { Onboarding } from './Onboarding';
import { ShortcutsHost, openShortcuts } from './ShortcutsDialog';
import { ThemeToggle } from './ThemeToggle';

type LayoutProps = {
  children: ReactNode;
};

interface NavLinkProps {
  to: string;
  active: boolean;
  label: string;
}

const NavLink = ({ to, active, label }: NavLinkProps) => (
  <Link
    to={to}
    className={cx(
      'my-2 px-2.5 lg:px-3.5 inline-flex items-center rounded-full text-[13px] font-medium tracking-snug transition-colors duration-fast',
      active ? 'bg-fg/[0.07] text-fg' : 'text-fg-muted hover:text-fg hover:bg-fg/[0.04]',
    )}
  >
    {label}
  </Link>
);

export const Layout = ({ children }: LayoutProps) => {
  const { t } = useTranslation('nav');
  const { t: tCommon } = useTranslation('common');
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { state: authState } = useAuth();
  const showAdminLink = authState.status === 'authenticated' || pathname.startsWith(adminPath);

  const isActive = (path: string): boolean => isNavPathActive(pathname, path);

  const overflowItems = secondaryNavItems.filter((item) => item.to !== '/settings');
  const overflowActive = overflowItems.some((item) => isActive(item.to));

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
          <div className="flex items-center justify-between gap-2 lg:gap-4 h-14">
            <Link to="/" className="group flex items-baseline gap-0.5 shrink-0">
              <span className="font-display font-semibold text-[22px] leading-none text-accent">
                .
              </span>
              <span className="font-display font-semibold text-[21px] leading-none text-fg tracking-tightish">
                learn
              </span>
            </Link>

            <nav
              aria-label={t('primaryNavigation')}
              className="hidden md:flex items-center gap-0.5 self-stretch [&>a]:h-full"
            >
              {primaryNavItems.map((item) => (
                <NavLink
                  key={item.key}
                  to={item.to}
                  active={isActive(item.to)}
                  label={t(item.labelKey)}
                />
              ))}
              {showAdminLink && (
                <NavLink to={adminPath} active={isActive(adminPath)} label={t('admin')} />
              )}
              <details className="group/more relative my-2 [&>summary]:list-none [&>summary::-webkit-details-marker]:hidden">
                <summary
                  aria-label={t('more')}
                  className={cx(
                    'px-2.5 lg:px-3.5 h-9 inline-flex items-center gap-1 rounded-full text-[13px] font-medium tracking-snug cursor-pointer transition-colors duration-fast',
                    overflowActive
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
                <div className="absolute right-0 top-[calc(100%+6px)] z-[var(--z-sheet)] min-w-[180px] rounded-xl border border-border-base glass-strong p-1.5 shadow-float">
                  {overflowItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.to);
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
            </nav>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={openCommandPalette}
                aria-label={t('openSearch')}
                title={t('openSearch')}
                className="group inline-flex items-center gap-2 h-9 rounded-full border border-border-base/70 text-fg-muted hover:text-fg hover:bg-fg/[0.04] transition-colors px-2.5 lg:px-3.5"
              >
                <Search size={15} aria-hidden />
                <span className="hidden md:inline text-[13px]">{t('openSearch')}</span>
              </button>
              <button
                type="button"
                onClick={openShortcuts}
                aria-label={t('openShortcuts')}
                title={t('openShortcuts')}
                className="hidden md:inline-flex items-center justify-center rounded-md border border-border-base px-2 py-1.5 text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors"
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
          <span className="flex items-baseline gap-2">
            <span className="font-display text-sm text-fg">.learn</span>
            <span className="text-xs text-fg-subtle">{t('brandTagline')}</span>
          </span>
          <a
            href="https://github.com/your-org/dotlearn"
            className="text-xs text-fg-subtle hover:text-fg transition-colors"
            target="_blank"
            rel="noreferrer"
          >
            {tCommon('github')}
          </a>
        </div>
      </footer>

      <BottomTabBar />
      <ShortcutsHost />
      <InstallPrompt />
      <Onboarding />
    </div>
  );
};
