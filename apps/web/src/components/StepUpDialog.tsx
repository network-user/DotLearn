import { useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';

import { useAuth } from '@/lib/auth/AuthContext';

interface StepUpDialogProps {
  action: string | null;
  onCancel: () => void;
  onVerified: () => void;
}

export const StepUpDialog = ({ action, onCancel, onVerified }: StepUpDialogProps) => {
  const { t } = useTranslation('admin');
  const { stepUp } = useAuth();
  const [totp, setTotp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (action) {
      setTotp('');
      setError(null);
    }
  }, [action]);

  if (!action) return null;

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await stepUp(action, totp.trim());
      onVerified();
    } catch (err) {
      const message = err instanceof Error ? err.message : t('networkError');
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-canvas/60"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-border-base bg-surface p-5 shadow-card"
      >
        <h2 className="text-lg font-semibold">{t('stepUp.title')}</h2>
        <p className="mt-1 text-sm text-fg-muted">{t('stepUp.subtitle', { action })}</p>
        <label className="mt-4 block">
          <span className="block text-xs uppercase tracking-wide text-fg-muted mb-1">
            {t('stepUp.totp')}
          </span>
          <input
            type="text"
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            value={totp}
            onChange={(event) => setTotp(event.target.value)}
            className="form-input"
          />
        </label>
        {error && (
          <div className="mt-3 rounded-md border border-err/30 bg-err/10 p-2 text-xs text-err">
            {error}
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-md text-sm border border-border-strong hover:bg-surface-2"
          >
            {t('stepUp.cancel')}
          </button>
          <button
            type="submit"
            disabled={submitting || totp.trim().length < 6}
            className="px-3 py-1.5 rounded-md text-sm bg-accent text-surface dark:text-canvas hover:bg-accent/90 disabled:opacity-50"
          >
            {submitting ? t('stepUp.verifying') : t('stepUp.confirm')}
          </button>
        </div>
      </form>
    </div>
  );
};
