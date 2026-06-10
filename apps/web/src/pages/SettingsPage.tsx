import { useEffect, useState } from 'react';

import {
  providerList,
  type AiProvider,
  type ConnectionStatus,
  type ProviderCredentials,
  type ProviderId,
} from '@dotlearn/ai-providers';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { LanguageSwitcher } from '@/components/LanguageSwitcher';
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
  const { t } = useTranslation('settings');
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
    toast.success(t('providers.savedToast', { provider: provider.displayName }));
  };

  const handleTest = async (provider: AiProvider) => {
    const state = byProvider.get(provider.id);
    if (!state) return;
    updateState(provider.id, (current) => ({ ...current, testing: true }));
    const status = await provider.testConnection(state.credentials);
    updateState(provider.id, (current) => ({ ...current, testing: false, lastStatus: status }));
    if (status.ok) {
      toast.success(t('providers.okToast', { provider: provider.displayName }));
    } else {
      toast.error(
        t('providers.errorToast', { provider: provider.displayName, message: status.message }),
      );
    }
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-2 text-sm text-fg-muted">{t('subtitle')}</p>
      </header>

      <section className="space-y-3">
        <h2 className="eyebrow border-b border-border-base pb-2">{t('language.title')}</h2>
        <p className="text-sm text-fg-muted">{t('language.description')}</p>
        <LanguageSwitcher variant="full" />
      </section>

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
  const { t } = useTranslation('settings');
  const requiresKey = provider.id !== 'ollama';
  const update = (patch: Partial<ProviderCredentials>): void => {
    onChange({ ...state.credentials, ...patch });
  };
  return (
    <article className="rounded-lg border border-border-base bg-surface p-5 space-y-4">
      <header className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-fg">{provider.displayName}</h2>
        <StatusBadge state={state} />
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {requiresKey && (
          <Field
            label={t('providers.apiKey')}
            placeholder={t('providers.apiKeyPlaceholder')}
            type="password"
            value={state.credentials.apiKey ?? ''}
            onChange={(value) => update({ apiKey: value })}
          />
        )}
        <Field
          label={t('providers.baseUrl')}
          placeholder={t('providers.baseUrlPlaceholder')}
          value={state.credentials.baseUrl ?? ''}
          onChange={(value) => update({ baseUrl: value })}
        />
        <Field
          label={t('providers.defaultModel')}
          placeholder={t('providers.defaultModelPlaceholder')}
          value={state.credentials.defaultModel ?? ''}
          onChange={(value) => update({ defaultModel: value })}
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-surface dark:text-canvas hover:bg-accent/90"
        >
          {t('providers.save')}
        </button>
        <button
          type="button"
          onClick={onTest}
          disabled={state.testing}
          className="rounded-md border border-border-strong px-3 py-1.5 text-sm text-fg hover:bg-surface-2 disabled:opacity-50"
        >
          {state.testing ? t('providers.testing') : t('providers.test')}
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
    <span className="block text-xs uppercase tracking-wide text-fg-subtle mb-1">{label}</span>
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="form-input placeholder:text-fg-subtle"
    />
  </label>
);

const StatusBadge = ({ state }: { state: ProviderRowState }) => {
  const { t } = useTranslation('common');
  if (state.testing) {
    return <span className="text-xs text-fg-muted">{t('testing')}</span>;
  }
  if (!state.lastStatus) {
    return <span className="text-xs text-fg-subtle">{t('untested')}</span>;
  }
  if (state.lastStatus.ok) {
    return (
      <span className="text-xs text-ok border border-ok/30 bg-ok/10 rounded px-1.5 py-0.5">
        {t('connected')}
      </span>
    );
  }
  return (
    <span
      className="text-xs text-err border border-err/30 bg-err/10 rounded px-1.5 py-0.5 truncate max-w-[60%]"
      title={state.lastStatus.message}
    >
      {t('error')}
    </span>
  );
};
