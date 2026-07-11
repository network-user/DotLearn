import { useState } from 'react';

import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { CreateSubmissionInput } from '@dotlearn/contracts';

import { ApiError, submitTopicProposal } from '@/lib/api-client';
import { Seo } from '@/lib/seo';

type SubmissionLanguage = 'en' | 'ru';

type FormState = {
  title: string;
  outline: string;
  suggestedRuntime: 'sql.js' | 'pyodide' | 'javascript' | 'none';
  suggestedDifficulty: 'beginner' | 'intermediate' | 'advanced';
  suggestedLanguages: SubmissionLanguage[];
  suggestedPrimaryLanguage: SubmissionLanguage;
  estimatedHours: number;
  tags: string;
  sources: string;
  contactEmail: string;
  notes: string;
};

const withHttpsScheme = (value: string): string =>
  /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;

const initialState: FormState = {
  title: '',
  outline: '',
  suggestedRuntime: 'none',
  suggestedDifficulty: 'beginner',
  suggestedLanguages: ['ru'],
  suggestedPrimaryLanguage: 'ru',
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
      suggestedLanguages: form.suggestedLanguages,
      suggestedPrimaryLanguage: form.suggestedPrimaryLanguage,
      estimatedHours: form.estimatedHours,
      tags: form.tags
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
      sources: form.sources
        .split('\n')
        .map((value) => value.trim())
        .filter(Boolean)
        .map(withHttpsScheme),
      ...(form.contactEmail ? { contactEmail: form.contactEmail } : {}),
      ...(form.notes ? { notes: form.notes } : {}),
    };

    const parsed = CreateSubmissionInput.safeParse(candidate);
    if (!parsed.success) {
      setErrors(
        parsed.error.issues.map((issue) => `${issue.path.join('.') || 'form'}: ${issue.message}`),
      );
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
      <div className="rounded-lg border border-ok/30 bg-ok/10 p-8 text-center">
        <h2 className="font-semibold text-ok">{t('successTitle')}</h2>
        <p className="mt-2 text-sm text-fg-muted">{t('successMessage')}</p>
        <button
          type="button"
          onClick={() => navigate({ to: '/' })}
          className="mt-5 px-4 py-2 rounded-md bg-ok text-surface dark:text-canvas font-medium hover:bg-ok/90"
        >
          {tCommon('backToTopics')}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <Seo robots="noindex,nofollow" title={t('title')} />
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
          <Field label={t('fields.languages')}>
            <LanguagesPicker
              languages={form.suggestedLanguages}
              primary={form.suggestedPrimaryLanguage}
              onChange={(next, primary) =>
                setForm((prev) => ({
                  ...prev,
                  suggestedLanguages: next,
                  suggestedPrimaryLanguage: primary,
                }))
              }
              primaryLabel={t('fields.primaryLanguage')}
            />
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
          <ul className="rounded-md border border-err/30 bg-err/10 p-3 text-sm text-err space-y-1">
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 rounded-md bg-accent hover:bg-accent/90 disabled:opacity-50 text-surface dark:text-canvas font-medium"
        >
          {submitting ? t('submitting') : t('submit')}
        </button>
      </form>
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

interface LanguagesPickerProps {
  languages: SubmissionLanguage[];
  primary: SubmissionLanguage;
  primaryLabel: string;
  onChange: (languages: SubmissionLanguage[], primary: SubmissionLanguage) => void;
}

const ALL_LANGUAGES: readonly SubmissionLanguage[] = ['ru', 'en'];

const LanguagesPicker = ({ languages, primary, primaryLabel, onChange }: LanguagesPickerProps) => {
  const toggle = (lang: SubmissionLanguage): void => {
    const has = languages.includes(lang);
    if (has) {
      if (languages.length === 1) return;
      const next = languages.filter((entry) => entry !== lang);
      const nextPrimary = primary === lang ? (next[0] as SubmissionLanguage) : primary;
      onChange(next, nextPrimary);
    } else {
      const next = [...languages, lang].sort(
        (a, b) => ALL_LANGUAGES.indexOf(a) - ALL_LANGUAGES.indexOf(b),
      );
      onChange(next, primary);
    }
  };
  const setPrimary = (lang: SubmissionLanguage): void => {
    if (!languages.includes(lang)) return;
    onChange(languages, lang);
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {ALL_LANGUAGES.map((lang) => {
          const active = languages.includes(lang);
          return (
            <label
              key={lang}
              className={
                'flex items-center gap-2 rounded-md border px-3 py-1.5 cursor-pointer text-sm ' +
                (active
                  ? 'border-accent/60 bg-accent/10 text-fg'
                  : 'border-border-base bg-surface text-fg-muted hover:border-border-strong')
              }
            >
              <input
                type="checkbox"
                checked={active}
                onChange={() => toggle(lang)}
                className="accent-[rgb(var(--accent-1))]"
              />
              <span className="uppercase tracking-wide">{lang}</span>
            </label>
          );
        })}
      </div>
      {languages.length > 1 && (
        <div className="flex items-center gap-2 text-xs text-fg-muted">
          <span>{primaryLabel}:</span>
          {languages.map((lang) => (
            <label key={lang} className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="primary-language"
                checked={primary === lang}
                onChange={() => setPrimary(lang)}
                className="accent-[rgb(var(--accent-1))]"
              />
              <span className="uppercase tracking-wide text-fg">{lang}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
};
