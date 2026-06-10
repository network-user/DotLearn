import type { ReactNode } from 'react';

import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { cx } from '@/components/ui/cx';
import { useAuth } from '@/lib/auth/AuthContext';
import { isNavPathActive } from '@/lib/navigation';
import { adminPath } from '@/router';

import { AddTopicButton } from './AddTopicButton';
import { BottomTabBar } from './BottomTabBar';
import { Breadcrumbs } from './Breadcrumbs';
import { LanguageSwitcher } from './LanguageSwitcher';
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

  return (
    <div className="min-h-full flex flex-col pb-[calc(var(--mobile-tabbar-h)+var(--safe-bottom)+16px)] md:pb-0">
      <header className="sticky top-0 z-[var(--z-nav)] glass-chrome border-b border-border-base/70">
        <div className="mx-auto max-w-layout px-[var(--layout-content-gutter)]">
          <div className="flex items-center justify-between gap-2 lg:gap-4 h-14">
            <Link to="/" className="group flex items-baseline gap-0.5 shrink-0">
              <span className="font-display font-semibold text-[22px] leading-none text-accent">.</span>
              <span className="font-display font-semibold text-[21px] leading-none text-fg tracking-tightish">
                learn
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-0.5 self-stretch [&>a]:h-full">
              <NavLink to="/" active={isActive('/')} label={t('topics')} />
              <NavLink to="/proposals" active={isActive('/proposals')} label={t('proposals')} />
              <NavLink to="/progress" active={isActive('/progress')} label={t('progress')} />
              {showAdminLink && (
                <NavLink to={adminPath} active={isActive(adminPath)} label={t('admin')} />
              )}
              <NavLink to="/settings" active={isActive('/settings')} label={t('settings')} />
            </nav>

            <div className="flex items-center gap-1.5 shrink-0">
              <LanguageSwitcher />
              <ThemeToggle />
              <span className="hidden lg:block h-5 w-px bg-border-base mx-1" aria-hidden />
              <AddTopicButton />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-layout px-[var(--layout-content-gutter)] py-8">
        <div className="mb-4"><Breadcrumbs /></div>
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
    </div>
  );
};
