import { lazy, StrictMode, Suspense, useEffect, useState } from 'react';

import { RouterProvider } from '@tanstack/react-router';
import { MotionConfig } from 'framer-motion';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';

import { ErrorBoundary } from './components/ErrorBoundary';
import './lib/i18n';
import { AuthProvider } from './lib/auth/AuthContext';
import { COMMAND_PALETTE_EVENT } from './lib/command-palette';
import { initSettings, useSettings } from './lib/settings';
import { applyTheme, readStoredTheme } from './lib/theme';
import { router } from './router';

import './styles/global.css';

const CommandPalette = lazy(() => import('./components/ui/CommandPalette'));

const CommandPaletteHost = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    const onOpen = (): void => setOpen(true);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener(COMMAND_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener(COMMAND_PALETTE_EVENT, onOpen);
    };
  }, []);

  if (!open) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <CommandPalette open={open} onOpenChange={setOpen} />
    </Suspense>
  );
};

applyTheme(readStoredTheme());
initSettings();

const AppRoot = () => {
  const settings = useSettings();
  return (
    <MotionConfig reducedMotion={settings.motion === 'reduced' ? 'always' : 'user'}>
      <RouterProvider router={router} />
      <CommandPaletteHost />
      <Toaster
        theme="system"
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast: 'border border-border-base bg-surface/95 text-fg',
          },
        }}
      />
    </MotionConfig>
  );
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element missing in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <AppRoot />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);
