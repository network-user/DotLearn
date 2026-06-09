import { useState } from 'react';

import { useTranslation } from 'react-i18next';

import { AuthApiError } from '@/lib/auth/auth-api';
import { useAuth } from '@/lib/auth/AuthContext';

interface FormState {
  login: string;
  password: string;
  totp: string;
}

const initialForm: FormState = { login: '', password: '', totp: '' };

interface AdminLoginPageProps {
  onSuccess?: () => void;
}

export const AdminLoginPage = ({ onSuccess }: AdminLoginPageProps) => {
  const { t } = useTranslation('admin');
  const { login } = useAuth();
  const [form, setForm] = useState<FormState>(initialForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(form);
      onSuccess?.();
    } catch (err) {
      if (err instanceof AuthApiError) {
        setError(err.message);
      } else {
        setError(t('networkError'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-semibold tracking-tight">{t('login.title')}</h1>
      <p className="mt-2 text-sm text-fg-muted">{t('login.subtitle')}</p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <Field label={t('login.fields.login')}>
          <input
            type="text"
            autoComplete="username"
            required
            value={form.login}
            onChange={(event) => setForm((prev) => ({ ...prev, login: event.target.value }))}
            className="form-input"
          />
        </Field>
        <Field label={t('login.fields.password')}>
          <input
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            value={form.password}
            onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
            className="form-input"
          />
        </Field>
        <Field label={t('login.fields.totp')}>
          <input
            type="text"
            autoComplete="one-time-code"
            required
            inputMode="text"
            pattern="[0-9A-Za-z-]+"
            value={form.totp}
            onChange={(event) => setForm((prev) => ({ ...prev, totp: event.target.value }))}
            className="form-input"
            placeholder={t('login.fields.totpPlaceholder')}
          />
          <span className="mt-1 block text-[11px] text-fg-subtle">
            {t('login.fields.totpHint')}
          </span>
        </Field>

        {error && (
          <div className="rounded-md border border-rose-900/40 bg-rose-950/30 p-3 text-sm text-rose-300">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full px-4 py-2 rounded-md bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-medium"
        >
          {submitting ? t('login.submitting') : t('login.submit')}
        </button>
      </form>

      <style>{`
        .form-input {
          width: 100%;
          background-color: rgb(24 24 27 / 0.6);
          border: 1px solid rgb(39 39 42);
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          color: rgb(244 244 245);
          font-size: 0.875rem;
        }
        .form-input:focus {
          outline: none;
          border-color: rgb(99 102 241);
        }
      `}</style>
    </div>
  );
};

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

const Field = ({ label, children }: FieldProps) => (
  <label className="block">
    <span className="block text-xs uppercase tracking-wide text-fg-muted mb-1">{label}</span>
    {children}
  </label>
);
