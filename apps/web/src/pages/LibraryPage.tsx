import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { Link } from '@tanstack/react-router';
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Download,
  GraduationCap,
  Highlighter,
  Layers,
  NotebookPen,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { FlashcardReviewSession } from '@/components/FlashcardReviewSession';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Surface } from '@/components/ui/Surface';
import { cx } from '@/components/ui/cx';
import { THEORY_HIGHLIGHTS_ENABLED } from '@/lib/feature-flags';
import { loadUserCardSessionCards, type SessionCard } from '@/lib/flashcard-sources';
import { initFlashcardReview } from '@/lib/flashcards';
import {
  buildNotesMarkdown,
  downloadMarkdown,
  type MarkdownSection,
  type NotesExportLabels,
} from '@/lib/notes-export';
import {
  createUserCard,
  deleteUserCard,
  removeHighlight,
  saveConceptNote,
  setBookmark,
  setBookmarkTags,
  setNoteTags,
  USER_CARDS_DECK_SLUG,
  type BookmarkRecord,
  type ConceptNoteRecord,
  type HighlightRecord,
  type UserCardRecord,
} from '@/lib/progress-db';
import {
  useAllHighlights,
  useAllNotes,
  useBookmarks,
  useDueUserCardCount,
  useLibraryTags,
  useUserCards,
} from '@/lib/use-learning';
import { useVisibleManifests } from '@/lib/use-manifests';

type TabKey = 'all' | 'highlights' | 'notes' | 'bookmarks' | 'cards';

const buildTabKeys = (): TabKey[] => {
  const keys: TabKey[] = ['all'];
  if (THEORY_HIGHLIGHTS_ENABLED) keys.push('highlights');
  keys.push('notes', 'bookmarks', 'cards');
  return keys;
};

const TAB_KEYS = buildTabKeys();
const DEFAULT_TAB: TabKey = 'all';

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

const hasTag = (tags: string[] | undefined, tag: string | null): boolean => {
  if (!tag) return true;
  return (tags ?? []).some((entry) => entry.toLowerCase() === tag.toLowerCase());
};

type FeedKind = 'highlight' | 'note' | 'bookmark';

interface FeedEntry {
  kind: FeedKind;
  at: string;
  highlight?: HighlightRecord;
  note?: ConceptNoteRecord;
  bookmark?: BookmarkRecord;
}

interface FlashcardDraft {
  front: string;
  back: string;
  topicSlug: string;
  conceptId?: string;
  sourceNoteId?: string;
  sourceHighlightId?: string;
}

export const LibraryPage = () => {
  const { t } = useTranslation('library');
  const highlights = useAllHighlights();
  const notes = useAllNotes();
  const bookmarks = useBookmarks();
  const userCards = useUserCards();
  const dueCardCount = useDueUserCardCount();
  const availableTags = useLibraryTags();

  const manifests = useVisibleManifests();
  const [tab, setTab] = useState<TabKey>(DEFAULT_TAB);
  const [query, setQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [draft, setDraft] = useState<FlashcardDraft | null>(null);

  const resolveTitles = useMemo(() => {
    return (topicSlug: string, conceptId: string): ResolvedTitles => {
      const manifest = manifests.find((entry) => entry.slug === topicSlug);
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
      return (
        hasTag(item.tags, activeTag) &&
        matches(
          trimmedQuery,
          item.text,
          (item.tags ?? []).join(' '),
          titles.conceptTitle,
          titles.topicTitle,
        )
      );
    });
  }, [notes, resolveTitles, trimmedQuery, activeTag]);

  const filteredBookmarks = useMemo(() => {
    return bookmarks.filter((item) => {
      const titles = resolveTitles(item.topicSlug, item.conceptId);
      return (
        hasTag(item.tags, activeTag) &&
        matches(
          trimmedQuery,
          (item.tags ?? []).join(' '),
          titles.conceptTitle,
          titles.topicTitle,
        )
      );
    });
  }, [bookmarks, resolveTitles, trimmedQuery, activeTag]);

  const filteredCards = useMemo(() => {
    return userCards.filter((item) =>
      matches(
        trimmedQuery,
        item.front,
        item.back,
        resolveTitles(item.topicSlug, item.conceptId ?? item.topicSlug).topicTitle,
      ),
    );
  }, [userCards, resolveTitles, trimmedQuery]);

  const filteredFeed = useMemo<FeedEntry[]>(() => {
    const entries: FeedEntry[] = [];
    for (const item of filteredHighlights) {
      entries.push({ kind: 'highlight', at: item.createdAt, highlight: item });
    }
    for (const item of filteredNotes) {
      entries.push({ kind: 'note', at: item.updatedAt, note: item });
    }
    for (const item of filteredBookmarks) {
      entries.push({ kind: 'bookmark', at: item.createdAt, bookmark: item });
    }
    return entries.sort((a, b) => b.at.localeCompare(a.at));
  }, [filteredHighlights, filteredNotes, filteredBookmarks]);

  const counts: Record<TabKey, number> = {
    all: highlights.length + notes.length + bookmarks.length,
    highlights: highlights.length,
    notes: notes.length,
    bookmarks: bookmarks.length,
    cards: userCards.length,
  };

  const totalCount = counts.all;
  const tagApplies = tab === 'all' || tab === 'notes' || tab === 'bookmarks';

  const startFlashcardDraft = useCallback((next: FlashcardDraft) => {
    setDraft(next);
  }, []);

  const saveFlashcard = useCallback(async (input: FlashcardDraft) => {
    const front = input.front.trim();
    const back = input.back.trim();
    if (front.length === 0 || back.length === 0) return;
    const record = await createUserCard({
      front,
      back,
      topicSlug: input.topicSlug,
      ...(input.conceptId ? { conceptId: input.conceptId } : {}),
      ...(input.sourceNoteId ? { sourceNoteId: input.sourceNoteId } : {}),
      ...(input.sourceHighlightId ? { sourceHighlightId: input.sourceHighlightId } : {}),
    });
    await initFlashcardReview(USER_CARDS_DECK_SLUG, record.id);
    setDraft(null);
  }, []);

  const reviewCards = useCallback(
    (): Promise<SessionCard[]> =>
      loadUserCardSessionCards((record) => {
        const titles = resolveTitles(record.topicSlug, record.conceptId ?? record.topicSlug);
        return record.conceptId ? `${titles.conceptTitle} · ${titles.topicTitle}` : titles.topicTitle;
      }),
    [resolveTitles],
  );

  const runExport = (sections: MarkdownSection[], fileSuffix: string) => {
    const labels: NotesExportLabels = {
      documentTitle: t('export.documentTitle'),
      highlightsHeading: t('tabs.highlights'),
      notesHeading: t('tabs.notes'),
      bookmarksHeading: t('tabs.bookmarks'),
      openLink: t('open'),
      emptyDocument: t('export.empty'),
    };
    const markdown = buildNotesMarkdown({
      highlights,
      notes,
      bookmarks,
      sections,
      resolveTitles,
      origin: typeof window !== 'undefined' ? window.location.origin : '',
      labels,
    });
    const stamp = new Date().toISOString().slice(0, 10);
    downloadMarkdown(markdown, `dotlearn-${fileSuffix}-${stamp}.md`);
  };

  if (reviewing) {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={<ArrowLeft size={15} />}
          onClick={() => setReviewing(false)}
        >
          {t('review.back')}
        </Button>
        <LibraryReview load={reviewCards} onExit={() => setReviewing(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="mt-2 text-sm text-fg-muted">{t('subtitle')}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<GraduationCap size={15} />}
            disabled={totalCount === 0 && userCards.length === 0}
            onClick={() => setReviewing(true)}
            className="w-full sm:w-auto"
          >
            <span className="inline-flex items-center gap-1.5">
              {t('review.start')}
              {dueCardCount > 0 ? (
                <span className="rounded-full bg-surface/25 px-1.5 text-[11px] tabular-nums dark:bg-canvas/25">
                  {dueCardCount}
                </span>
              ) : null}
            </span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            leadingIcon={<Download size={14} />}
            disabled={totalCount === 0}
            onClick={() => runExport(['highlights', 'notes', 'bookmarks'], 'library')}
            className="w-full sm:w-auto"
          >
            {t('export.all')}
          </Button>
        </div>
      </header>

      {tagApplies && availableTags.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t('tags.filterLabel')}>
          <TagChip
            label={t('tags.all')}
            active={activeTag === null}
            onClick={() => setActiveTag(null)}
          />
          {availableTags.map((tag) => (
            <TagChip
              key={tag}
              label={tag}
              active={activeTag !== null && activeTag.toLowerCase() === tag.toLowerCase()}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            />
          ))}
        </div>
      ) : null}

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

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('searchPlaceholder')}
          className="form-input w-full sm:flex-1"
          aria-label={t('searchPlaceholder')}
        />
        {tab !== 'all' && tab !== 'cards' ? (
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<Download size={14} />}
            disabled={counts[tab] === 0}
            onClick={() => runExport([tab as MarkdownSection], tab)}
            className="w-full sm:w-auto"
          >
            {t('export.tab', { tab: t(`tabs.${tab}`) })}
          </Button>
        ) : null}
      </div>

      {tab === 'all' ? (
        <TabList
          sourceCount={counts.all}
          filteredCount={filteredFeed.length}
          emptyBody={t('empty.all')}
          onClearSearch={trimmedQuery.length > 0 ? () => setQuery('') : undefined}
        >
          {filteredFeed.map((entry) =>
            entry.kind === 'highlight' && entry.highlight ? (
              <HighlightCard
                key={`h-${entry.highlight.id}`}
                item={entry.highlight}
                titles={resolveTitles(entry.highlight.topicSlug, entry.highlight.conceptId)}
                onMakeCard={startFlashcardDraft}
              />
            ) : entry.kind === 'note' && entry.note ? (
              <NoteCard
                key={`n-${entry.note.id}`}
                item={entry.note}
                titles={resolveTitles(entry.note.topicSlug, entry.note.conceptId)}
                onMakeCard={startFlashcardDraft}
              />
            ) : entry.bookmark ? (
              <BookmarkCard
                key={`b-${entry.bookmark.id}`}
                item={entry.bookmark}
                titles={resolveTitles(entry.bookmark.topicSlug, entry.bookmark.conceptId)}
              />
            ) : null,
          )}
        </TabList>
      ) : tab === 'highlights' ? (
        <TabList
          sourceCount={counts.highlights}
          filteredCount={filteredHighlights.length}
          emptyBody={t('empty.highlights')}
          onClearSearch={trimmedQuery.length > 0 ? () => setQuery('') : undefined}
        >
          {filteredHighlights.map((item) => (
            <HighlightCard
              key={item.id}
              item={item}
              titles={resolveTitles(item.topicSlug, item.conceptId)}
              onMakeCard={startFlashcardDraft}
            />
          ))}
        </TabList>
      ) : tab === 'notes' ? (
        <TabList
          sourceCount={counts.notes}
          filteredCount={filteredNotes.length}
          emptyBody={t('empty.notes')}
          onClearSearch={trimmedQuery.length > 0 ? () => setQuery('') : undefined}
        >
          {filteredNotes.map((item) => (
            <NoteCard
              key={item.id}
              item={item}
              titles={resolveTitles(item.topicSlug, item.conceptId)}
              onMakeCard={startFlashcardDraft}
            />
          ))}
        </TabList>
      ) : tab === 'bookmarks' ? (
        <TabList
          sourceCount={counts.bookmarks}
          filteredCount={filteredBookmarks.length}
          emptyBody={t('empty.bookmarks')}
          onClearSearch={trimmedQuery.length > 0 ? () => setQuery('') : undefined}
        >
          {filteredBookmarks.map((item) => (
            <BookmarkCard
              key={item.id}
              item={item}
              titles={resolveTitles(item.topicSlug, item.conceptId)}
            />
          ))}
        </TabList>
      ) : (
        <TabList
          sourceCount={counts.cards}
          filteredCount={filteredCards.length}
          emptyBody={t('empty.cards')}
          onClearSearch={trimmedQuery.length > 0 ? () => setQuery('') : undefined}
        >
          {filteredCards.map((item) => (
            <UserCardItem
              key={item.id}
              item={item}
              titles={resolveTitles(item.topicSlug, item.conceptId ?? item.topicSlug)}
            />
          ))}
        </TabList>
      )}

      <FlashcardDraftDialog draft={draft} onClose={() => setDraft(null)} onSave={saveFlashcard} />
    </div>
  );
};

interface LibraryReviewProps {
  load: () => Promise<SessionCard[]>;
  onExit: () => void;
}

const LibraryReview = ({ load, onExit }: LibraryReviewProps) => {
  const { t } = useTranslation('library');
  const [cards, setCards] = useState<SessionCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void load().then((loaded) => {
      if (cancelled) return;
      setCards(loaded);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  return (
    <FlashcardReviewSession
      cards={cards}
      loading={loading}
      title={t('review.title')}
      subtitle={t('review.subtitle')}
      emptyMessage={t('review.empty')}
      onExit={onExit}
      exitLabel={t('review.back')}
    />
  );
};

interface TagChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

const TagChip = ({ label, active, onClick }: TagChipProps) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={cx(
      'min-h-[32px] rounded-full border px-3 text-[12px] font-medium transition-colors',
      active
        ? 'border-accent bg-accent text-surface dark:text-canvas'
        : 'border-border-base bg-surface-2/40 text-fg-muted hover:text-fg hover:bg-surface-2',
    )}
  >
    {label}
  </button>
);

interface TabListProps {
  sourceCount: number;
  filteredCount: number;
  emptyBody: string;
  onClearSearch?: (() => void) | undefined;
  children: ReactNode;
}

const TabList = ({
  sourceCount,
  filteredCount,
  emptyBody,
  onClearSearch,
  children,
}: TabListProps) => {
  const { t } = useTranslation('library');
  if (sourceCount === 0) {
    return (
      <EmptyState
        icon={<NotebookPen size={22} className="text-accent" />}
        title={t('empty.title')}
        body={emptyBody}
        primaryAction={
          <Link to="/" hash="topics" className="block w-full sm:w-auto">
            <Button variant="primary" size="md" className="w-full min-h-[var(--tap)] sm:min-h-0 sm:w-auto" trailingIcon={<ArrowRight size={15} />}>
              {t('exploreTopics')}
            </Button>
          </Link>
        }
      />
    );
  }
  if (filteredCount === 0) {
    return (
      <EmptyState
        icon={<Search size={22} className="text-fg-subtle" />}
        title={t('noMatchesTitle')}
        body={t('noMatchesBody')}
        primaryAction={
          onClearSearch ? (
            <Button
              variant="outline"
              size="md"
              className="w-full min-h-[var(--tap)] sm:min-h-0 sm:w-auto"
              leadingIcon={<X size={15} />}
              onClick={onClearSearch}
            >
              {t('clearSearch')}
            </Button>
          ) : undefined
        }
      />
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

interface IconButtonProps {
  label: string;
  onClick: () => void;
  tone?: 'default' | 'danger';
  children: ReactNode;
}

const IconButton = ({ label, onClick, tone = 'default', children }: IconButtonProps) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    onClick={onClick}
    className={cx(
      'size-9 grid place-items-center rounded-lg border border-border-base text-fg-muted transition-colors',
      tone === 'danger' ? 'hover:text-err' : 'hover:text-accent',
    )}
  >
    {children}
  </button>
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

interface TagsRowProps {
  tags: string[] | undefined;
  onChange: (tags: string[]) => void;
}

const TagsRow = ({ tags, onChange }: TagsRowProps) => {
  const { t } = useTranslation('library');
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState('');
  const list = tags ?? [];

  const commit = () => {
    const trimmed = value.trim();
    if (trimmed.length > 0 && !list.some((entry) => entry.toLowerCase() === trimmed.toLowerCase())) {
      onChange([...list, trimmed]);
    }
    setValue('');
    setAdding(false);
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {list.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full border border-border-base bg-surface-2/40 py-0.5 pl-2 pr-1 text-[11px] text-fg-muted"
        >
          {tag}
          <button
            type="button"
            aria-label={t('tags.remove', { tag })}
            onClick={() => onChange(list.filter((entry) => entry !== tag))}
            className="grid size-4 place-items-center rounded-full text-fg-subtle hover:text-err"
          >
            <X size={11} />
          </button>
        </span>
      ))}
      {adding ? (
        <input
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
            }
            if (event.key === 'Escape') {
              setValue('');
              setAdding(false);
            }
          }}
          placeholder={t('tags.placeholder')}
          aria-label={t('tags.placeholder')}
          className="form-input h-7 w-28 px-2 py-0 text-[16px] sm:text-[12px]"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex min-h-[28px] items-center gap-1 rounded-full border border-dashed border-border-base px-2 text-[11px] text-fg-subtle hover:text-accent"
        >
          <Plus size={11} />
          {t('tags.add')}
        </button>
      )}
    </div>
  );
};

interface MakeCardButtonProps {
  label: string;
  onClick: () => void;
}

const MakeCardButton = ({ label, onClick }: MakeCardButtonProps) => (
  <IconButton label={label} onClick={onClick}>
    <Sparkles size={15} />
  </IconButton>
);

interface HighlightCardProps {
  item: HighlightRecord;
  titles: ResolvedTitles;
  onMakeCard: (draft: FlashcardDraft) => void;
}

const HighlightCard = ({ item, titles, onMakeCard }: HighlightCardProps) => {
  const { t } = useTranslation('library');
  return (
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
          <div className="flex items-center gap-2 shrink-0">
            <MakeCardButton
              label={t('makeCard.action')}
              onClick={() =>
                onMakeCard({
                  front: titles.conceptTitle,
                  back: item.note && item.note.length > 0 ? `${item.text}\n\n${item.note}` : item.text,
                  topicSlug: item.topicSlug,
                  conceptId: item.conceptId,
                  sourceHighlightId: item.id,
                })
              }
            />
            <OpenLink topicSlug={item.topicSlug} conceptId={item.conceptId} label={t('open')} />
            <IconButton
              label={t('remove')}
              tone="danger"
              onClick={() => void removeHighlight(item.id)}
            >
              <Trash2 size={15} />
            </IconButton>
          </div>
        </div>
      </Surface>
    </li>
  );
};

interface NoteCardProps {
  item: ConceptNoteRecord;
  titles: ResolvedTitles;
  onMakeCard: (draft: FlashcardDraft) => void;
}

const NoteCard = ({ item, titles, onMakeCard }: NoteCardProps) => {
  const { t } = useTranslation('library');
  return (
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
            <TagsRow tags={item.tags} onChange={(tags) => void setNoteTags(item.id, tags)} />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <MakeCardButton
              label={t('makeCard.action')}
              onClick={() =>
                onMakeCard({
                  front: titles.conceptTitle,
                  back: item.text,
                  topicSlug: item.topicSlug,
                  conceptId: item.conceptId,
                  sourceNoteId: item.id,
                })
              }
            />
            <OpenLink topicSlug={item.topicSlug} conceptId={item.conceptId} label={t('open')} />
            <IconButton
              label={t('remove')}
              tone="danger"
              onClick={() => void saveConceptNote(item.topicSlug, item.conceptId, '')}
            >
              <Trash2 size={15} />
            </IconButton>
          </div>
        </div>
      </Surface>
    </li>
  );
};

interface BookmarkCardProps {
  item: BookmarkRecord;
  titles: ResolvedTitles;
}

const BookmarkCard = ({ item, titles }: BookmarkCardProps) => {
  const { t } = useTranslation('library');
  return (
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
            <TagsRow tags={item.tags} onChange={(tags) => void setBookmarkTags(item.id, tags)} />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <OpenLink topicSlug={item.topicSlug} conceptId={item.conceptId} label={t('open')} />
            <IconButton
              label={t('remove')}
              tone="danger"
              onClick={() => void setBookmark(item.topicSlug, item.conceptId, false)}
            >
              <Trash2 size={15} />
            </IconButton>
          </div>
        </div>
      </Surface>
    </li>
  );
};

interface UserCardItemProps {
  item: UserCardRecord;
  titles: ResolvedTitles;
}

const UserCardItem = ({ item, titles }: UserCardItemProps) => {
  const { t } = useTranslation('library');
  return (
    <li>
      <Surface variant="chrome" className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-start gap-2">
              <Layers size={16} className="mt-0.5 shrink-0 text-accent" />
              <p className="text-sm font-medium text-fg">{item.front}</p>
            </div>
            <p className="line-clamp-3 pl-6 text-[13px] text-fg-muted whitespace-pre-wrap">
              {item.back}
            </p>
            <div className="pl-6">
              <MetaLine conceptTitle={t('cardMeta')} topicTitle={titles.topicTitle} />
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <IconButton
              label={t('remove')}
              tone="danger"
              onClick={() => void deleteUserCard(item.id)}
            >
              <Trash2 size={15} />
            </IconButton>
          </div>
        </div>
      </Surface>
    </li>
  );
};

interface FlashcardDraftDialogProps {
  draft: FlashcardDraft | null;
  onClose: () => void;
  onSave: (input: FlashcardDraft) => void | Promise<void>;
}

const FlashcardDraftDialog = ({ draft, onClose, onSave }: FlashcardDraftDialogProps) => {
  const { t } = useTranslation('library');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [seeded, setSeeded] = useState<string | null>(null);

  const draftKey = draft ? `${draft.sourceNoteId ?? ''}|${draft.sourceHighlightId ?? ''}|${draft.topicSlug}` : null;
  if (draft && draftKey !== seeded) {
    setFront(draft.front);
    setBack(draft.back);
    setSeeded(draftKey);
  }

  const canSave = front.trim().length > 0 && back.trim().length > 0;

  return (
    <Dialog
      open={draft !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
          setSeeded(null);
        }
      }}
      title={t('makeCard.title')}
      description={t('makeCard.description')}
      placement="sheet"
      footer={
        <>
          <Button variant="ghost" size="md" onClick={onClose}>
            {t('makeCard.cancel')}
          </Button>
          <Button
            variant="primary"
            size="md"
            disabled={!canSave}
            leadingIcon={<Sparkles size={15} />}
            onClick={() => {
              if (!draft || !canSave) return;
              void onSave({ ...draft, front: front.trim(), back: back.trim() });
              setSeeded(null);
            }}
          >
            {t('makeCard.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-[13px] font-medium text-fg">{t('makeCard.frontLabel')}</span>
          <input
            value={front}
            onChange={(event) => setFront(event.target.value)}
            placeholder={t('makeCard.frontPlaceholder')}
            className="form-input w-full"
            aria-label={t('makeCard.frontLabel')}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-[13px] font-medium text-fg">{t('makeCard.backLabel')}</span>
          <textarea
            value={back}
            onChange={(event) => setBack(event.target.value)}
            rows={5}
            className="form-input w-full resize-y"
            aria-label={t('makeCard.backLabel')}
          />
        </label>
      </div>
    </Dialog>
  );
};
