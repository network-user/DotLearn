import { useState } from 'react';

import { useNavigate } from '@tanstack/react-router';

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
        setErrors([`Submission failed: ${error.message}`]);
      } else {
        setErrors(['Submission failed: network error']);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/30 p-8 text-center">
        <h2 className="font-semibold text-emerald-200">Thanks — your proposal is in the queue</h2>
        <p className="mt-2 text-sm text-emerald-300/80">
          The maintainer reviews submissions in the /admin queue. If approved, the topic is
          materialized via the lesson-forge skill and merged.
        </p>
        <button
          type="button"
          onClick={() => navigate({ to: '/' })}
          className="mt-5 px-4 py-2 rounded-md bg-emerald-500 text-emerald-950 font-medium hover:bg-emerald-400"
        >
          Back to topics
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Suggest a topic</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Sketch out what you want to learn. The maintainer will review and, if approved, the
        lesson-forge skill will materialize the topic.
      </p>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <Field label="Title">
          <input
            type="text"
            required
            minLength={5}
            value={form.title}
            onChange={handleChange('title')}
            className="form-input"
            placeholder="SQL window functions"
          />
        </Field>

        <Field label="Outline">
          <textarea
            required
            minLength={20}
            value={form.outline}
            onChange={handleChange('outline')}
            rows={6}
            className="form-input"
            placeholder="What should the topic cover? Which concepts, in what order, with what depth?"
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Runtime">
            <select
              value={form.suggestedRuntime}
              onChange={handleChange('suggestedRuntime')}
              className="form-input"
            >
              <option value="none">none (theory)</option>
              <option value="sql.js">sql.js (SQL)</option>
              <option value="pyodide">pyodide (Python)</option>
              <option value="javascript">javascript</option>
            </select>
          </Field>
          <Field label="Difficulty">
            <select
              value={form.suggestedDifficulty}
              onChange={handleChange('suggestedDifficulty')}
              className="form-input"
            >
              <option value="beginner">beginner</option>
              <option value="intermediate">intermediate</option>
              <option value="advanced">advanced</option>
            </select>
          </Field>
          <Field label="Language">
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
          <Field label="Estimated hours">
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
          <Field label="Tags (comma-separated)">
            <input
              type="text"
              value={form.tags}
              onChange={handleChange('tags')}
              className="form-input"
              placeholder="sql, databases"
            />
          </Field>
        </div>

        <Field label="Sources (one URL per line)">
          <textarea
            value={form.sources}
            onChange={handleChange('sources')}
            rows={3}
            className="form-input"
            placeholder="https://..."
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Contact email (optional)">
            <input
              type="email"
              value={form.contactEmail}
              onChange={handleChange('contactEmail')}
              className="form-input"
            />
          </Field>
          <Field label="Notes (optional)">
            <input
              type="text"
              value={form.notes}
              onChange={handleChange('notes')}
              className="form-input"
              placeholder="Anything else"
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
          {submitting ? 'Submitting...' : 'Submit proposal'}
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
    <span className="block text-xs uppercase tracking-wide text-zinc-400 mb-1">{label}</span>
    {children}
  </label>
);
