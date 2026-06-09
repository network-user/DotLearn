import { useEffect, useState } from 'react';

import type { Submission } from '@dotlearn/contracts';
import { useTranslation } from 'react-i18next';

import { ApiError, listPendingSubmissions, reviewSubmission } from '@/lib/api-client';

type ViewState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; submissions: Submission[] };

export const AdminPage = () => {
  const { t } = useTranslation('admin');
  const [state, setState] = useState<ViewState>({ kind: 'loading' });
  const [reviewing, setReviewing] = useState<string | null>(null);

  const refresh = async () => {
    setState({ kind: 'loading' });
    try {
      const submissions = await listPendingSubmissions();
      setState({ kind: 'ready', submissions });
    } catch (error) {
      const message =
        error instanceof ApiError
          ? t('apiUnavailable', { status: error.status })
          : t('networkError');
      setState({ kind: 'error', message });
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const decide = async (id: string, decision: 'approve' | 'reject') => {
    setReviewing(id);
    try {
      await reviewSubmission(id, { decision });
      await refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        setState({ kind: 'error', message: t('reviewFailed', { message: error.message }) });
      }
    } finally {
      setReviewing(null);
    }
  };

  return (
    <div>
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-fg-muted">{t('subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="px-3 py-1.5 rounded-md text-sm border border-border-strong hover:bg-surface"
        >
          {t('refresh')}
        </button>
      </header>

      {state.kind === 'loading' ? <Spinner label={t('loading')} /> : null}
      {state.kind === 'error' ? <ErrorBox message={state.message} /> : null}
      {state.kind === 'ready' && state.submissions.length === 0 ? (
        <EmptyState label={t('empty')} />
      ) : null}
      {state.kind === 'ready' && state.submissions.length > 0 ? (
        <ul className="space-y-4">
          {state.submissions.map((submission) => (
            <li
              key={submission.id}
              className="rounded-xl border border-border-base bg-surface/60 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-semibold text-fg">{submission.payload.title}</h3>
                  <div className="mt-1 flex gap-2 text-xs text-fg-subtle">
                    <span>{submission.source}</span>
                    <span>·</span>
                    <span>{new Date(submission.createdAt).toLocaleString()}</span>
                    <span>·</span>
                    <span>{submission.payload.suggestedRuntime}</span>
                    <span>·</span>
                    <span>{submission.payload.suggestedDifficulty}</span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={reviewing === submission.id}
                    onClick={() => decide(submission.id, 'approve')}
                    className="px-3 py-1.5 rounded-md text-sm bg-emerald-500 text-emerald-950 font-medium hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {t('approve')}
                  </button>
                  <button
                    type="button"
                    disabled={reviewing === submission.id}
                    onClick={() => decide(submission.id, 'reject')}
                    className="px-3 py-1.5 rounded-md text-sm bg-rose-500/20 text-rose-200 border border-rose-700/50 hover:bg-rose-500/30 disabled:opacity-50"
                  >
                    {t('reject')}
                  </button>
                </div>
              </div>
              <p className="mt-3 text-sm text-fg whitespace-pre-wrap">
                {submission.payload.outline}
              </p>
              {submission.payload.tags.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1">
                  {submission.payload.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] uppercase tracking-wide text-fg-muted bg-surface-2/80 px-1.5 py-0.5 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
              {submission.payload.sources.length > 0 ? (
                <ul className="mt-3 text-xs text-indigo-300 space-y-1">
                  {submission.payload.sources.map((url) => (
                    <li key={url}>
                      <a href={url} target="_blank" rel="noreferrer" className="hover:underline">
                        {url}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

const Spinner = ({ label }: { label: string }) => (
  <div className="rounded-xl border border-border-base p-8 text-center text-sm text-fg-muted">
    {label}
  </div>
);

const EmptyState = ({ label }: { label: string }) => (
  <div className="rounded-xl border border-dashed border-border-base p-8 text-center text-sm text-fg-muted">
    {label}
  </div>
);

const ErrorBox = ({ message }: { message: string }) => (
  <div className="rounded-xl border border-rose-900/40 bg-rose-950/30 p-5 text-sm text-rose-300">
    {message}
  </div>
);
