import { useEffect, useState } from 'react';

import { formatSyncCode, normalizeSyncCode, SyncCode } from '@dotlearn/contracts';
import { useNavigate, useSearch } from '@tanstack/react-router';
import {
  Eye,
  EyeOff,
  Info,
  KeyRound,
  Link2,
  QrCode,
  RefreshCw,
  Unlink,
  X as CloseIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { CopyButton } from '@/components/playground/CopyButton';
import { Button } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { Dialog } from '@/components/ui/Dialog';
import { ApiError } from '@/lib/api-client';
import { listSyncBackups, type SyncBackupRecord } from '@/lib/progress-db';
import {
  createAndLink,
  linkWithCode,
  restoreBackup,
  syncNow,
  unlink,
  useSync,
  type SyncStatus,
} from '@/lib/sync/engine';
import type { SettingsSearch } from '@/router';

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** `ABCD-2345-6789` -> `ABCD····6789`, the display convention for a linked code at rest. */
const maskCode = (formatted: string): string => {
  const [first, , last] = formatted.split('-');
  return `${first ?? ''}····${last ?? ''}`;
};

const syncDeepLinkUrl = (canonicalCode: string): string =>
  `${window.location.origin}/settings?sync=${canonicalCode}`;

interface SyncQrDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canonicalCode: string;
}

/**
 * Renders a QR of the deep-link URL for `canonicalCode`. `uqr` (zero-dep, MIT) is imported
 * dynamically only while this dialog is open, so it never lands in the eager bundle or even the
 * settings chunk — only a dedicated async chunk loaded on demand.
 */
const SyncQrDialog = ({ open, onOpenChange, canonicalCode }: SyncQrDialogProps) => {
  const { t } = useTranslation('settings');
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setSvg(null);
    void import('uqr').then(({ renderSVG }) => {
      if (cancelled) return;
      setSvg(
        renderSVG(syncDeepLinkUrl(canonicalCode), {
          pixelSize: 6,
          whiteColor: '#ffffff',
          blackColor: '#0a0a0a',
          border: 2,
        }),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [open, canonicalCode]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('sync.qr.dialogTitle')}
      placement="center"
      size="sm"
    >
      <div className="space-y-3">
        <div
          className={cx(
            'mx-auto grid size-56 place-items-center rounded-lg bg-white p-3',
            '[&>svg]:block [&>svg]:size-full',
          )}
        >
          {svg ? (
            <div className="contents" dangerouslySetInnerHTML={{ __html: svg }} />
          ) : (
            <span className="text-xs text-fg-subtle">…</span>
          )}
        </div>
        <p className="text-center font-mono text-sm tracking-wider text-fg">
          {formatSyncCode(canonicalCode)}
        </p>
        <p className="text-[13px] text-fg-subtle">{t('sync.qr.caption')}</p>
      </div>
    </Dialog>
  );
};

interface HelpDisclosureProps {
  open: boolean;
  onToggle: () => void;
}

const HelpDisclosure = ({ open, onToggle }: HelpDisclosureProps) => {
  const { t } = useTranslation('settings');
  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={t('sync.helpAria')}
        className="grid size-8 shrink-0 place-items-center rounded-full text-fg-subtle transition-colors hover:bg-surface-2/60 hover:text-fg"
      >
        <Info size={16} />
      </button>
      {open && (
        <div className="col-span-full rounded-lg border border-border-base bg-surface-2/40 p-3 text-[13px] leading-relaxed text-fg-muted space-y-1.5">
          <p className="font-medium text-fg">{t('sync.help.title')}</p>
          <p>{t('sync.help.p1')}</p>
          <p>{t('sync.help.p2')}</p>
          <p>{t('sync.help.p3')}</p>
          <p>{t('sync.help.p4')}</p>
          <p>{t('sync.help.p5')}</p>
        </div>
      )}
    </>
  );
};

const CodeReveal = ({ code, onDismiss }: { code: string; onDismiss: () => void }) => {
  const { t } = useTranslation('settings');
  const [qrOpen, setQrOpen] = useState(false);
  return (
    <div className="rounded-lg border border-accent/40 bg-accent/[0.06] p-3 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-lg tracking-[0.15em] text-fg">{code}</span>
        <div className="flex shrink-0 items-center gap-1">
          <CopyButton text={code} />
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            aria-label={t('sync.qr.button')}
            title={t('sync.qr.button')}
            className="grid size-7 place-items-center rounded-md text-fg-subtle hover:bg-surface-2/60 hover:text-fg"
          >
            <QrCode size={14} />
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t('sync.dismissCreated')}
            className="grid size-7 place-items-center rounded-md text-fg-subtle hover:bg-surface-2/60 hover:text-fg"
          >
            <CloseIcon size={14} />
          </button>
        </div>
      </div>
      <p className="text-[13px] text-fg-muted">{t('sync.codeCreatedNote')}</p>
      <SyncQrDialog
        open={qrOpen}
        onOpenChange={setQrOpen}
        canonicalCode={normalizeSyncCode(code)}
      />
    </div>
  );
};

interface NotLinkedSectionProps {
  onCreated: (formattedCode: string) => void;
  onLinked: () => void;
}

const NotLinkedSection = ({ onCreated, onLinked }: NotLinkedSectionProps) => {
  const { t } = useTranslation('settings');
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const handleCreate = async (): Promise<void> => {
    setCreating(true);
    try {
      const raw = await createAndLink();
      onCreated(formatSyncCode(normalizeSyncCode(raw)));
    } catch {
      toast.error(t('sync.createError'));
    } finally {
      setCreating(false);
    }
  };

  const handleLink = async (): Promise<void> => {
    setLinking(true);
    setLinkError(null);
    try {
      await linkWithCode(codeInput);
      setCodeInput('');
      setShowForm(false);
      toast.success(t('sync.linkedToast'));
      onLinked();
    } catch (error) {
      if (error instanceof Error && error.message === 'invalid') {
        setLinkError(t('sync.errors.invalid'));
      } else if (error instanceof ApiError && error.status === 404) {
        setLinkError(t('sync.errors.notFound'));
      } else {
        setLinkError(t('sync.errors.network'));
      }
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-[13px] text-fg-subtle">{t('sync.notLinkedHint')}</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button
          variant="outline"
          leadingIcon={<Link2 size={15} />}
          loading={creating}
          className="w-full sm:w-auto"
          onClick={() => void handleCreate()}
        >
          {t('sync.create')}
        </Button>
        <Button
          variant="ghost"
          leadingIcon={<KeyRound size={15} />}
          className="w-full sm:w-auto"
          onClick={() => setShowForm((value) => !value)}
        >
          {t('sync.enter')}
        </Button>
      </div>
      {showForm && (
        <div className="rounded-lg border border-border-base bg-surface-2/30 p-3 space-y-2">
          <label className="block text-[13px] font-medium text-fg" htmlFor="sync-code-input">
            {t('sync.codeInputLabel')}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="sync-code-input"
              type="text"
              value={codeInput}
              onChange={(event) => setCodeInput(event.target.value)}
              placeholder={t('sync.codeInputPlaceholder')}
              autoComplete="off"
              spellCheck={false}
              className="min-h-[var(--tap)] flex-1 rounded-md border border-border-base bg-surface px-3 font-mono text-sm tracking-wider text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent/50 sm:min-h-0 sm:py-1.5"
            />
            <Button
              variant="primary"
              size="md"
              loading={linking}
              disabled={codeInput.trim().length === 0}
              className="w-full sm:w-auto"
              onClick={() => void handleLink()}
            >
              {t('sync.link')}
            </Button>
          </div>
          {linkError && <p className="text-[13px] text-err">{linkError}</p>}
        </div>
      )}
    </div>
  );
};

interface RestoreDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RestoreDialog = ({ open, onOpenChange }: RestoreDialogProps) => {
  const { t } = useTranslation('settings');
  const [backups, setBackups] = useState<SyncBackupRecord[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedId(null);
    void listSyncBackups().then(setBackups);
  }, [open]);

  const handleRestore = async (): Promise<void> => {
    if (selectedId === null) return;
    setRestoring(true);
    try {
      await restoreBackup(selectedId);
      toast.success(t('sync.restoreSuccess'));
      onOpenChange(false);
    } catch {
      toast.error(t('sync.restoreError'));
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('sync.restoreDialogTitle')}
      size="md"
      placement="center"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('sync.restoreCancel')}
          </Button>
          <Button
            variant="danger"
            loading={restoring}
            disabled={selectedId === null}
            onClick={() => void handleRestore()}
          >
            {t('sync.restoreConfirm')}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-fg-muted">{t('sync.restoreDialogWarning')}</p>
        {backups.length === 0 ? (
          <p className="text-sm text-fg-subtle">{t('sync.restoreEmpty')}</p>
        ) : (
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {backups.map((backup) => (
              <li key={backup.id}>
                <label
                  className={cx(
                    'flex min-h-[var(--tap)] cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors sm:min-h-0',
                    selectedId === backup.id
                      ? 'border-accent bg-accent/[0.06]'
                      : 'border-border-base hover:bg-surface-2/40',
                  )}
                >
                  <input
                    type="radio"
                    name="sync-backup"
                    checked={selectedId === backup.id}
                    onChange={() => setSelectedId(backup.id ?? null)}
                    className="shrink-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-fg">
                      {new Date(backup.createdAt).toLocaleString()}
                    </span>
                    <span className="block text-xs text-fg-subtle">
                      {t(`sync.backupReason.${backup.reason}`)} · {formatBytes(backup.sizeBytes)}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialog>
  );
};

const LinkedSection = ({ status }: { status: SyncStatus }) => {
  const { t } = useTranslation('settings');
  const [revealed, setRevealed] = useState(false);
  const [unlinkOpen, setUnlinkOpen] = useState(false);
  const [deleteRemote, setDeleteRemote] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  const formatted = status.code ? formatSyncCode(normalizeSyncCode(status.code)) : '';

  const formatRelative = (ms: number): string => {
    const seconds = Math.max(1, Math.floor((Date.now() - ms) / 1000));
    if (seconds < 60) return t('sync.ago.seconds', { count: seconds });
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return t('sync.ago.minutes', { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t('sync.ago.hours', { count: hours });
    const days = Math.floor(hours / 24);
    if (days < 30) return t('sync.ago.days', { count: days });
    const months = Math.floor(days / 30);
    return t('sync.ago.months', { count: months });
  };

  const statusText = (): string => {
    const parts: string[] = [];
    if (status.phase === 'syncing') {
      parts.push(t('sync.status.syncing'));
    } else if (status.phase === 'offline') {
      parts.push(t('sync.status.offline'));
    } else if (status.phase === 'too-large') {
      parts.push(t('sync.status.tooLarge'));
    } else if (status.phase === 'error') {
      parts.push(
        status.lastError === 'not-found'
          ? t('sync.status.notFoundError')
          : t('sync.status.genericError'),
      );
    } else {
      const when = status.lastSyncAt !== null ? formatRelative(status.lastSyncAt) : '—';
      parts.push(t('sync.status.idle', { when }));
    }
    if (status.pending) {
      parts.push(t('sync.status.pendingSuffix'));
    }
    return parts.join(' · ');
  };

  const handleSyncNow = async (): Promise<void> => {
    try {
      await syncNow();
    } catch {
      toast.error(t('sync.syncNowError'));
    }
  };

  const handleUnlink = async (): Promise<void> => {
    setUnlinking(true);
    try {
      await unlink({ deleteRemote });
      toast.success(t('sync.unlinkedToast'));
      setUnlinkOpen(false);
      setDeleteRemote(false);
    } catch {
      toast.error(t('sync.unlinkError'));
    } finally {
      setUnlinking(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm tracking-wider text-fg">
          {revealed ? formatted : maskCode(formatted)}
        </span>
        <button
          type="button"
          onClick={() => setRevealed((value) => !value)}
          aria-label={revealed ? t('sync.hideCode') : t('sync.showCode')}
          title={revealed ? t('sync.hideCode') : t('sync.showCode')}
          className="grid size-7 place-items-center rounded-md text-fg-subtle hover:bg-surface-2/60 hover:text-fg"
        >
          {revealed ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
        <CopyButton text={formatted} />
      </div>
      <p className="text-[13px] text-fg-subtle">{statusText()}</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button
          variant="outline"
          leadingIcon={
            <RefreshCw
              size={15}
              className={status.phase === 'syncing' ? 'animate-spin' : undefined}
            />
          }
          disabled={status.phase === 'syncing'}
          className="w-full sm:w-auto"
          onClick={() => void handleSyncNow()}
        >
          {t('sync.syncNow')}
        </Button>
        <Button
          variant="outline"
          leadingIcon={<QrCode size={15} />}
          className="w-full sm:w-auto"
          onClick={() => setQrOpen(true)}
        >
          {t('sync.qr.button')}
        </Button>
        <Button
          variant="ghost"
          leadingIcon={<Unlink size={15} />}
          className="w-full text-err hover:bg-err/10 hover:text-err sm:w-auto"
          onClick={() => setUnlinkOpen(true)}
        >
          {t('sync.unlink')}
        </Button>
      </div>
      <button
        type="button"
        onClick={() => setRestoreOpen(true)}
        className="text-[13px] font-medium text-accent hover:underline"
      >
        {t('sync.restoreLink')}
      </button>

      <Dialog
        open={unlinkOpen}
        onOpenChange={setUnlinkOpen}
        title={t('sync.unlinkConfirmTitle')}
        description={t('sync.unlinkConfirmBody')}
        placement="center"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setUnlinkOpen(false)}>
              {t('sync.unlinkCancel')}
            </Button>
            <Button
              variant="danger"
              leadingIcon={<Unlink size={15} />}
              loading={unlinking}
              onClick={() => void handleUnlink()}
            >
              {t('sync.unlinkConfirm')}
            </Button>
          </>
        }
      >
        <label className="flex items-center gap-2 text-sm text-fg">
          <input
            type="checkbox"
            checked={deleteRemote}
            onChange={(event) => setDeleteRemote(event.target.checked)}
          />
          {t('sync.unlinkDeleteRemote')}
        </label>
      </Dialog>

      <RestoreDialog open={restoreOpen} onOpenChange={setRestoreOpen} />
      {status.code && (
        <SyncQrDialog
          open={qrOpen}
          onOpenChange={setQrOpen}
          canonicalCode={normalizeSyncCode(status.code)}
        />
      )}
    </div>
  );
};

interface DeepLinkState {
  code: string; // canonical
  open: boolean;
}

interface DeepLinkDialogProps {
  state: DeepLinkState | null;
  currentCode: string | null; // canonical code this device is currently linked to, if any
  onOpenChange: (open: boolean) => void;
  onLinked: () => void;
}

/**
 * Confirms a `/settings?sync=<code>` deep link before acting on it. The link itself is stripped
 * from the URL as soon as SyncPanel reads it (see useEffect in SyncPanel); this dialog only ever
 * sees an already-normalized, already-validated canonical code.
 */
const DeepLinkDialog = ({ state, currentCode, onOpenChange, onLinked }: DeepLinkDialogProps) => {
  const { t } = useTranslation('settings');
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const code = state?.code ?? '';
  const open = state?.open ?? false;
  const replacesExisting = currentCode !== null && currentCode !== code;

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  const handleConfirm = async (): Promise<void> => {
    setLinking(true);
    setError(null);
    try {
      if (replacesExisting) {
        await unlink({ deleteRemote: false });
      }
      await linkWithCode(code);
      toast.success(t('sync.linkedToast'));
      onOpenChange(false);
      onLinked();
    } catch (err) {
      if (err instanceof Error && err.message === 'invalid') {
        setError(t('sync.errors.invalid'));
      } else if (err instanceof ApiError && err.status === 404) {
        setError(t('sync.errors.notFound'));
      } else {
        setError(t('sync.errors.network'));
      }
    } finally {
      setLinking(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('sync.deepLink.confirmTitle', { code: maskCode(formatSyncCode(code)) })}
      placement="center"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('sync.deepLink.cancel')}
          </Button>
          <Button
            variant="primary"
            leadingIcon={<Link2 size={15} />}
            loading={linking}
            onClick={() => void handleConfirm()}
          >
            {t('sync.deepLink.confirm')}
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        {replacesExisting && (
          <p className="text-sm text-warn">{t('sync.deepLink.replaceWarning')}</p>
        )}
        {error && <p className="text-[13px] text-err">{error}</p>}
      </div>
    </Dialog>
  );
};

export const SyncPanel = () => {
  const { t } = useTranslation('settings');
  const status = useSync();
  const [helpOpen, setHelpOpen] = useState(false);
  const [justCreatedCode, setJustCreatedCode] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<DeepLinkState | null>(null);

  const search = useSearch({ from: '/settings' });
  const navigate = useNavigate();

  // Deep link: /settings?sync=<code>. Strip the param from the URL immediately on detection
  // (history-replace, before any async work) so the code never lingers in the URL/history, then
  // normalize + validate and open a confirm dialog. Malformed input is dropped silently.
  useEffect(() => {
    const raw = search.sync;
    if (!raw) return;
    void navigate({
      to: '/settings',
      search: (prev: SettingsSearch) => {
        const { sync: _sync, ...rest } = prev;
        return rest;
      },
      replace: true,
    });
    const normalized = normalizeSyncCode(raw);
    const parsed = SyncCode.safeParse(normalized);
    if (!parsed.success) {
      console.warn('[sync] ignoring malformed deep-link code');
      return;
    }
    setDeepLink({ code: parsed.data, open: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.sync]);

  return (
    <div className="rounded-lg border border-border-base bg-surface-2/30 p-4">
      <div className="grid grid-cols-[1fr_auto] items-start gap-3">
        <h3 className="text-sm font-medium text-fg">{t('sync.heading')}</h3>
        <HelpDisclosure open={helpOpen} onToggle={() => setHelpOpen((value) => !value)} />
      </div>
      <div className="mt-3 space-y-3">
        {justCreatedCode && (
          <CodeReveal code={justCreatedCode} onDismiss={() => setJustCreatedCode(null)} />
        )}
        {status.linked ? (
          <LinkedSection status={status} />
        ) : (
          <NotLinkedSection
            onCreated={setJustCreatedCode}
            onLinked={() => setJustCreatedCode(null)}
          />
        )}
      </div>

      <DeepLinkDialog
        state={deepLink}
        currentCode={status.linked ? status.code : null}
        onOpenChange={(open) => setDeepLink((prev) => (prev ? { ...prev, open } : prev))}
        onLinked={() => setJustCreatedCode(null)}
      />
    </div>
  );
};
