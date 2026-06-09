import { StrictMode } from 'react';

import { RouterProvider } from '@tanstack/react-router';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';

import { ErrorBoundary } from './components/ErrorBoundary';
import { CommandPalette } from './components/ui/CommandPalette';
import './lib/i18n';
import { applyTheme, readStoredTheme } from './lib/theme';
import { router } from './router';

import './styles/global.css';

applyTheme(readStoredTheme());

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element missing in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <RouterProvider router={router} />
      <CommandPalette />
      <Toaster
        theme="system"
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast: 'border border-border-base bg-surface/95 text-fg',
          },
        }}
      />
    </ErrorBoundary>
  </StrictMode>,
);
