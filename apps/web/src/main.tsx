import { StrictMode } from 'react';

import { RouterProvider } from '@tanstack/react-router';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';

import { ErrorBoundary } from './components/ErrorBoundary';
import { router } from './router';

import './styles/global.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element missing in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <RouterProvider router={router} />
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast: 'border border-zinc-800 bg-zinc-900/95 text-zinc-100',
          },
        }}
      />
    </ErrorBoundary>
  </StrictMode>,
);
