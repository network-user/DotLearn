import { useState } from 'react';

import { Link, useRouterState } from '@tanstack/react-router';
import { m as motion, useReducedMotion } from 'framer-motion';
import { MoreHorizontal, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cx } from '@/components/ui/cx';
import { Dialog } from '@/components/ui/Dialog';
import { openCommandPalette } from '@/lib/command-palette';
import { isNavPathActive } from '@/lib/navigation';
import { primaryNavItems, secondaryNavItems } from '@/lib/navigation-items';
import { adminPath } from '@/router';

const tabs = primaryNavItems;
const moreLinks = secondaryNavItems;

export const BottomTabBar = () => {
  const { t } = useTranslation('nav');
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const reduceMotion = useReducedMotion() ?? false;
  const [moreOpen, setMoreOpen] = useState(false);

  if (pathname.startsWith(adminPath)) {
    return null;
  }

  const moreActive = moreLinks.some((link) => isNavPathActive(pathname, link.to));

  const indicator = (active: boolean) =>
    active &&
    (reduceMotion ? (
      <span aria-hidden className="absolute -inset-x-4 -inset-y-1.5 rounded-full bg-accent/12" />
    ) : (
      <motion.span
        aria-hidden
        layoutId="bottomTabIndicator"
        className="absolute -inset-x-4 -inset-y-1.5 rounded-full bg-accent/12"
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      />
    ));

  return (
    <>
      <button
        type="button"
        onClick={openCommandPalette}
        aria-label={t('openSearch')}
        title={t('openSearch')}
        className="md:hidden fixed right-[calc(env(safe-area-inset-right,0px)+16px)] bottom-[calc(var(--mobile-tabbar-h)+var(--safe-bottom)+16px)] z-[var(--z-nav)] grid place-items-center size-14 rounded-full bg-accent text-surface dark:text-canvas shadow-float transition-transform duration-fast hover:bg-accent/90 active:scale-95"
      >
        <Search size={22} aria-hidden />
      </button>
      <nav
        aria-label={t('primaryNavigation')}
        className="fixed bottom-0 inset-x-0 z-[var(--z-nav)] md:hidden"
      >
        <div className="glass-chrome border-t border-border-base/70 pb-[var(--safe-bottom)]">
          <ul className="flex items-stretch">
            {tabs.map(({ to, icon: Icon, labelKey }) => {
              const active = isNavPathActive(pathname, to);
              return (
                <li key={to} className="flex-1 min-w-0">
                  <Link
                    to={to}
                    aria-current={active ? 'page' : undefined}
                    className={cx(
                      'flex h-[var(--mobile-tabbar-h)] flex-col items-center justify-center gap-1 transition-colors duration-fast',
                      active ? 'text-accent' : 'text-fg-muted',
                    )}
                  >
                    <span className="relative grid place-items-center">
                      {indicator(active)}
                      <Icon size={20} aria-hidden className="relative" />
                    </span>
                    <span className="text-[10px] leading-none tracking-wide truncate max-w-full px-1">
                      {t(labelKey)}
                    </span>
                  </Link>
                </li>
              );
            })}
            <li className="flex-1 min-w-0">
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={moreOpen}
                aria-current={moreActive ? 'page' : undefined}
                className={cx(
                  'flex w-full h-[var(--mobile-tabbar-h)] flex-col items-center justify-center gap-1 transition-colors duration-fast',
                  moreActive ? 'text-accent' : 'text-fg-muted',
                )}
              >
                <span className="relative grid place-items-center">
                  {indicator(moreActive)}
                  <MoreHorizontal size={20} aria-hidden className="relative" />
                </span>
                <span className="text-[10px] leading-none tracking-wide truncate max-w-full px-1">
                  {t('more')}
                </span>
              </button>
            </li>
          </ul>
        </div>
      </nav>

      <Dialog
        open={moreOpen}
        onOpenChange={setMoreOpen}
        title={t('more')}
        placement="sheet"
        size="sm"
      >
        <ul className="-mx-2 space-y-1">
          {moreLinks.map(({ to, icon: Icon, labelKey }) => {
            const active = isNavPathActive(pathname, to);
            return (
              <li key={to}>
                <Link
                  to={to}
                  onClick={() => setMoreOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={cx(
                    'flex items-center gap-3 rounded-lg px-3 min-h-[var(--tap-comfort)] transition-colors',
                    active ? 'bg-accent/[0.08] text-accent' : 'text-fg hover:bg-surface-2/50',
                  )}
                >
                  <span className="grid place-items-center size-9 rounded-lg border border-border-base text-fg-muted">
                    <Icon size={18} aria-hidden />
                  </span>
                  <span className="text-[15px] font-medium">{t(labelKey)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </Dialog>
    </>
  );
};
