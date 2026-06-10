import { type ReactNode } from 'react';

import { useRouterState } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'framer-motion';

interface PageTransitionProps {
  children: ReactNode;
}

const reduceMotion =
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export const PageTransition = ({ children }: PageTransitionProps) => {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (reduceMotion) {
    return <>{children}</>;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};
