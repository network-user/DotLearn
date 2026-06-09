import { Component, type ErrorInfo, type ReactNode } from 'react';

import i18n from '@/lib/i18n';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | undefined;
}

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

  reset = (): void => {
    this.setState({ error: undefined });
  };

  override render(): ReactNode {
    if (this.state.error) {
      const t = i18n.getFixedT(null, 'errors');
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-lg rounded-xl border border-rose-900/40 bg-rose-950/30 p-6 text-rose-100">
            <h2 className="text-lg font-semibold">{t('boundary.title')}</h2>
            <p className="mt-2 text-sm text-rose-200/80">{this.state.error.message}</p>
            <button
              type="button"
              onClick={this.reset}
              className="mt-4 rounded-md bg-rose-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-400"
            >
              {t('boundary.retry')}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
