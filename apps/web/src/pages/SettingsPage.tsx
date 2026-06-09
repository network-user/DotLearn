import { useEffect, useState } from 'react';

import {
  providerList,
  type AiProvider,
  type ConnectionStatus,
  type ProviderCredentials,
  type ProviderId,
} from '@dotlearn/ai-providers';
import { toast } from 'sonner';

import { loadCredentials, saveCredentials } from '@/lib/provider-credentials';

interface ProviderRowState {
  loaded: boolean;
  credentials: ProviderCredentials;
  testing: boolean;
  lastStatus: ConnectionStatus | undefined;
}

const emptyState = (): ProviderRowState => ({
  loaded: false,
  credentials: {},
  testing: false,
  lastStatus: undefined,
});

export const SettingsPage = () => {
  const [byProvider, setByProvider] = useState<Map<ProviderId, ProviderRowState>>(() => {
    const initial = new Map<ProviderId, ProviderRowState>();
    for (const provider of providerList) {
      initial.set(provider.id, emptyState());
    }
    return initial;
  });

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      providerList.map(async (provider) => {
        const credentials = await loadCredentials(provider.id);
        return { id: provider.id, credentials };
      }),
    ).then((entries) => {
      if (cancelled) return;
      setByProvider((prev) => {
        const next = new Map(prev);
        for (const entry of entries) {
          next.set(entry.id, {
            loaded: true,
            credentials: entry.credentials,
            testing: false,
            lastStatus: undefined,
          });
        }
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateState = (providerId: ProviderId, mutator: (state: ProviderRowState) => ProviderRowState) => {
    setByProvider((prev) => {
      const next = new Map(prev);
      const current = next.get(providerId) ?? emptyState();
      next.set(providerId, mutator(current));
      return next;
    });
  };

  const handleSave = async (provider: AiProvider) => {
    const state = byProvider.get(provider.id);
    if (!state) return;
    await saveCredentials(provider.id, state.credentials);
    toast.success(`${provider.displayName}: credentials saved`);
  };

  const handleTest = async (provider: AiProvider) => {
    const state = byProvider.get(provider.id);
    if (!state) return;
    updateState(provider.id, (current) => ({ ...current, testing: true }));
    const status = await provider.testConnection(state.credentials);
    updateState(provider.id, (current) => ({ ...current, testing: false, lastStatus: status }));
    if (status.ok) {
      toast.success(`${provider.displayName}: connection ok`);
    } else {
      toast.error(`${provider.displayName}: ${status.message}`);
    }
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-zinc-400">
          API keys live in your browser's IndexedDB only. They are never sent to a DotLearn server.
        </p>
      </header>

      <section className="space-y-6">
        {providerList.map((provider) => {
          const state = byProvider.get(provider.id) ?? emptyState();
          return (
            <ProviderCard
              key={provider.id}
              provider={provider}
              state={state}
              onChange={(credentials) =>
                updateState(provider.id, (current) => ({ ...current, credentials }))
              }
              onSave={() => handleSave(provider)}
              onTest={() => handleTest(provider)}
            />
          );
        })}
      </section>
    </div>
  );
};

interface ProviderCardProps {
  provider: AiProvider;
  state: ProviderRowState;
  onChange: (credentials: ProviderCredentials) => void;
  onSave: () => void;
  onTest: () => void;
}

const ProviderCard = ({ provider, state, onChange, onSave, onTest }: ProviderCardProps) => {
  const requiresKey = provider.id !== 'ollama';
  const update = (patch: Partial<ProviderCredentials>): void => {
    onChange({ ...state.credentials, ...patch });
  };
  return (
    <article className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-100">{provider.displayName}</h2>
        <StatusBadge state={state} />
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {requiresKey && (
          <Field
            label="API key"
            placeholder="sk-…"
            type="password"
            value={state.credentials.apiKey ?? ''}
            onChange={(value) => update({ apiKey: value })}
          />
        )}
        <Field
          label="Base URL"
          placeholder="optional override"
          value={state.credentials.baseUrl ?? ''}
          onChange={(value) => update({ baseUrl: value })}
        />
        <Field
          label="Default model"
          placeholder="optional"
          value={state.credentials.defaultModel ?? ''}
          onChange={(value) => update({ defaultModel: value })}
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          className="rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-400"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onTest}
          disabled={state.testing}
          className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-900 disabled:opacity-50"
        >
          {state.testing ? 'Testing…' : 'Test connection'}
        </button>
      </div>
    </article>
  );
};

interface FieldProps {
  label: string;
  value: string;
  placeholder?: string;
  type?: 'text' | 'password';
  onChange: (value: string) => void;
}

const Field = ({ label, value, placeholder, type = 'text', onChange }: FieldProps) => (
  <label className="block">
    <span className="block text-xs uppercase tracking-wide text-zinc-500 mb-1">{label}</span>
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="w-full rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/60"
    />
  </label>
);

const StatusBadge = ({ state }: { state: ProviderRowState }) => {
  if (state.testing) {
    return <span className="text-xs text-zinc-400">testing…</span>;
  }
  if (!state.lastStatus) {
    return <span className="text-xs text-zinc-500">untested</span>;
  }
  if (state.lastStatus.ok) {
    return (
      <span className="text-xs text-emerald-300 border border-emerald-500/30 bg-emerald-500/10 rounded px-1.5 py-0.5">
        connected
      </span>
    );
  }
  return (
    <span
      className="text-xs text-rose-300 border border-rose-500/30 bg-rose-500/10 rounded px-1.5 py-0.5 truncate max-w-[60%]"
      title={state.lastStatus.message}
    >
      error
    </span>
  );
};
