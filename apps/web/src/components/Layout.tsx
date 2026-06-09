import type { ReactNode } from 'react';

import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { cx } from '@/components/ui/cx';
import { useAuth } from '@/lib/auth/AuthContext';
import { adminPath } from '@/router';

import { AddTopicButton } from './AddTopicButton';
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
      'relative px-3 h-9 inline-flex items-center rounded-md text-[13px] tracking-snug transition-colors duration-fast',
      active ? 'text-fg' : 'text-fg-muted hover:text-fg',
    )}
  >
    {label}
    {active && (
      <span
        aria-hidden
        className="absolute inset-x-3 -bottom-[7px] h-px bg-gradient-to-r from-transparent via-accent to-transparent"
      />
    )}
  </Link>
);

export const Layout = ({ children }: LayoutProps) => {
  const { t } = useTranslation('nav');
  const { t: tCommon } = useTranslation('common');
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { state: authState } = useAuth();
  const showAdminLink = authState.status === 'authenticated' || pathname.startsWith(adminPath);

  const isActive = (path: string): boolean => {
    if (path === '/') {
      return pathname === '/' || pathname.startsWith('/topics');
    }
    return pathname.startsWith(path);
  };

  return (
    <div className="min-h-full flex flex-col">
      <header className="sticky top-0 z-[var(--z-nav)] px-3 pt-3">
        <div className="mx-auto max-w-layout">
          <div className="glass glass--medium glass--bordered rounded-2xl">
            <span aria-hidden className="glass__highlight" />
            <span aria-hidden className="glass__shine" />
            <div className="glass__content flex items-center justify-between gap-4 px-4 sm:px-5 h-14">
              <Link to="/" className="group flex items-center gap-2.5 shrink-0">
                <span className="relative grid place-items-center size-7 rounded-md bg-gradient-to-br from-accent via-accent-2 to-accent-3 shadow-glow">
                  <span className="size-1.5 rounded-full bg-white/95" />
                </span>
                <span className="font-display text-[20px] leading-none text-fg tracking-tightish">
                  .<span className="text-fg-subtle">learn</span>
                </span>
              </Link>

              <nav className="hidden md:flex items-center gap-0.5">
                <NavLink to="/" active={isActive('/')} label={t('topics')} />
                <NavLink
                  to="/proposals"
                  active={isActive('/proposals')}
                  label={t('proposals')}
                />
                <NavLink to="/progress" active={isActive('/progress')} label={t('progress')} />
                {showAdminLink && (
                  <NavLink to={adminPath} active={isActive(adminPath)} label={t('admin')} />
                )}
                <NavLink to="/settings" active={isActive('/settings')} label={t('settings')} />
              </nav>

              <div className="flex items-center gap-1.5 shrink-0">
                <LanguageSwitcher />
                <ThemeToggle />
                <span className="hidden sm:block h-5 w-px bg-border-base mx-1" aria-hidden />
                <AddTopicButton />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-layout px-[var(--layout-content-gutter)] py-8">
        <div className="mb-4"><Breadcrumbs /></div>
        {children}
      </main>

      <footer className="mt-12 border-t border-border-base/60 bg-canvas/40 backdrop-blur-soft">
        <div className="mx-auto max-w-layout px-[var(--layout-content-gutter)] py-6 flex items-center justify-between gap-3">
          <span className="text-xs text-fg-subtle">{t('brandTagline')}</span>
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
    </div>
  );
};
