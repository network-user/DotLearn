import { useEffect, useRef, useState } from 'react';

import { History, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { deleteScroll, recordScroll } from '@/lib/progress-db';
import {
  computeTargetY,
  isSavingSuppressed,
  MEANINGFUL_RATIO,
  computePosition,
  runRestore,
  type CapturedPosition,
} from '@/lib/reading-position';
import { useReadingScroll } from '@/lib/use-learning';

const SAVE_DEBOUNCE = 500;

interface TrackerProps {
  slug: string;
  conceptId: string;
}

export const ReadingPositionTracker = ({ slug, conceptId }: TrackerProps) => {
  const dirtyRef = useRef(false);

  useEffect(() => {
    dirtyRef.current = false;
    let timer: number | undefined;

    const persist = (pos: CapturedPosition): void => {
      if (pos.kind === 'pos') {
        void recordScroll(slug, conceptId, {
          ratio: pos.ratio,
          anchorOffset: pos.anchorOffset,
          ...(pos.anchorId ? { anchorId: pos.anchorId } : {}),
        });
      } else if (pos.kind === 'top') {
        void deleteScroll(slug, conceptId);
      }
    };

    const computeAndPersist = (): void => {
      dirtyRef.current = false;
      const pos = computePosition();
      if (pos.kind === 'none') return;
      persist(pos);
    };

    const onScroll = (): void => {
      if (isSavingSuppressed()) return;
      dirtyRef.current = true;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(computeAndPersist, SAVE_DEBOUNCE);
    };

    const flush = (): void => {
      if (timer) window.clearTimeout(timer);
      if (dirtyRef.current && !isSavingSuppressed()) computeAndPersist();
    };

    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') flush();
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      flush();
    };
  }, [slug, conceptId]);

  return null;
};

interface BannerProps {
  slug: string;
  conceptId: string;
  resume: boolean;
  onResumeHandled: () => void;
}

export const ResumeBanner = ({ slug, conceptId, resume, onResumeHandled }: BannerProps) => {
  const { t } = useTranslation('topic');
  const record = useReadingScroll(slug, conceptId);
  const [hidden, setHidden] = useState(false);
  const entryHandledRef = useRef(false);
  const restoreRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setHidden(false);
  }, [conceptId]);

  useEffect(() => () => restoreRef.current?.(), []);

  useEffect(() => {
    if (entryHandledRef.current || record === undefined) return;
    entryHandledRef.current = true;
    if (record && record.ratio > MEANINGFUL_RATIO) {
      restoreRef.current?.();
      restoreRef.current = runRestore(record);
      setHidden(true);
    }
    if (resume) onResumeHandled();
  }, [resume, record, onResumeHandled]);

  useEffect(() => {
    if (resume || hidden || !record || record.ratio <= MEANINGFUL_RATIO) return undefined;
    const onScroll = (): void => {
      if (window.scrollY > computeTargetY(record) * 0.6) setHidden(true);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [resume, hidden, record]);

  if (resume || hidden || !record || record.ratio <= MEANINGFUL_RATIO) return null;

  const handleResume = (): void => {
    restoreRef.current?.();
    restoreRef.current = runRestore(record);
    setHidden(true);
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--mobile-tabbar-h)+var(--safe-bottom)+12px)] z-[var(--z-sheet)] flex justify-center px-4 md:bottom-6">
      <div className="glass-chrome pointer-events-auto flex items-center gap-1 rounded-pill border border-border-base p-1 shadow-float data-[state=open]:animate-rise">
        <button
          type="button"
          onClick={handleResume}
          className="flex min-h-[var(--tap)] items-center gap-2 rounded-pill px-4 text-sm font-medium text-fg transition-colors duration-fast hover:bg-surface-2/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          <History size={16} className="text-accent" />
          {t('resume.banner', { defaultValue: 'Вернуться к месту чтения' })}
        </button>
        <button
          type="button"
          onClick={() => setHidden(true)}
          aria-label={t('resume.dismiss', { defaultValue: 'Скрыть' })}
          className="grid min-h-[var(--tap)] min-w-[var(--tap)] place-items-center rounded-full text-fg-muted transition-colors duration-fast hover:bg-surface-2/70 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
