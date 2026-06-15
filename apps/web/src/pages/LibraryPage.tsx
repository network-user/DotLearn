import { useEffect, useMemo, useState, type ReactNode } from 'react';

import type { TopicManifest } from '@dotlearn/contracts';
import { Link } from '@tanstack/react-router';
import { ArrowRight, Bookmark, Highlighter, NotebookPen, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Surface } from '@/components/ui/Surface';
import { cx } from '@/components/ui/cx';
import type { BookmarkRecord, ConceptNoteRecord, HighlightRecord } from '@/lib/progress-db';
import { removeHighlight, saveConceptNote, setBookmark } from '@/lib/progress-db';
import { listManifests } from '@/lib/topics';
import { useAllHighlights, useAllNotes, useBookmarks } from '@/lib/use-learning';

type TabKey = 'highlights' | 'notes' | 'bookmarks';

const TAB_KEYS: readonly TabKey[] = ['highlights', 'notes', 'bookmarks'] as const;

interface ResolvedTitles {
  topicTitle: string;
  conceptTitle: string;
}

const highlightDotClass: Record<HighlightRecord['color'], string> = {
  yellow: 'bg-amber-300',
  green: 'bg-emerald-300',
  blue: 'bg-sky-300',
  pink: 'bg-pink-300',
};

const highlightBorderClass: Record<HighlightRecord['color'], string> = {
  yellow: 'border-amber-400',
  green: 'border-emerald-400',
  blue: 'border-sky-400',
  pink: 'border-pink-400',
};

const matches = (query: string, ...values: string[]): boolean => {
  if (query.length === 0) return true;
  const needle = query.toLowerCase();
  return values.some((value) => value.toLowerCase().includes(needle));
};

export const LibraryPage = () => {
  const { t } = useTranslation('library');
  const highlights = useAllHighlights();
  const notes = useAllNotes();
  const bookmarks = useBookmarks();

  const [manifests, setManifests] = useState<TopicManifest[] | undefined>(undefined);
  const [tab, setTab] = useState<TabKey>('highlights');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    void listManifests().then((loaded) => {
      if (!cancelled) {
        setManifests(loaded);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const resolveTitles = useMemo(() => {
    return (topicSlug: string, conceptId: string): ResolvedTitles => {
      const manifest = manifests?.find((entry) => entry.slug === topicSlug);
      const concept = manifest?.concepts.find((entry) => entry.id === conceptId);
      return {
        topicTitle: manifest?.title ?? topicSlug,
        conceptTitle: concept?.title ?? conceptId,
      };
    };
  }, [manifests]);

  const trimmedQuery = query.trim();

  const filteredHighlights = useMemo(() => {
    return highlights.filter((item) => {
      const titles = resolveTitles(item.topicSlug, item.conceptId);
      return matches(
        trimmedQuery,
        item.text,
        item.note ?? '',
        titles.conceptTitle,
        titles.topicTitle,
      );
    });
  }, [highlights, resolveTitles, trimmedQuery]);

  const filteredNotes = useMemo(() => {
    return notes.filter((item) => {
      const titles = resolveTitles(item.topicSlug, item.conceptId);
      return matches(trimmedQuery, item.text, titles.conceptTitle, titles.topicTitle);
    });
  }, [notes, resolveTitles, trimmedQuery]);

  const filteredBookmarks = useMemo(() => {
    return bookmarks.filter((item) => {
      const titles = resolveTitles(item.topicSlug, item.conceptId);
      return matches(trimmedQuery, titles.conceptTitle, titles.topicTitle);
    });
  }, [bookmarks, resolveTitles, trimmedQuery]);

  const counts: Record<TabKey, number> = {
    highlights: highlights.length,
    notes: notes.length,
    bookmarks: bookmarks.length,
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-2 text-sm text-fg-muted">{t('subtitle')}</p>
      </header>

      <div
        role="tablist"
        aria-label={t('title')}
        className="inline-flex flex-wrap gap-1 rounded-lg border border-border-base bg-surface-2/50 p-1"
      >
        {TAB_KEYS.map((key) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(key)}
              className={cx(
                'min-h-[var(--tap)] sm:min-h-0 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors inline-flex items-center gap-1.5',
                active
                  ? 'bg-accent text-surface dark:text-canvas'
                  : 'text-fg-muted hover:text-fg hover:bg-surface-2',
              )}
            >
              <span>{t(`tabs.${key}`)}</span>
              <span className="tabular-nums opacity-70">{counts[key]}</span>
            </button>
          );
        })}
      </div>

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t('searchPlaceholder')}
        className="form-input w-full"
        aria-label={t('searchPlaceholder')}
      />

      {manifests === undefined ? (
        <ul className="space-y-3">
          {[0, 1, 2].map((index) => (
            <li key={index}>
              <Skeleton className="h-24 w-full" rounded="2xl" />
            </li>
          ))}
        </ul>
      ) : tab === 'highlights' ? (
        <TabList
          sourceCount={counts.highlights}
          filteredCount={filteredHighlights.length}
          emptyMessage={t('empty.highlights')}
          noMatchesMessage={t('noMatches')}
        >
          {filteredHighlights.map((item) => (
            <HighlightCard
              key={item.id}
              item={item}
              titles={resolveTitles(item.topicSlug, item.conceptId)}
              openLabel={t('open')}
              removeLabel={t('remove')}
            />
          ))}
        </TabList>
      ) : tab === 'notes' ? (
        <TabList
          sourceCount={counts.notes}
          filteredCount={filteredNotes.length}
          emptyMessage={t('empty.notes')}
          noMatchesMessage={t('noMatches')}
        >
          {filteredNotes.map((item) => (
            <NoteCard
              key={item.id}
              item={item}
              titles={resolveTitles(item.topicSlug, item.conceptId)}
              openLabel={t('open')}
              removeLabel={t('remove')}
            />
          ))}
        </TabList>
      ) : (
        <TabList
          sourceCount={counts.bookmarks}
          filteredCount={filteredBookmarks.length}
          emptyMessage={t('empty.bookmarks')}
          noMatchesMessage={t('noMatches')}
        >
          {filteredBookmarks.map((item) => (
            <BookmarkCard
              key={item.id}
              item={item}
              titles={resolveTitles(item.topicSlug, item.conceptId)}
              openLabel={t('open')}
              removeLabel={t('remove')}
            />
          ))}
        </TabList>
      )}
    </div>
  );
};

interface TabListProps {
  sourceCount: number;
  filteredCount: number;
  emptyMessage: string;
  noMatchesMessage: string;
  children: ReactNode;
}

const TabList = ({
  sourceCount,
  filteredCount,
  emptyMessage,
  noMatchesMessage,
  children,
}: TabListProps) => {
  if (sourceCount === 0) {
    return (
      <Surface variant="inset" className="p-8 text-center text-sm text-fg-muted">
        {emptyMessage}
      </Surface>
    );
  }
  if (filteredCount === 0) {
    return (
      <Surface variant="inset" className="p-8 text-center text-sm text-fg-muted">
        {noMatchesMessage}
      </Surface>
    );
  }
  return <ul className="space-y-3">{children}</ul>;
};

interface OpenLinkProps {
  topicSlug: string;
  conceptId: string;
  label: string;
}

const OpenLink = ({ topicSlug, conceptId, label }: OpenLinkProps) => (
  <Link to="/topics/$slug" params={{ slug: topicSlug }} search={{ concept: conceptId }}>
    <Button variant="outline" size="sm" trailingIcon={<ArrowRight size={14} />}>
      {label}
    </Button>
  </Link>
);

interface RemoveButtonProps {
  label: string;
  onRemove: () => void;
}

const RemoveButton = ({ label, onRemove }: RemoveButtonProps) => (
  <button
    type="button"
    aria-label={label}
    onClick={onRemove}
    className="size-9 grid place-items-center rounded-lg border border-border-base text-fg-muted hover:text-err transition-colors"
  >
    <Trash2 size={15} />
  </button>
);

interface CardActionsProps {
  topicSlug: string;
  conceptId: string;
  openLabel: string;
  removeLabel: string;
  onRemove: () => void;
}

const CardActions = ({
  topicSlug,
  conceptId,
  openLabel,
  removeLabel,
  onRemove,
}: CardActionsProps) => (
  <div className="flex items-center gap-2 shrink-0">
    <OpenLink topicSlug={topicSlug} conceptId={conceptId} label={openLabel} />
    <RemoveButton label={removeLabel} onRemove={onRemove} />
  </div>
);

interface MetaLineProps {
  conceptTitle: string;
  topicTitle: string;
}

const MetaLine = ({ conceptTitle, topicTitle }: MetaLineProps) => (
  <p className="text-[11px] text-fg-subtle">
    {conceptTitle} · {topicTitle}
  </p>
);

interface HighlightCardProps {
  item: HighlightRecord;
  titles: ResolvedTitles;
  openLabel: string;
  removeLabel: string;
}

const HighlightCard = ({ item, titles, openLabel, removeLabel }: HighlightCardProps) => (
  <li>
    <Surface variant="chrome" className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 inline-flex shrink-0 items-center gap-1.5">
              <Highlighter size={16} className="text-fg-subtle" />
              <span
                aria-hidden
                className={cx('size-2.5 rounded-full', highlightDotClass[item.color])}
              />
            </span>
            <blockquote
              className={cx(
                'border-l-2 pl-3 font-serif text-[15px] text-fg',
                highlightBorderClass[item.color],
              )}
            >
              {item.text}
            </blockquote>
          </div>
          {item.note ? <p className="mt-1 text-[13px] text-fg-muted">{item.note}</p> : null}
          <div className="mt-2">
            <MetaLine conceptTitle={titles.conceptTitle} topicTitle={titles.topicTitle} />
          </div>
        </div>
        <CardActions
          topicSlug={item.topicSlug}
          conceptId={item.conceptId}
          openLabel={openLabel}
          removeLabel={removeLabel}
          onRemove={() => void removeHighlight(item.id)}
        />
      </div>
    </Surface>
  </li>
);

interface NoteCardProps {
  item: ConceptNoteRecord;
  titles: ResolvedTitles;
  openLabel: string;
  removeLabel: string;
}

const NoteCard = ({ item, titles, openLabel, removeLabel }: NoteCardProps) => (
  <li>
    <Surface variant="chrome" className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <NotebookPen size={16} className="mt-0.5 shrink-0 text-accent" />
            <p className="line-clamp-3 text-sm text-fg whitespace-pre-wrap">{item.text}</p>
          </div>
          <div className="mt-2">
            <MetaLine conceptTitle={titles.conceptTitle} topicTitle={titles.topicTitle} />
          </div>
        </div>
        <CardActions
          topicSlug={item.topicSlug}
          conceptId={item.conceptId}
          openLabel={openLabel}
          removeLabel={removeLabel}
          onRemove={() => void saveConceptNote(item.topicSlug, item.conceptId, '')}
        />
      </div>
    </Surface>
  </li>
);

interface BookmarkCardProps {
  item: BookmarkRecord;
  titles: ResolvedTitles;
  openLabel: string;
  removeLabel: string;
}

const BookmarkCard = ({ item, titles, openLabel, removeLabel }: BookmarkCardProps) => (
  <li>
    <Surface variant="chrome" className="p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Bookmark size={16} className="shrink-0 text-accent" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-fg">{titles.conceptTitle}</p>
              <p className="truncate text-xs text-fg-subtle">{titles.topicTitle}</p>
            </div>
          </div>
        </div>
        <CardActions
          topicSlug={item.topicSlug}
          conceptId={item.conceptId}
          openLabel={openLabel}
          removeLabel={removeLabel}
          onRemove={() => void setBookmark(item.topicSlug, item.conceptId, false)}
        />
      </div>
    </Surface>
  </li>
);
