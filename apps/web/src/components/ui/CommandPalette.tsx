import { useEffect, useMemo, useState } from 'react';

import type { TopicManifest } from '@dotlearn/contracts';
import { useRouter } from '@tanstack/react-router';
import { Command } from 'cmdk';
import {
  ArrowRight,
  Code2,
  Database,
  FileText,
  FlaskConical,
  Hash,
  Inbox,
  Languages,
  ListChecks,
  MonitorCog,
  Moon,
  PencilLine,
  ShieldCheck,
  Sparkles,
  Sun,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { listManifests } from '@/lib/topics';

import { applyTheme, persistTheme, readStoredTheme } from '../../lib/theme';
import { cx } from './cx';
import { Kbd } from './Kbd';

const runtimeIcon = (runtime: string) => {
  if (runtime === 'sql.js') return <Database size={14} />;
  if (runtime === 'pyodide') return <FlaskConical size={14} />;
  if (runtime === 'javascript') return <Code2 size={14} />;
  return <FileText size={14} />;
};

const navIcon: Record<string, React.ReactNode> = {
  '/': <Hash size={14} />,
  '/progress': <ListChecks size={14} />,
  '/admin': <ShieldCheck size={14} />,
  '/settings': <MonitorCog size={14} />,
  '/submit': <PencilLine size={14} />,
  '/proposals': <Inbox size={14} />,
};

export const CommandPalette = () => {
  const { t, i18n } = useTranslation('nav');
  const { t: tCommon } = useTranslation('common');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [manifests, setManifests] = useState<TopicManifest[]>([]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const isMod = event.metaKey || event.ctrlKey;
      if (isMod && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((v) => !v);
      } else if (event.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    void listManifests().then((list) => {
      if (!cancelled) setManifests(list);
    });
    return () => {
      cancelled = true;
    };
  }, [i18n.resolvedLanguage]);

  const go = (path: string): void => {
    setOpen(false);
    void router.navigate({ to: path });
  };

  const goTopic = (slug: string): void => {
    setOpen(false);
    void router.navigate({ to: '/topics/$slug', params: { slug } });
  };

  const toggleTheme = (): void => {
    const current = readStoredTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    persistTheme(next);
    setOpen(false);
  };

  const switchLanguage = (lang: 'ru' | 'en'): void => {
    void i18n.changeLanguage(lang);
    setOpen(false);
  };

  const navItems = useMemo(
    () => [
      { path: '/', label: t('topics') },
      { path: '/progress', label: t('progress') },
      { path: '/proposals', label: t('proposals', { defaultValue: 'Proposals' }) },
      { path: '/submit', label: t('submit', { defaultValue: 'Submit topic' }) },
      { path: '/admin', label: t('admin') },
      { path: '/settings', label: t('settings') },
    ],
    [t],
  );

  return (
    <>
      {open && (
        <div
          role="presentation"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[var(--z-modal)] bg-canvas/55 backdrop-blur-sm animate-fade-in"
        />
      )}
      {open && (
        <div className="fixed inset-x-0 top-[14vh] z-[var(--z-modal)] mx-auto w-[92vw] max-w-[640px] px-3">
          <Command
            label="Command palette"
            shouldFilter
            className="bg-surface border border-border-base rounded-xl overflow-hidden shadow-float animate-rise"
          >
            <div>
              <div className="flex items-center gap-2 px-4 h-12 border-b border-border-base/50">
                <Sparkles size={14} className="text-accent shrink-0" />
                <Command.Input
                  autoFocus
                  placeholder={t('search')}
                  className="flex-1 bg-transparent outline-none text-[14.5px] text-fg placeholder:text-fg-subtle"
                />
                <Kbd>esc</Kbd>
              </div>
              <Command.List className="max-h-[60vh] overflow-y-auto p-2">
                <Command.Empty className="px-3 py-6 text-center text-[13px] text-fg-subtle">
                  {t('searchEmpty')}
                </Command.Empty>

                {manifests.length > 0 && (
                  <Command.Group
                    heading={t('topics')}
                    className="px-1 py-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-1 [&_[cmdk-group-heading]]:pb-2 [&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-fg-subtle"
                  >
                    {manifests.map((manifest) => (
                      <PaletteItem
                        key={`topic-${manifest.slug}`}
                        value={`topic ${manifest.title} ${manifest.tags.join(' ')} ${manifest.slug}`}
                        onSelect={() => goTopic(manifest.slug)}
                        icon={runtimeIcon(manifest.runtime)}
                        title={manifest.title}
                        meta={`${manifest.concepts.length} · ${manifest.difficulty}`}
                      />
                    ))}
                  </Command.Group>
                )}

                <Command.Group
                  heading={tCommon('languageLabel')}
                  className="px-1 py-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-1 [&_[cmdk-group-heading]]:pb-2 [&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-fg-subtle"
                >
                  <PaletteItem
                    value="lang russian ru русский"
                    onSelect={() => switchLanguage('ru')}
                    icon={<Languages size={14} />}
                    title={tCommon('ru')}
                    meta="ru"
                  />
                  <PaletteItem
                    value="lang english en"
                    onSelect={() => switchLanguage('en')}
                    icon={<Languages size={14} />}
                    title={tCommon('en')}
                    meta="en"
                  />
                </Command.Group>

                <Command.Group
                  heading={t('topics')}
                  className="px-1 py-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-1 [&_[cmdk-group-heading]]:pb-2 [&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-fg-subtle"
                >
                  {navItems.map((item) => (
                    <PaletteItem
                      key={item.path}
                      value={`go ${item.path} ${item.label}`}
                      onSelect={() => go(item.path)}
                      icon={navIcon[item.path] ?? <ArrowRight size={14} />}
                      title={item.label}
                      meta={item.path}
                    />
                  ))}
                </Command.Group>

                <Command.Group
                  heading="Theme"
                  className="px-1 py-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-1 [&_[cmdk-group-heading]]:pb-2 [&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-fg-subtle"
                >
                  <PaletteItem
                    value="theme toggle dark light"
                    onSelect={toggleTheme}
                    icon={
                      <span className="inline-flex">
                        <Sun size={14} className="mr-0.5" />
                        <Moon size={14} />
                      </span>
                    }
                    title="Toggle theme"
                    meta="dark / light"
                  />
                </Command.Group>
              </Command.List>
              <div className="flex items-center justify-between gap-2 px-3 h-9 border-t border-border-base/50 bg-canvas/40">
                <div className="flex items-center gap-1.5 text-[11px] text-fg-subtle">
                  <Kbd>↑</Kbd>
                  <Kbd>↓</Kbd>
                  <span>nav</span>
                  <Kbd>↵</Kbd>
                  <span>open</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-fg-subtle">
                  <Kbd>⌘</Kbd>
                  <Kbd>K</Kbd>
                </div>
              </div>
            </div>
          </Command>
        </div>
      )}
    </>
  );
};

interface PaletteItemProps {
  value: string;
  onSelect: () => void;
  icon: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
}

const PaletteItem = ({ value, onSelect, icon, title, meta }: PaletteItemProps) => (
  <Command.Item
    value={value}
    onSelect={onSelect}
    className={cx(
      'flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 cursor-pointer outline-none',
      'data-[selected=true]:bg-accent/10 data-[selected=true]:text-fg',
      'text-fg-muted transition-colors duration-fast',
    )}
  >
    <span className="flex items-center gap-2.5 min-w-0">
      <span className="grid place-items-center size-6 rounded-md bg-surface-2/60 text-fg-subtle">
        {icon}
      </span>
      <span className="text-[13.5px] truncate">{title}</span>
    </span>
    {meta && (
      <span className="text-[11px] text-fg-subtle tabular-nums shrink-0">{meta}</span>
    )}
  </Command.Item>
);
