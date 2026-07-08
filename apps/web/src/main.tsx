import { lazy, StrictMode, Suspense, useEffect, useState } from 'react';

import { registerSW } from 'virtual:pwa-register';

import { RouterProvider } from '@tanstack/react-router';
import { LazyMotion, MotionConfig } from 'framer-motion';
import { createRoot } from 'react-dom/client';
import { toast, Toaster } from 'sonner';

import { ErrorBoundary } from './components/ErrorBoundary';
import i18n from './lib/i18n';
import { AuthProvider } from './lib/auth/AuthContext';
import { COMMAND_PALETTE_EVENT } from './lib/command-palette';
import { initSettings, useSettings } from './lib/settings';
import { recoverFromStaleChunk } from './lib/stale-deploy-recovery';
import { requestPersistAfterFirstWrite } from './lib/storage-health';
import { watchSystemTheme } from './lib/theme';
import { router } from './router';

import './styles/global.css';

const CommandPalette = lazy(() => import('./components/ui/CommandPalette'));

const loadMotionFeatures = () => import('./lib/motion-features').then((module) => module.default);

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

initSettings();
watchSystemTheme();
requestPersistAfterFirstWrite();
window.history.scrollRestoration = 'manual';

const registerServiceWorker = (): void => {
  const updateServiceWorker = registerSW({
    onNeedRefresh() {
      toast(i18n.t('common:pwa.updateTitle'), {
        duration: Infinity,
        action: {
          label: i18n.t('common:pwa.update'),
          onClick: () => {
            void updateServiceWorker(true);
          },
        },
      });
    },
    onOfflineReady() {
      toast.success(i18n.t('common:pwa.offlineReady'));
    },
  });
};

registerServiceWorker();

// A redeploy rotates hashed chunk names; a client on a stale index.html then 404s
// on `import()`. Vite fires `vite:preloadError` — recover by dropping the stale
// service worker/caches and reloading once so the fresh bundle loads.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  void recoverFromStaleChunk();
});

const AppRoot = () => {
  const settings = useSettings();
  return (
    <LazyMotion features={loadMotionFeatures} strict>
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
    </LazyMotion>
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
