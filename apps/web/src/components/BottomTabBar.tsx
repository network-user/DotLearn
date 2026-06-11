import { Link, useRouterState } from '@tanstack/react-router';
import { motion, useReducedMotion } from 'framer-motion';
import { BarChart3, FlaskConical, Layers, LayoutGrid, MessagesSquare } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cx } from '@/components/ui/cx';
import { isNavPathActive } from '@/lib/navigation';
import { adminPath } from '@/router';

const tabs = [
  { to: '/', icon: LayoutGrid, labelKey: 'topics' },
  { to: '/interview', icon: MessagesSquare, labelKey: 'interview' },
  { to: '/sandbox', icon: FlaskConical, labelKey: 'sandbox' },
  { to: '/flashcards', icon: Layers, labelKey: 'flashcards' },
  { to: '/progress', icon: BarChart3, labelKey: 'progress' },
] as const;

export const BottomTabBar = () => {
  const { t } = useTranslation('nav');
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const reduceMotion = useReducedMotion() ?? false;

  if (pathname.startsWith(adminPath)) {
    return null;
  }

  return (
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
                    {active &&
                      (reduceMotion ? (
                        <span
                          aria-hidden
                          className="absolute -inset-x-4 -inset-y-1.5 rounded-full bg-accent/12"
                        />
                      ) : (
                        <motion.span
                          aria-hidden
                          layoutId="bottomTabIndicator"
                          className="absolute -inset-x-4 -inset-y-1.5 rounded-full bg-accent/12"
                          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                        />
                      ))}
                    <Icon size={20} aria-hidden className="relative" />
                  </span>
                  <span className="text-[10px] leading-none tracking-wide truncate max-w-full px-1">
                    {t(labelKey)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
};
