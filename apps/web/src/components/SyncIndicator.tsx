// Header status pill for the cross-device sync engine. Statically imports `useSync` (fine here —
// this file is itself lazy-loaded from Layout, see Layout.tsx), so pulling in the sync engine
// (+merge+codec) never lands in the eager entry chunk. Renders nothing for the (most common)
// not-linked case.

import { Link } from '@tanstack/react-router';
import { Cloud, CloudAlert, CloudOff, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cx } from '@/components/ui/cx';
import { useSync, type SyncPhase } from '@/lib/sync/engine';

const TONE_CLASSES: Record<SyncPhase, string> = {
  idle: 'border-ok/40 text-ok',
  syncing: 'border-accent/40 text-accent',
  offline: 'border-border-base/70 text-fg-muted',
  error: 'border-warn/40 text-warn',
  'too-large': 'border-warn/40 text-warn',
};

const DOT_CLASSES: Record<SyncPhase, string> = {
  idle: 'bg-ok',
  syncing: 'bg-accent',
  offline: 'bg-fg-muted',
  error: 'bg-warn',
  'too-large': 'bg-warn',
};

const STATUS_KEY: Record<SyncPhase, string> = {
  idle: 'sync.idle',
  syncing: 'sync.syncing',
  offline: 'sync.offline',
  error: 'sync.error',
  'too-large': 'sync.tooLarge',
};

export const SyncIndicator = () => {
  const { t } = useTranslation('common');
  const { linked, phase } = useSync();

  // Most users never link a device — the common case renders nothing, same contract as
  // OnlineIndicator returning null when presence data is unavailable.
  if (!linked) return null;

  const statusLabel = t(STATUS_KEY[phase]);
  const ariaLabel = t('sync.ariaLabel', { status: statusLabel });

  let icon: JSX.Element;
  if (phase === 'syncing') {
    icon = <RefreshCw size={14} aria-hidden className="animate-spin" />;
  } else if (phase === 'offline') {
    icon = <CloudOff size={14} aria-hidden />;
  } else if (phase === 'error' || phase === 'too-large') {
    icon = <CloudAlert size={14} aria-hidden />;
  } else {
    icon = <Cloud size={14} aria-hidden />;
  }

  return (
    <Link
      to="/settings"
      aria-label={ariaLabel}
      title={ariaLabel}
      className={cx(
        'inline-flex h-9 items-center gap-1 rounded-full border px-1.5 transition-colors sm:gap-1.5 sm:px-2',
        TONE_CLASSES[phase],
      )}
    >
      <span className={cx('size-2 rounded-full', DOT_CLASSES[phase])} aria-hidden />
      {icon}
    </Link>
  );
};

export default SyncIndicator;
