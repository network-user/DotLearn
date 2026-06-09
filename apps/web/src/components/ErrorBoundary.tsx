import { Component, type ErrorInfo, type ReactNode } from 'react';

import i18n from '@/lib/i18n';

interface ErrorBoundaryProps {
  children: ReactNode;
  variant?: 'screen' | 'section';
  resetKey?: string;
}

interface ErrorBoundaryState {
  error: Error | undefined;
}

const CHUNK_LOAD_ERROR =
  /failed to fetch dynamically imported module|importing a module script failed|loading chunk|loading css chunk/i;

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: undefined };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    if (typeof console !== 'undefined') {
      console.error('UI error boundary caught', error, info.componentStack);
    }
  }

  override componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: undefined });
    }
  }

  reset = (): void => {
    this.setState({ error: undefined });
  };

  reload = (): void => {
    window.location.reload();
  };

  override render(): ReactNode {
    if (this.state.error) {
      const t = i18n.getFixedT(null, 'errors');
      const isChunkError = CHUNK_LOAD_ERROR.test(this.state.error.message);
      const card = (
        <div className="max-w-lg w-full rounded-xl border border-rose-900/40 bg-rose-950/30 p-6 text-rose-100">
          <h2 className="text-lg font-semibold">
            {isChunkError ? t('boundary.chunkTitle') : t('boundary.title')}
          </h2>
          <p className="mt-2 text-sm text-rose-200/80">{this.state.error.message}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {!isChunkError && (
              <button
                type="button"
                onClick={this.reset}
                className="rounded-md bg-rose-500 px-3 py-1.5 min-h-[var(--tap)] sm:min-h-0 text-sm font-medium text-white hover:bg-rose-400"
              >
                {t('boundary.retry')}
              </button>
            )}
            <button
              type="button"
              onClick={this.reload}
              className="rounded-md border border-rose-500/50 px-3 py-1.5 min-h-[var(--tap)] sm:min-h-0 text-sm font-medium text-rose-100 hover:bg-rose-500/20"
            >
              {t('boundary.reload')}
            </button>
          </div>
        </div>
      );
      if (this.props.variant === 'section') {
        return <div className="flex justify-center py-12">{card}</div>;
      }
      return <div className="min-h-screen flex items-center justify-center p-6">{card}</div>;
    }
    return this.props.children;
  }
}
