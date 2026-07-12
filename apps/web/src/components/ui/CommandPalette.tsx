import { useEffect, useMemo, useState } from 'react';

import * as RadixDialog from '@radix-ui/react-dialog';
import type { InterviewQuestionMeta } from '@dotlearn/contracts';
import { Command, useCommandState } from 'cmdk';
import {
  ArrowRight,
  Bookmark,
  BookOpen,
  CalendarCheck,
  Code2,
  Database,
  FileText,
  FlaskConical,
  GitBranch,
  Hash,
  Inbox,
  Languages,
  Layers,
  Library,
  ListChecks,
  MessagesSquare,
  Moon,
  PencilLine,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Waypoints,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  loadSearchEntries,
  searchContentEntries,
  searchInterviewEntries,
  searchLanguageOf,
  type SearchEntry,
} from '@/lib/content-search';
import { flashcardTopicSlugs } from '@/lib/flashcard-decks';
import { getCurrentLanguage } from '@/lib/i18n';
import { conceptTitle, topicTitle } from '@/lib/topics';
import { useAllNotedKeys, useBookmarks } from '@/lib/use-learning';
import { useVisibleManifests } from '@/lib/use-manifests';
import { router } from '@/router';

import { getSettings, setSettings } from '../../lib/settings';
import { resolveTheme } from '../../lib/theme';
import { cx } from './cx';
import { Kbd } from './Kbd';

const GROUP_CLASS =
  'px-1 py-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-1 [&_[cmdk-group-heading]]:pb-2 [&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-fg-subtle';

const INTERVIEW_LIMIT = 25;
const CONTENT_LIMIT = 30;

const runtimeIcon = (runtime: string) => {
  if (runtime === 'sql.js') return <Database size={14} />;
  if (runtime === 'pyodide') return <FlaskConical size={14} />;
  if (runtime === 'javascript') return <Code2 size={14} />;
  if (runtime === 'git') return <GitBranch size={14} />;
  return <FileText size={14} />;
};

const navIcon: Record<string, React.ReactNode> = {
  '/': <Hash size={14} />,
  '/search': <Search size={14} />,
  '/today': <CalendarCheck size={14} />,
  '/map': <Waypoints size={14} />,
  '/progress': <ListChecks size={14} />,
  '/library': <Library size={14} />,
  '/settings': <Settings size={14} />,
  '/admin': <ShieldCheck size={14} />,
  '/submit': <PencilLine size={14} />,
  '/proposals': <Inbox size={14} />,
};

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const { t, i18n } = useTranslation('nav');
  const { t: tCommon } = useTranslation('common');
  const setOpen = (value: boolean): void => onOpenChange(value);
  const manifests = useVisibleManifests();
  const [interview, setInterview] = useState<InterviewQuestionMeta[]>([]);
  const [searchEntries, setSearchEntries] = useState<SearchEntry[]>([]);
  const [query, setQuery] = useState('');
  const bookmarks = useBookmarks();
  const notedKeys = useAllNotedKeys();

  const searchLanguage = searchLanguageOf(i18n.resolvedLanguage);
  const language = getCurrentLanguage();

  useEffect(() => {
    if (!open) return;
    setQuery('');
    let cancelled = false;
    void import('@/lib/interview').then((module) => {
      if (!cancelled) setInterview(module.getInterviewIndex());
    });
    void loadSearchEntries(searchLanguage).then((entries) => {
      if (!cancelled) setSearchEntries(entries);
    });
    return () => {
      cancelled = true;
    };
  }, [open, searchLanguage]);

  const concepts = useMemo(
    () =>
      manifests.flatMap((manifest) =>
        manifest.concepts.map((concept, index) => ({
          slug: manifest.slug,
          topicTitle: topicTitle(manifest, language),
          conceptId: concept.id,
          conceptTitle: conceptTitle(concept, language),
          index,
        })),
      ),
    [manifests, language],
  );

  const deckTopics = useMemo(() => {
    const slugs = new Set(flashcardTopicSlugs());
    return manifests.filter((manifest) => slugs.has(manifest.slug));
  }, [manifests]);

  const conceptLabelOf = useMemo(() => {
    const map = new Map<string, { topicTitle: string; conceptTitle: string }>();
    for (const concept of concepts) {
      map.set(`${concept.slug}:${concept.conceptId}`, {
        topicTitle: concept.topicTitle,
        conceptTitle: concept.conceptTitle,
      });
    }
    return map;
  }, [concepts]);

  const interviewMatches = useMemo(
    () => searchInterviewEntries(interview, query, INTERVIEW_LIMIT),
    [interview, query],
  );

  const contentMatches = useMemo(
    () => searchContentEntries(searchEntries, query, CONTENT_LIMIT),
    [searchEntries, query],
  );

  const go = (path: string): void => {
    setOpen(false);
    void router.navigate({ to: path });
  };

  const goTopic = (slug: string): void => {
    setOpen(false);
    void router.navigate({ to: '/topics/$slug', params: { slug } });
  };

  const goConcept = (slug: string, conceptId: string): void => {
    setOpen(false);
    void router.navigate({
      to: '/topics/$slug',
      params: { slug },
      search: { concept: conceptId },
    });
  };

  const goInterview = (id: number): void => {
    setOpen(false);
    void router.navigate({ to: '/interview/$id', params: { id: String(id) } });
  };

  const goFlashcards = (slug: string): void => {
    setOpen(false);
    void router.navigate({ to: '/flashcards/$slug', params: { slug } });
  };

  const toggleTheme = (): void => {
    const next = resolveTheme(getSettings().themePreference) === 'dark' ? 'light' : 'dark';
    setSettings({ themePreference: next });
    setOpen(false);
  };

  const switchLanguage = (lang: 'ru' | 'en'): void => {
    void i18n.changeLanguage(lang);
    setOpen(false);
  };

  const navItems = useMemo(
    () => [
      { path: '/', label: t('topics') },
      { path: '/search', label: t('openSearch') },
      { path: '/today', label: t('today') },
      { path: '/map', label: t('map') },
      { path: '/progress', label: t('progress') },
      { path: '/library', label: t('library', { defaultValue: 'Library' }) },
      { path: '/proposals', label: t('proposals', { defaultValue: 'Proposals' }) },
      { path: '/settings', label: t('settings', { defaultValue: 'Settings' }) },
      { path: '/submit', label: t('submit', { defaultValue: 'Submit topic' }) },
      { path: '/admin', label: t('admin') },
    ],
    [t],
  );

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-[var(--z-modal)] bg-canvas/55 backdrop-blur-sm animate-fade-in" />
        <RadixDialog.Content
          aria-label={t('search')}
          className="fixed inset-x-0 top-[14vh] z-[var(--z-modal)] mx-auto w-[92vw] max-w-[640px] px-3 outline-none"
        >
          <RadixDialog.Title className="sr-only">{t('search')}</RadixDialog.Title>
          <Command
            label="Command palette"
            shouldFilter
            className="bg-surface border border-border-base rounded-xl overflow-hidden shadow-float animate-rise"
          >
            <div>
              <div className="flex items-center gap-2 px-4 h-12 border-b border-border-base/50">
                <Sparkles size={14} aria-hidden className="text-accent shrink-0" />
                <Command.Input
                  autoFocus
                  value={query}
                  onValueChange={setQuery}
                  placeholder={t('search')}
                  className="flex-1 bg-transparent outline-none text-[14.5px] text-fg placeholder:text-fg-subtle"
                />
                <Kbd>esc</Kbd>
              </div>
              <ResultCountStatus />
              <Command.List className="max-h-[60vh] overflow-y-auto p-2">
                <Command.Empty className="px-3 py-6 text-center text-[13px] text-fg-subtle">
                  {t('searchEmpty')}
                </Command.Empty>

                {manifests.length > 0 && (
                  <Command.Group heading={t('groups.topics')} className={GROUP_CLASS}>
                    {manifests.map((manifest) => (
                      <PaletteItem
                        key={`topic-${manifest.slug}`}
                        value={`topic ${manifest.title} ${manifest.titleEn ?? ''} ${manifest.tags.join(' ')} ${manifest.slug}`}
                        onSelect={() => goTopic(manifest.slug)}
                        icon={runtimeIcon(manifest.runtime)}
                        title={topicTitle(manifest, language)}
                        meta={`${manifest.concepts.length} · ${manifest.difficulty}`}
                      />
                    ))}
                  </Command.Group>
                )}

                {concepts.length > 0 && (
                  <Command.Group heading={t('groups.concepts')} className={GROUP_CLASS}>
                    {concepts.map((concept) => (
                      <PaletteItem
                        key={`concept-${concept.slug}-${concept.conceptId}`}
                        value={`concept ${concept.conceptTitle} ${concept.topicTitle} ${concept.conceptId}`}
                        onSelect={() => goConcept(concept.slug, concept.conceptId)}
                        icon={<BookOpen size={14} />}
                        title={concept.conceptTitle}
                        meta={concept.topicTitle}
                        dot={notedKeys.has(`${concept.slug}:${concept.conceptId}`)}
                      />
                    ))}
                  </Command.Group>
                )}

                {contentMatches.length > 0 && (
                  <Command.Group heading={t('groups.content')} className={GROUP_CLASS}>
                    {contentMatches.map((match) => (
                      <ContentPaletteItem
                        key={match.key}
                        value={`content ${query} ${match.conceptTitle} ${match.topicTitle} ${match.slug}`}
                        onSelect={() => goConcept(match.slug, match.conceptId)}
                        title={match.conceptTitle}
                        meta={match.topicTitle}
                        before={match.before}
                        hit={match.hit}
                        after={match.after}
                      />
                    ))}
                  </Command.Group>
                )}

                {interviewMatches.length > 0 && (
                  <Command.Group heading={t('groups.interview')} className={GROUP_CLASS}>
                    {interviewMatches.map((item) => (
                      <PaletteItem
                        key={`interview-${item.id}`}
                        value={`interview ${item.title} ${item.categoryLabel}`}
                        onSelect={() => goInterview(item.id)}
                        icon={<MessagesSquare size={14} />}
                        title={item.title}
                        meta={item.categoryLabel}
                      />
                    ))}
                  </Command.Group>
                )}

                {deckTopics.length > 0 && (
                  <Command.Group heading={t('groups.flashcards')} className={GROUP_CLASS}>
                    {deckTopics.map((manifest) => (
                      <PaletteItem
                        key={`deck-${manifest.slug}`}
                        value={`flashcards cards ${manifest.title} ${manifest.titleEn ?? ''} ${manifest.slug}`}
                        onSelect={() => goFlashcards(manifest.slug)}
                        icon={<Layers size={14} />}
                        title={topicTitle(manifest, language)}
                        meta={tCommon('languageLabel')}
                      />
                    ))}
                  </Command.Group>
                )}

                {bookmarks.length > 0 && (
                  <Command.Group heading={t('groups.bookmarks')} className={GROUP_CLASS}>
                    {bookmarks.map((bookmark) => {
                      const label = conceptLabelOf.get(
                        `${bookmark.topicSlug}:${bookmark.conceptId}`,
                      );
                      if (!label) return null;
                      return (
                        <PaletteItem
                          key={`bookmark-${bookmark.id}`}
                          value={`bookmark ${label.conceptTitle} ${label.topicTitle}`}
                          onSelect={() => goConcept(bookmark.topicSlug, bookmark.conceptId)}
                          icon={<Bookmark size={14} />}
                          title={label.conceptTitle}
                          meta={label.topicTitle}
                        />
                      );
                    })}
                  </Command.Group>
                )}

                <Command.Group heading={tCommon('languageLabel')} className={GROUP_CLASS}>
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

                <Command.Group heading={t('groups.go')} className={GROUP_CLASS}>
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

                <Command.Group heading={t('groups.theme')} className={GROUP_CLASS}>
                  <PaletteItem
                    value="theme toggle dark light тема"
                    onSelect={toggleTheme}
                    icon={
                      <span className="inline-flex">
                        <Sun size={14} className="mr-0.5" />
                        <Moon size={14} />
                      </span>
                    }
                    title={t('groups.toggleTheme')}
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
                  <Kbd>Ctrl</Kbd>
                  <Kbd>K</Kbd>
                </div>
              </div>
            </div>
          </Command>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

const ResultCountStatus = () => {
  const { t } = useTranslation('nav');
  const count = useCommandState((state) => state.filtered.count);
  return (
    <div role="status" aria-live="polite" className="sr-only">
      {t('resultCount', { count })}
    </div>
  );
};

interface PaletteItemProps {
  value: string;
  onSelect: () => void;
  icon: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  dot?: boolean;
}

const PaletteItem = ({ value, onSelect, icon, title, meta, dot }: PaletteItemProps) => (
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
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-accent shrink-0" />}
    </span>
    {meta && <span className="text-[11px] text-fg-subtle tabular-nums shrink-0">{meta}</span>}
  </Command.Item>
);

interface ContentPaletteItemProps {
  value: string;
  onSelect: () => void;
  title: React.ReactNode;
  meta: React.ReactNode;
  before: string;
  hit: string;
  after: string;
}

const ContentPaletteItem = ({
  value,
  onSelect,
  title,
  meta,
  before,
  hit,
  after,
}: ContentPaletteItemProps) => (
  <Command.Item
    value={value}
    onSelect={onSelect}
    className={cx(
      'flex items-start gap-2.5 rounded-lg px-2.5 py-2 cursor-pointer outline-none',
      'data-[selected=true]:bg-accent/10 data-[selected=true]:text-fg',
      'text-fg-muted transition-colors duration-fast',
    )}
  >
    <span className="grid place-items-center size-6 rounded-md bg-surface-2/60 text-fg-subtle shrink-0 mt-0.5">
      <Search size={14} />
    </span>
    <span className="flex flex-col min-w-0 gap-0.5">
      <span className="flex items-center justify-between gap-3">
        <span className="text-[13.5px] truncate">{title}</span>
        <span className="text-[11px] text-fg-subtle shrink-0">{meta}</span>
      </span>
      <span className="text-[12px] leading-snug text-fg-subtle line-clamp-2">
        {before}
        {hit && <span className="text-accent">{hit}</span>}
        {after}
      </span>
    </span>
  </Command.Item>
);
