import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDownToLine, X } from 'lucide-react';

import { Button } from '@/components/ui/Button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'dotlearn:pwa-dismissed';

const markDismissed = () => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(DISMISSED_KEY, '1');
  } catch {
    /* ignore */
  }
};

const wasDismissed = (): boolean => {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
};

const isStandalone = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(display-mode: standalone)').matches;
  } catch {
    return false;
  }
};

export const InstallPrompt = () => {
  const { t } = useTranslation('common');
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStandalone()) return;
    if (wasDismissed()) return;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
      markDismissed();
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      await deferred.userChoice;
    } catch {
      /* ignore */
    } finally {
      setVisible(false);
      setDeferred(null);
      markDismissed();
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    setDeferred(null);
    markDismissed();
  };

  if (!visible || !deferred) return null;

  return (
    <div
      role="dialog"
      aria-label={t('pwa.title')}
      className="animate-rise fixed z-[var(--z-toast)] left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-sm bottom-[calc(var(--mobile-tabbar-h)+var(--safe-bottom)+12px)] md:left-auto md:right-4 md:translate-x-0 md:bottom-4"
    >
      <div className="glass-strong border border-border-base rounded-xl shadow-float p-3.5 flex items-center gap-3">
        <span
          aria-hidden
          className="size-10 shrink-0 rounded-lg bg-accent/10 text-accent grid place-items-center"
        >
          <ArrowDownToLine className="size-5" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-fg truncate">{t('pwa.title')}</p>
          <p className="text-[12px] text-fg-muted truncate">{t('pwa.body')}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            size="sm"
            variant="primary"
            onClick={handleInstall}
            className="min-h-[var(--tap)] sm:min-h-0"
          >
            {t('pwa.install')}
          </Button>
          <button
            type="button"
            aria-label={t('pwa.dismiss')}
            onClick={handleDismiss}
            className="size-8 grid place-items-center rounded-md text-fg-muted hover:text-fg hover:bg-surface-2/60 transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
