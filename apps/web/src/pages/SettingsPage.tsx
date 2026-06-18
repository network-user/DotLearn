import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';

import { Check, Download, Minus, Plus, RotateCcw, Trash2, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { Dialog } from '@/components/ui/Dialog';
import {
  ProgressImportError,
  clearAllProgress,
  downloadProgressExport,
  exportProgress,
  importProgress,
} from '@/lib/progress-io';
import {
  ACCENT_IDS,
  DAILY_GOAL_MAX,
  DAILY_GOAL_MIN,
  READING_SIZES,
  setSettings,
  useSettings,
  type AccentId,
  type ReadingSize,
} from '@/lib/settings';
import { applyTheme, persistTheme, readStoredTheme, type Theme } from '@/lib/theme';
import { useStorageHealth } from '@/lib/storage-health';

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
};

const ACCENT_SWATCH: Record<AccentId, string> = {
  blue: 'rgb(0 113 227)',
  violet: 'rgb(124 58 237)',
  teal: 'rgb(13 148 136)',
  rose: 'rgb(225 29 102)',
  amber: 'rgb(217 119 6)',
  graphite: 'rgb(82 82 91)',
};

interface SectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

const Section = ({ title, description, children }: SectionProps) => (
  <section className="space-y-4">
    <div>
      <h2 className="font-display text-xl tracking-tightish text-fg">{title}</h2>
      {description && <p className="mt-1 text-sm text-fg-muted max-w-prose">{description}</p>}
    </div>
    <div className="rounded-xl border border-border-base bg-surface p-5 space-y-6">{children}</div>
  </section>
);

interface RowProps {
  label: string;
  hint?: string;
  control: ReactNode;
}

const Row = ({ label, hint, control }: RowProps) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div className="min-w-0">
      <div className="text-sm font-medium text-fg">{label}</div>
      {hint && <div className="mt-0.5 text-[13px] text-fg-subtle">{hint}</div>}
    </div>
    <div className="shrink-0">{control}</div>
  </div>
);

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
}

function Segmented<T extends string>({ value, options, onChange, ariaLabel }: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex flex-wrap gap-1 rounded-lg border border-border-base bg-surface-2/50 p-1"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cx(
              'min-h-[var(--tap)] sm:min-h-0 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors',
              active
                ? 'bg-accent text-surface dark:text-canvas'
                : 'text-fg-muted hover:text-fg hover:bg-surface-2',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export const SettingsPage = () => {
  const { t } = useTranslation('settings');
  const storage = useStorageHealth();
  const settings = useSettings();
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme());
  const [confirmReset, setConfirmReset] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const changeTheme = (next: Theme): void => {
    setTheme(next);
    applyTheme(next);
    persistTheme(next);
  };

  const changeGoal = (delta: number): void => {
    setSettings({ dailyGoal: settings.dailyGoal + delta });
  };

  const handleExport = async (): Promise<void> => {
    try {
      downloadProgressExport(await exportProgress());
      toast.success(t('toast.exported'));
    } catch {
      toast.error(t('toast.exportError'));
    }
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const { imported } = await importProgress(parsed);
      toast.success(t('toast.imported', { count: imported }));
    } catch (error) {
      if (error instanceof ProgressImportError || error instanceof SyntaxError) {
        toast.error(t('toast.importInvalid'));
      } else {
        toast.error(t('toast.importError'));
      }
    }
  };

  const handleReset = async (): Promise<void> => {
    setConfirmReset(false);
    try {
      await clearAllProgress();
      toast.success(t('toast.cleared'));
    } catch {
      toast.error(t('toast.exportError'));
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-2 text-sm text-fg-muted max-w-prose">{t('intro')}</p>
      </header>

      <Section title={t('appearance')} description={t('appearanceDesc')}>
        <Row
          label={t('themeLabel')}
          control={
            <Segmented
              ariaLabel={t('themeLabel')}
              value={theme}
              onChange={changeTheme}
              options={[
                { value: 'light', label: t('themeLight') },
                { value: 'dark', label: t('themeDark') },
              ]}
            />
          }
        />
        <Row
          label={t('accentLabel')}
          hint={t('accentDesc')}
          control={
            <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label={t('accentLabel')}>
              {ACCENT_IDS.map((accent) => {
                const active = settings.accent === accent;
                return (
                  <button
                    key={accent}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={t(`accentNames.${accent}`)}
                    title={t(`accentNames.${accent}`)}
                    onClick={() => setSettings({ accent })}
                    className={cx(
                      'relative grid place-items-center size-9 rounded-full transition-transform',
                      active
                        ? 'ring-2 ring-offset-2 ring-offset-surface ring-fg/70 scale-105'
                        : 'hover:scale-110',
                    )}
                  >
                    <span
                      aria-hidden
                      className="size-6 rounded-full border border-black/10 dark:border-white/15"
                      style={{ backgroundColor: ACCENT_SWATCH[accent] }}
                    />
                    {active && (
                      <span className="absolute inset-0 grid place-items-center">
                        <Check size={13} className="text-white drop-shadow" />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          }
        />
        <Row
          label={t('readingLabel')}
          hint={t('readingDesc')}
          control={
            <Segmented
              ariaLabel={t('readingLabel')}
              value={settings.reading}
              onChange={(reading: ReadingSize) => setSettings({ reading })}
              options={READING_SIZES.map((size) => ({ value: size, label: t(`readingNames.${size}`) }))}
            />
          }
        />
        <Row
          label={t('motionLabel')}
          hint={t('motionDesc')}
          control={
            <Segmented
              ariaLabel={t('motionLabel')}
              value={settings.motion}
              onChange={(motion: 'system' | 'reduced') => setSettings({ motion })}
              options={[
                { value: 'system', label: t('motionSystem') },
                { value: 'reduced', label: t('motionReduced') },
              ]}
            />
          }
        />
      </Section>

      <Section title={t('language.title')} description={t('language.description')}>
        <LanguageSwitcher variant="full" />
      </Section>

      <Section title={t('learning')} description={t('learningDesc')}>
        <Row
          label={t('dailyGoalLabel')}
          hint={t('dailyGoalDesc')}
          control={
            <div className="inline-flex items-center gap-2">
              <button
                type="button"
                onClick={() => changeGoal(-1)}
                disabled={settings.dailyGoal <= DAILY_GOAL_MIN}
                aria-label={t('dailyGoalDecrease')}
                className="grid place-items-center size-10 rounded-lg border border-border-base text-fg-muted hover:text-fg hover:bg-surface-2/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Minus size={16} />
              </button>
              <span className="w-14 text-center text-lg font-semibold text-fg tabular-nums">
                {settings.dailyGoal}
              </span>
              <button
                type="button"
                onClick={() => changeGoal(1)}
                disabled={settings.dailyGoal >= DAILY_GOAL_MAX}
                aria-label={t('dailyGoalIncrease')}
                className="grid place-items-center size-10 rounded-lg border border-border-base text-fg-muted hover:text-fg hover:bg-surface-2/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus size={16} />
              </button>
            </div>
          }
        />
      </Section>

      <Section title={t('dataLabel')} description={t('dataDesc')}>
        {storage.supported ? (
          <div
            className={cx(
              'mb-3 rounded-xl border p-3 text-sm',
              storage.persisted === false || (storage.percent ?? 0) >= 80
                ? 'border-warn/40 bg-warn/5 text-fg'
                : 'border-border-base bg-surface-2/40 text-fg-muted',
            )}
          >
            <p className="text-fg">
              {t('storageLocalNote', {
                defaultValue:
                  'Данные хранятся локально в этом браузере (IndexedDB «dotlearn-progress») и никуда не отправляются.',
              })}
            </p>
            <p className="mt-1.5">
              {storage.persisted === true
                ? t('storagePersistent', {
                    defaultValue: 'Хранилище постоянное — браузер не вытеснит ваш прогресс.',
                  })
                : t('storageAtRisk', {
                    defaultValue:
                      'Хранилище не закреплено — при нехватке места браузер может удалить прогресс. Сделайте экспорт на всякий случай.',
                  })}
            </p>
            {storage.usageBytes !== null && storage.quotaBytes !== null ? (
              <p className="mt-1.5 tabular-nums text-fg-subtle">
                {t('storageUsage', {
                  defaultValue: 'Занято {{used}} из ~{{quota}} ({{percent}}%)',
                  used: formatBytes(storage.usageBytes),
                  quota: formatBytes(storage.quotaBytes),
                  percent: Math.round(storage.percent ?? 0),
                })}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button
            variant="outline"
            leadingIcon={<Download size={15} />}
            className="w-full sm:w-auto"
            onClick={() => void handleExport()}
          >
            {t('export')}
          </Button>
          <Button
            variant="outline"
            leadingIcon={<Upload size={15} />}
            className="w-full sm:w-auto"
            onClick={() => fileInputRef.current?.click()}
          >
            {t('import')}
          </Button>
          <Button
            variant="ghost"
            leadingIcon={<Trash2 size={15} />}
            className="w-full sm:w-auto text-err hover:text-err hover:bg-err/10"
            onClick={() => setConfirmReset(true)}
          >
            {t('reset')}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => void handleImportFile(event)}
          />
        </div>
      </Section>

      <Dialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title={t('resetConfirmTitle')}
        description={t('resetConfirmBody')}
        placement="center"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              {t('resetCancel')}
            </Button>
            <Button
              variant="danger"
              leadingIcon={<RotateCcw size={15} />}
              onClick={() => void handleReset()}
            >
              {t('resetConfirm')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-fg-muted">{t('resetConfirmHint')}</p>
      </Dialog>
    </div>
  );
};
