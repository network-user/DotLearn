import { useState } from 'react';

import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { CreateSubmissionInput } from '@dotlearn/contracts';

import { ApiError, submitTopicProposal } from '@/lib/api-client';

type FormState = {
  title: string;
  outline: string;
  suggestedRuntime: 'sql.js' | 'pyodide' | 'javascript' | 'none';
  suggestedDifficulty: 'beginner' | 'intermediate' | 'advanced';
  suggestedLanguage: 'en' | 'ru';
  estimatedHours: number;
  tags: string;
  sources: string;
  contactEmail: string;
  notes: string;
};

const initialState: FormState = {
  title: '',
  outline: '',
  suggestedRuntime: 'none',
  suggestedDifficulty: 'beginner',
  suggestedLanguage: 'en',
  estimatedHours: 3,
  tags: '',
  sources: '',
  contactEmail: '',
  notes: '',
};

export const SubmitTopicPage = () => {
  const { t } = useTranslation('submit');
  const { t: tCommon } = useTranslation('common');
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleChange =
    <K extends keyof FormState>(key: K) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const raw = event.target.value;
      setForm((prev) => ({
        ...prev,
        [key]: key === 'estimatedHours' ? Number(raw) : (raw as FormState[K]),
      }));
    };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrors([]);

    const candidate = {
      title: form.title.trim(),
      outline: form.outline.trim(),
      suggestedRuntime: form.suggestedRuntime,
      suggestedDifficulty: form.suggestedDifficulty,
      suggestedLanguage: form.suggestedLanguage,
      estimatedHours: form.estimatedHours,
      tags: form.tags
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
      sources: form.sources
        .split('\n')
        .map((value) => value.trim())
        .filter(Boolean),
      ...(form.contactEmail ? { contactEmail: form.contactEmail } : {}),
      ...(form.notes ? { notes: form.notes } : {}),
    };

    const parsed = CreateSubmissionInput.safeParse(candidate);
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((issue) => `${issue.path.join('.') || 'form'}: ${issue.message}`));
      return;
    }

    setSubmitting(true);
    try {
      await submitTopicProposal(parsed.data);
      setSubmitted(true);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrors([t('errorPrefix', { message: error.message })]);
      } else {
        setErrors([t('networkError')]);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/30 p-8 text-center">
        <h2 className="font-semibold text-emerald-200">{t('successTitle')}</h2>
        <p className="mt-2 text-sm text-emerald-300/80">{t('successMessage')}</p>
        <button
          type="button"
          onClick={() => navigate({ to: '/' })}
          className="mt-5 px-4 py-2 rounded-md bg-emerald-500 text-emerald-950 font-medium hover:bg-emerald-400"
        >
          {tCommon('backToTopics')}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
      <p className="mt-2 text-sm text-fg-muted">{t('subtitle')}</p>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <Field label={t('fields.titleLabel')}>
          <input
            type="text"
            required
            minLength={5}
            value={form.title}
            onChange={handleChange('title')}
            className="form-input"
            placeholder={t('fields.titlePlaceholder')}
          />
        </Field>

        <Field label={t('fields.outline')}>
          <textarea
            required
            minLength={20}
            value={form.outline}
            onChange={handleChange('outline')}
            rows={6}
            className="form-input"
            placeholder={t('fields.outlinePlaceholder')}
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label={t('fields.runtime')}>
            <select
              value={form.suggestedRuntime}
              onChange={handleChange('suggestedRuntime')}
              className="form-input"
            >
              <option value="none">{t('runtimeOptions.none')}</option>
              <option value="sql.js">{t('runtimeOptions.sqljs')}</option>
              <option value="pyodide">{t('runtimeOptions.pyodide')}</option>
              <option value="javascript">{t('runtimeOptions.javascript')}</option>
            </select>
          </Field>
          <Field label={t('fields.difficulty')}>
            <select
              value={form.suggestedDifficulty}
              onChange={handleChange('suggestedDifficulty')}
              className="form-input"
            >
              <option value="beginner">{t('difficultyOptions.beginner')}</option>
              <option value="intermediate">{t('difficultyOptions.intermediate')}</option>
              <option value="advanced">{t('difficultyOptions.advanced')}</option>
            </select>
          </Field>
          <Field label={t('fields.language')}>
            <select
              value={form.suggestedLanguage}
              onChange={handleChange('suggestedLanguage')}
              className="form-input"
            >
              <option value="en">en</option>
              <option value="ru">ru</option>
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={t('fields.estimatedHours')}>
            <input
              type="number"
              min={0.25}
              max={200}
              step={0.25}
              value={form.estimatedHours}
              onChange={handleChange('estimatedHours')}
              className="form-input"
            />
          </Field>
          <Field label={t('fields.tags')}>
            <input
              type="text"
              value={form.tags}
              onChange={handleChange('tags')}
              className="form-input"
              placeholder={t('fields.tagsPlaceholder')}
            />
          </Field>
        </div>

        <Field label={t('fields.sources')}>
          <textarea
            value={form.sources}
            onChange={handleChange('sources')}
            rows={3}
            className="form-input"
            placeholder={t('fields.sourcesPlaceholder')}
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label={t('fields.contactEmail')}>
            <input
              type="email"
              value={form.contactEmail}
              onChange={handleChange('contactEmail')}
              className="form-input"
            />
          </Field>
          <Field label={t('fields.notes')}>
            <input
              type="text"
              value={form.notes}
              onChange={handleChange('notes')}
              className="form-input"
              placeholder={t('fields.notesPlaceholder')}
            />
          </Field>
        </div>

        {errors.length > 0 ? (
          <ul className="rounded-md border border-rose-900/40 bg-rose-950/30 p-3 text-sm text-rose-300 space-y-1">
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 rounded-md bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white font-medium"
        >
          {submitting ? t('submitting') : t('submit')}
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

type FieldProps = { label: string; children: React.ReactNode };

const Field = ({ label, children }: FieldProps) => (
  <label className="block">
    <span className="block text-xs uppercase tracking-wide text-fg-muted mb-1">{label}</span>
    {children}
  </label>
);
