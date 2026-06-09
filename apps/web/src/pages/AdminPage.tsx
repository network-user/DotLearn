import { useEffect, useState } from 'react';

import type { Submission } from '@dotlearn/contracts';

import { ApiError, listPendingSubmissions, reviewSubmission } from '@/lib/api-client';

type ViewState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; submissions: Submission[] };

export const AdminPage = () => {
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
          ? `${error.status} — the API backend may not be running. Start it with pnpm dev:api.`
          : 'Network error talking to the API.';
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
        setState({ kind: 'error', message: `Review failed: ${error.message}` });
      }
    } finally {
      setReviewing(null);
    }
  };

  return (
    <div>
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Admin queue</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Pending topic proposals submitted via the site. Approve to flag for materialization
            with lesson-forge; reject to remove from the queue.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="px-3 py-1.5 rounded-md text-sm border border-zinc-700 hover:bg-zinc-900"
        >
          Refresh
        </button>
      </header>

      {state.kind === 'loading' ? <Spinner /> : null}
      {state.kind === 'error' ? <ErrorBox message={state.message} /> : null}
      {state.kind === 'ready' && state.submissions.length === 0 ? (
        <EmptyState />
      ) : null}
      {state.kind === 'ready' && state.submissions.length > 0 ? (
        <ul className="space-y-4">
          {state.submissions.map((submission) => (
            <li
              key={submission.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-semibold text-zinc-100">{submission.payload.title}</h3>
                  <div className="mt-1 flex gap-2 text-xs text-zinc-500">
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
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={reviewing === submission.id}
                    onClick={() => decide(submission.id, 'reject')}
                    className="px-3 py-1.5 rounded-md text-sm bg-rose-500/20 text-rose-200 border border-rose-700/50 hover:bg-rose-500/30 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
              <p className="mt-3 text-sm text-zinc-300 whitespace-pre-wrap">
                {submission.payload.outline}
              </p>
              {submission.payload.tags.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1">
                  {submission.payload.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] uppercase tracking-wide text-zinc-400 bg-zinc-800/80 px-1.5 py-0.5 rounded"
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

const Spinner = () => (
  <div className="rounded-xl border border-zinc-800 p-8 text-center text-sm text-zinc-400">
    Loading...
  </div>
);

const EmptyState = () => (
  <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-400">
    No pending submissions.
  </div>
);

const ErrorBox = ({ message }: { message: string }) => (
  <div className="rounded-xl border border-rose-900/40 bg-rose-950/30 p-5 text-sm text-rose-300">
    {message}
  </div>
);
