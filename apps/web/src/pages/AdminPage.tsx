import { useCallback, useEffect, useMemo, useState } from 'react';

import type {
  HiddenTopic,
  Submission,
  SubmissionStatus,
  TopicManifest,
} from '@dotlearn/contracts';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { StepUpDialog } from '@/components/StepUpDialog';
import { SubmissionStatusBadge } from '@/components/SubmissionStatusBadge';
import { cx } from '@/components/ui/cx';
import {
  ApiError,
  StepUpRequiredError,
  hideTopic,
  listAdminSubmissions,
  listHiddenTopics,
  markSubmissionMaterialized,
  reviewSubmission,
  unhideTopic,
} from '@/lib/api-client';
import { useAuth } from '@/lib/auth/AuthContext';
import { invalidateHiddenTopicsCache, listAllManifestsIgnoringHidden } from '@/lib/topics';
import { AdminLoginPage } from './AdminLoginPage';

type TabKey = SubmissionStatus | 'hidden';

const SUBMISSION_TABS: SubmissionStatus[] = ['pending', 'approved', 'materialized', 'rejected'];

interface SubmissionsTabState {
  submissions: Submission[];
  query: string;
  notes: Record<string, string>;
  materializeSlugs: Record<string, string>;
  pending: string | null;
}

const initialSubmissionsTab = (): SubmissionsTabState => ({
  submissions: [],
  query: '',
  notes: {},
  materializeSlugs: {},
  pending: null,
});

interface PendingStepUp {
  action: string;
  retry: () => Promise<void>;
}

export const AdminPage = () => {
  const { t } = useTranslation('admin');
  const { state: authState, logout, logoutAll } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('pending');
  const [tabState, setTabState] = useState<Record<SubmissionStatus, SubmissionsTabState>>({
    pending: initialSubmissionsTab(),
    approved: initialSubmissionsTab(),
    materialized: initialSubmissionsTab(),
    rejected: initialSubmissionsTab(),
  });
  const [loadingTab, setLoadingTab] = useState<TabKey | null>(null);
  const [errorByTab, setErrorByTab] = useState<Partial<Record<TabKey, string>>>({});

  const [hiddenTopics, setHiddenTopics] = useState<HiddenTopic[]>([]);
  const [allTopics, setAllTopics] = useState<TopicManifest[]>([]);
  const [hidingSlug, setHidingSlug] = useState<string | null>(null);
  const [pendingStepUp, setPendingStepUp] = useState<PendingStepUp | null>(null);

  const guardedAction = useCallback(
    async (run: () => Promise<void>): Promise<void> => {
      try {
        await run();
      } catch (error) {
        if (error instanceof StepUpRequiredError) {
          setPendingStepUp({
            action: error.action,
            retry: async () => {
              await run();
            },
          });
          return;
        }
        throw error;
      }
    },
    [],
  );

  const updateSubmissionsTab = useCallback(
    (status: SubmissionStatus, updater: (prev: SubmissionsTabState) => SubmissionsTabState) => {
      setTabState((prev) => ({ ...prev, [status]: updater(prev[status]) }));
    },
    [],
  );

  const loadSubmissions = useCallback(
    async (status: SubmissionStatus) => {
      setLoadingTab(status);
      setErrorByTab((prev) => {
        const next = { ...prev };
        delete next[status];
        return next;
      });
      try {
        const submissions = await listAdminSubmissions(status);
        updateSubmissionsTab(status, (prev) => ({ ...prev, submissions }));
      } catch (error) {
        const message =
          error instanceof ApiError
            ? t('apiUnavailable', { status: error.status })
            : t('networkError');
        setErrorByTab((prev) => ({ ...prev, [status]: message }));
      } finally {
        setLoadingTab((current) => (current === status ? null : current));
      }
    },
    [t, updateSubmissionsTab],
  );

  const loadHidden = useCallback(async () => {
    setLoadingTab('hidden');
    setErrorByTab((prev) => {
      const next = { ...prev };
      delete next.hidden;
      return next;
    });
    try {
      const [hidden, topics] = await Promise.all([
        listHiddenTopics(),
        listAllManifestsIgnoringHidden(),
      ]);
      setHiddenTopics(hidden);
      setAllTopics(topics);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? t('apiUnavailable', { status: error.status })
          : t('networkError');
      setErrorByTab((prev) => ({ ...prev, hidden: message }));
    } finally {
      setLoadingTab((current) => (current === 'hidden' ? null : current));
    }
  }, [t]);

  useEffect(() => {
    if (activeTab === 'hidden') {
      void loadHidden();
    } else {
      void loadSubmissions(activeTab);
    }
  }, [activeTab, loadHidden, loadSubmissions]);

  const handleReview = async (
    submission: Submission,
    decision: 'approve' | 'reject',
  ): Promise<void> => {
    const note = tabState.pending.notes[submission.id]?.trim();
    updateSubmissionsTab('pending', (prev) => ({ ...prev, pending: submission.id }));
    try {
      await guardedAction(async () => {
        await reviewSubmission(submission.id, {
          decision,
          ...(note ? { reviewerNote: note } : {}),
        });
        toast.success(t(`toast.${decision}d`, { title: submission.payload.title }));
        await loadSubmissions('pending');
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : t('networkError');
      toast.error(t('reviewFailed', { message }));
    } finally {
      updateSubmissionsTab('pending', (prev) => ({ ...prev, pending: null }));
    }
  };

  const handleMaterialize = async (submission: Submission): Promise<void> => {
    const slug = tabState.approved.materializeSlugs[submission.id]?.trim();
    const note = tabState.approved.notes[submission.id]?.trim();
    updateSubmissionsTab('approved', (prev) => ({ ...prev, pending: submission.id }));
    try {
      await guardedAction(async () => {
        await markSubmissionMaterialized(submission.id, {
          ...(slug ? { materializedSlug: slug } : {}),
          ...(note ? { reviewerNote: note } : {}),
        });
        toast.success(t('toast.materialized', { title: submission.payload.title }));
        await loadSubmissions('approved');
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : t('networkError');
      toast.error(t('materializeFailed', { message }));
    } finally {
      updateSubmissionsTab('approved', (prev) => ({ ...prev, pending: null }));
    }
  };

  const handleHide = async (slug: string): Promise<void> => {
    setHidingSlug(slug);
    try {
      await guardedAction(async () => {
        await hideTopic(slug, {});
        invalidateHiddenTopicsCache();
        toast.success(t('toast.hidden', { slug }));
        await loadHidden();
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : t('networkError');
      toast.error(t('hideFailed', { message }));
    } finally {
      setHidingSlug(null);
    }
  };

  const handleUnhide = async (slug: string): Promise<void> => {
    setHidingSlug(slug);
    try {
      await guardedAction(async () => {
        await unhideTopic(slug);
        invalidateHiddenTopicsCache();
        toast.success(t('toast.unhidden', { slug }));
        await loadHidden();
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : t('networkError');
      toast.error(t('unhideFailed', { message }));
    } finally {
      setHidingSlug(null);
    }
  };

  const handleLogoutAll = async (): Promise<void> => {
    try {
      await guardedAction(async () => {
        await logoutAll();
        toast.success(t('toast.logoutAll'));
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : t('networkError');
      toast.error(t('logoutAllFailed', { message }));
    }
  };

  if (authState.status === 'unknown') {
    return (
      <div className="rounded-xl border border-border-base p-8 text-center text-sm text-fg-muted">
        {t('loading')}
      </div>
    );
  }

  if (authState.status === 'unauthenticated') {
    return <AdminLoginPage />;
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-fg-muted max-w-2xl">{t('subtitle')}</p>
          <p className="mt-1 text-xs text-fg-subtle">
            {t('session', { login: authState.login })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              activeTab === 'hidden' ? void loadHidden() : void loadSubmissions(activeTab)
            }
            className="px-3 py-1.5 rounded-md text-sm border border-border-strong hover:bg-surface"
          >
            {t('refresh')}
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            className="px-3 py-1.5 rounded-md text-sm border border-border-strong hover:bg-surface"
          >
            {t('logout')}
          </button>
          <button
            type="button"
            onClick={() => void handleLogoutAll()}
            className="px-3 py-1.5 rounded-md text-sm border border-rose-700/50 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20"
            title={t('logoutAllHint')}
          >
            {t('logoutAll')}
          </button>
        </div>
      </header>

      <nav role="tablist" className="flex flex-wrap gap-1 border-b border-border-base">
        {SUBMISSION_TABS.map((tab) => (
          <TabButton
            key={tab}
            active={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            label={t(`tabs.${tab}`)}
            badge={tabState[tab].submissions.length || undefined}
          />
        ))}
        <TabButton
          active={activeTab === 'hidden'}
          onClick={() => setActiveTab('hidden')}
          label={t('tabs.hidden')}
          badge={hiddenTopics.length || undefined}
        />
      </nav>

      {loadingTab === activeTab && <SkeletonList />}
      {errorByTab[activeTab] ? <ErrorBox message={errorByTab[activeTab] ?? ''} /> : null}

      {activeTab !== 'hidden' && loadingTab !== activeTab && !errorByTab[activeTab] && (
        <SubmissionsTab
          status={activeTab}
          state={tabState[activeTab]}
          onQueryChange={(query) =>
            updateSubmissionsTab(activeTab, (prev) => ({ ...prev, query }))
          }
          onNoteChange={(id, value) =>
            updateSubmissionsTab(activeTab, (prev) => ({
              ...prev,
              notes: { ...prev.notes, [id]: value },
            }))
          }
          onMaterializeSlugChange={(id, value) =>
            updateSubmissionsTab(activeTab, (prev) => ({
              ...prev,
              materializeSlugs: { ...prev.materializeSlugs, [id]: value },
            }))
          }
          onReview={handleReview}
          onMaterialize={handleMaterialize}
        />
      )}

      {activeTab === 'hidden' && loadingTab !== 'hidden' && !errorByTab.hidden && (
        <HiddenTopicsTab
          allTopics={allTopics}
          hidden={hiddenTopics}
          hidingSlug={hidingSlug}
          onHide={handleHide}
          onUnhide={handleUnhide}
        />
      )}

      <StepUpDialog
        action={pendingStepUp?.action ?? null}
        onCancel={() => setPendingStepUp(null)}
        onVerified={() => {
          const pending = pendingStepUp;
          setPendingStepUp(null);
          if (pending) {
            void pending.retry().catch((error) => {
              const message =
                error instanceof ApiError ? error.message : t('networkError');
              toast.error(t('reviewFailed', { message }));
            });
          }
        }}
      />
    </div>
  );
};

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: number | undefined;
}

const TabButton = ({ active, onClick, label, badge }: TabButtonProps) => (
  <button
    type="button"
    role="tab"
    aria-selected={active}
    onClick={onClick}
    className={cx(
      '-mb-px px-3 py-2 text-sm border-b-2 transition-colors',
      active
        ? 'border-indigo-500 text-fg'
        : 'border-transparent text-fg-muted hover:text-fg',
    )}
  >
    {label}
    {typeof badge === 'number' && (
      <span className="ml-2 text-[10px] uppercase tracking-wide text-fg-subtle bg-surface-2/80 px-1.5 py-0.5 rounded">
        {badge}
      </span>
    )}
  </button>
);

interface SubmissionsTabProps {
  status: SubmissionStatus;
  state: SubmissionsTabState;
  onQueryChange: (query: string) => void;
  onNoteChange: (id: string, value: string) => void;
  onMaterializeSlugChange: (id: string, value: string) => void;
  onReview: (submission: Submission, decision: 'approve' | 'reject') => void;
  onMaterialize: (submission: Submission) => void;
}

const SubmissionsTab = ({
  status,
  state,
  onQueryChange,
  onNoteChange,
  onMaterializeSlugChange,
  onReview,
  onMaterialize,
}: SubmissionsTabProps) => {
  const { t } = useTranslation('admin');
  const query = state.query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!query) return state.submissions;
    return state.submissions.filter((submission) => {
      const haystack = [
        submission.payload.title,
        submission.payload.outline,
        submission.payload.tags.join(' '),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [state.submissions, query]);

  if (state.submissions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border-base p-8 text-center text-sm text-fg-muted">
        {t('empty')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <input
        type="search"
        value={state.query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder={t('searchPlaceholder')}
        className="w-full max-w-md rounded-lg border border-border-base bg-surface/60 px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:border-indigo-500/60"
      />
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-base p-6 text-center text-sm text-fg-muted">
          {t('searchEmpty')}
        </div>
      ) : (
        <ul className="space-y-4">
          {filtered.map((submission) => (
            <li key={submission.id}>
              <SubmissionRow
                submission={submission}
                noteValue={state.notes[submission.id] ?? ''}
                materializeSlug={state.materializeSlugs[submission.id] ?? ''}
                busy={state.pending === submission.id}
                onNoteChange={(value) => onNoteChange(submission.id, value)}
                onMaterializeSlugChange={(value) =>
                  onMaterializeSlugChange(submission.id, value)
                }
                onApprove={() => onReview(submission, 'approve')}
                onReject={() => onReview(submission, 'reject')}
                onMaterialize={() => onMaterialize(submission)}
                canReview={status === 'pending'}
                canMaterialize={status === 'approved'}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

interface SubmissionRowProps {
  submission: Submission;
  noteValue: string;
  materializeSlug: string;
  busy: boolean;
  onNoteChange: (value: string) => void;
  onMaterializeSlugChange: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
  onMaterialize: () => void;
  canReview: boolean;
  canMaterialize: boolean;
}

const SubmissionRow = ({
  submission,
  noteValue,
  materializeSlug,
  busy,
  onNoteChange,
  onMaterializeSlugChange,
  onApprove,
  onReject,
  onMaterialize,
  canReview,
  canMaterialize,
}: SubmissionRowProps) => {
  const { t } = useTranslation('admin');
  const date = new Date(submission.createdAt);
  return (
    <article className="rounded-xl border border-border-base bg-surface/60 p-5 space-y-3">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h3 className="font-semibold text-fg">{submission.payload.title}</h3>
          <div className="mt-1 flex flex-wrap gap-2 text-xs text-fg-subtle">
            <span>{submission.source}</span>
            <span aria-hidden>·</span>
            <span>{date.toLocaleString()}</span>
            <span aria-hidden>·</span>
            <span>{submission.payload.suggestedRuntime}</span>
            <span aria-hidden>·</span>
            <span>{submission.payload.suggestedDifficulty}</span>
            {submission.materializedSlug && (
              <>
                <span aria-hidden>·</span>
                <span className="text-emerald-300">→ {submission.materializedSlug}</span>
              </>
            )}
          </div>
        </div>
        <SubmissionStatusBadge status={submission.status} />
      </header>

      <p className="text-sm text-fg whitespace-pre-wrap">{submission.payload.outline}</p>

      {submission.payload.tags.length > 0 && (
        <ul className="flex flex-wrap gap-1">
          {submission.payload.tags.map((tag: string) => (
            <li
              key={tag}
              className="text-[10px] uppercase tracking-wide text-fg-muted bg-surface-2/80 px-1.5 py-0.5 rounded"
            >
              {tag}
            </li>
          ))}
        </ul>
      )}

      {submission.payload.contactEmail && (
        <div className="text-xs text-fg-subtle">
          {t('fields.contactEmail')}: {submission.payload.contactEmail}
        </div>
      )}
      {submission.payload.notes && (
        <div className="text-xs text-fg-subtle whitespace-pre-wrap">
          {t('fields.notes')}: {submission.payload.notes}
        </div>
      )}
      {submission.reviewerNote && (
        <div className="rounded-md border border-border-base bg-surface-2/40 p-2 text-xs text-fg-muted">
          <span className="text-fg-subtle uppercase tracking-wide text-[10px]">
            {t('fields.reviewerNote')}
          </span>
          <div className="mt-1 whitespace-pre-wrap text-fg-muted">
            {submission.reviewerNote}
          </div>
        </div>
      )}

      {(canReview || canMaterialize) && (
        <div className="space-y-3 pt-3 border-t border-border-base/60">
          {canMaterialize && (
            <label className="block">
              <span className="block text-[11px] uppercase tracking-wide text-fg-subtle mb-1">
                {t('fields.materializedSlug')}
              </span>
              <input
                type="text"
                value={materializeSlug}
                onChange={(event) => onMaterializeSlugChange(event.target.value)}
                placeholder="e.g. sql-window-functions"
                className="w-full max-w-md rounded-md border border-border-base bg-surface/60 px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500/60"
              />
            </label>
          )}
          <label className="block">
            <span className="block text-[11px] uppercase tracking-wide text-fg-subtle mb-1">
              {t('fields.reviewerNote')}
            </span>
            <textarea
              value={noteValue}
              onChange={(event) => onNoteChange(event.target.value)}
              rows={2}
              placeholder={t('fields.reviewerNotePlaceholder')}
              className="w-full rounded-md border border-border-base bg-surface/60 px-3 py-2 text-sm focus:outline-none focus:border-indigo-500/60"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {canReview && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onApprove}
                  className="px-3 py-1.5 rounded-md text-sm bg-emerald-500 text-emerald-950 font-medium hover:bg-emerald-400 disabled:opacity-50"
                >
                  {t('approve')}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={onReject}
                  className="px-3 py-1.5 rounded-md text-sm bg-rose-500/20 text-rose-200 border border-rose-700/50 hover:bg-rose-500/30 disabled:opacity-50"
                >
                  {t('reject')}
                </button>
              </>
            )}
            {canMaterialize && (
              <button
                type="button"
                disabled={busy}
                onClick={onMaterialize}
                className="px-3 py-1.5 rounded-md text-sm bg-indigo-500 text-white font-medium hover:bg-indigo-400 disabled:opacity-50"
              >
                {t('actions.markMaterialized')}
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  );
};

interface HiddenTopicsTabProps {
  allTopics: TopicManifest[];
  hidden: HiddenTopic[];
  hidingSlug: string | null;
  onHide: (slug: string) => void;
  onUnhide: (slug: string) => void;
}

const HiddenTopicsTab = ({
  allTopics,
  hidden,
  hidingSlug,
  onHide,
  onUnhide,
}: HiddenTopicsTabProps) => {
  const { t } = useTranslation('admin');
  const hiddenSet = useMemo(() => new Set(hidden.map((entry) => entry.slug)), [hidden]);

  if (allTopics.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border-base p-8 text-center text-sm text-fg-muted">
        {t('hidden.empty')}
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {allTopics.map((manifest) => {
        const isHidden = hiddenSet.has(manifest.slug);
        const busy = hidingSlug === manifest.slug;
        return (
          <li
            key={manifest.slug}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border-base bg-surface/60 px-4 py-3"
          >
            <div className="min-w-0">
              <div className="font-medium text-fg">{manifest.title}</div>
              <div className="text-xs text-fg-subtle">
                {manifest.slug} · {manifest.runtime} · {manifest.difficulty}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={cx(
                  'text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 border',
                  isHidden
                    ? 'text-rose-200 border-rose-500/40 bg-rose-500/10'
                    : 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
                )}
              >
                {isHidden ? t('hidden.statusHidden') : t('hidden.statusVisible')}
              </span>
              {isHidden ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onUnhide(manifest.slug)}
                  className="px-3 py-1 rounded-md text-xs bg-surface-2 hover:bg-surface-3 disabled:opacity-50"
                >
                  {t('actions.unhide')}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onHide(manifest.slug)}
                  className="px-3 py-1 rounded-md text-xs bg-rose-500/20 text-rose-200 border border-rose-700/50 hover:bg-rose-500/30 disabled:opacity-50"
                >
                  {t('actions.hide')}
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
};

const SkeletonList = () => (
  <ul className="space-y-3" aria-hidden>
    {[0, 1, 2].map((index) => (
      <li
        key={index}
        className="h-28 rounded-xl border border-border-base bg-surface/40 animate-pulse"
      />
    ))}
  </ul>
);

const ErrorBox = ({ message }: { message: string }) => (
  <div className="rounded-xl border border-rose-900/40 bg-rose-950/30 p-5 text-sm text-rose-300">
    {message}
  </div>
);
