import { useEffect, useMemo, useRef, useState } from 'react';

import type { InterviewQuestionMeta } from '@dotlearn/contracts';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { BookOpen, FileText, LayoutGrid, MessagesSquare, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/EmptyState';
import { Kbd } from '@/components/ui/Kbd';
import { cx } from '@/components/ui/cx';
import {
  MIN_SEARCH_QUERY_LENGTH,
  loadSearchEntries,
  searchContentEntries,
  searchInterviewEntries,
  searchLanguageOf,
  type SearchEntry,
  type SearchSnippet,
} from '@/lib/content-search';
import { getCurrentLanguage } from '@/lib/i18n';
import { Seo } from '@/lib/seo';
import { conceptTitle, topicTitle } from '@/lib/topics';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { useVisibleManifests } from '@/lib/use-manifests';

const TOPIC_LIMIT = 10;
const CONCEPT_LIMIT = 12;
const CONTENT_LIMIT = 20;
const INTERVIEW_LIMIT = 10;

type SearchResult =
  | { kind: 'topic'; key: string; title: string; meta: string; slug: string }
  | { kind: 'concept'; key: string; title: string; meta: string; slug: string; conceptId: string }
  | {
      kind: 'content';
      key: string;
      title: string;
      meta: string;
      slug: string;
      conceptId: string;
      snippet: SearchSnippet;
    }
  | { kind: 'interview'; key: string; title: string; meta: string; id: number };

interface ResultGroup {
  kind: SearchResult['kind'];
  heading: string;
  results: SearchResult[];
}

const groupIcon: Record<SearchResult['kind'], React.ReactNode> = {
  topic: <LayoutGrid size={15} />,
  concept: <BookOpen size={15} />,
  content: <FileText size={15} />,
  interview: <MessagesSquare size={15} />,
};

const HighlightedText = ({ text, query }: { text: string; query: string }) => {
  const q = query.trim().toLowerCase();
  const index = q.length === 0 ? -1 : text.toLowerCase().indexOf(q);
  if (index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <span className="text-accent">{text.slice(index, index + q.length)}</span>
      {text.slice(index + q.length)}
    </>
  );
};

export const SearchPage = () => {
  const { t, i18n } = useTranslation('search');
  const { t: tNav } = useTranslation('nav');
  const search = useSearch({ from: '/search' });
  const navigate = useNavigate();
  const manifests = useVisibleManifests();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [input, setInput] = useState(search.q ?? '');
  const [entries, setEntries] = useState<SearchEntry[]>([]);
  const [interview, setInterview] = useState<InterviewQuestionMeta[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const language = searchLanguageOf(i18n.resolvedLanguage);
  const uiLanguage = getCurrentLanguage();
  const debouncedInput = useDebouncedValue(input, 250);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(min-width: 768px)').matches) {
      inputRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadSearchEntries(language).then((loaded) => {
      if (!cancelled) setEntries(loaded);
    });
    void import('@/lib/interview').then((module) => {
      if (!cancelled) setInterview(module.getInterviewIndex());
    });
    return () => {
      cancelled = true;
    };
  }, [language]);

  useEffect(() => {
    const next = debouncedInput.trim();
    void navigate({
      to: '/search',
      search: next.length > 0 ? { q: next } : {},
      replace: true,
    });
  }, [debouncedInput, navigate]);

  useEffect(() => {
    if (document.activeElement === inputRef.current) return;
    setInput(search.q ?? '');
  }, [search.q]);

  const query = (search.q ?? '').trim();
  const q = query.toLowerCase();
  const queryReady = q.length >= MIN_SEARCH_QUERY_LENGTH;

  const groups = useMemo<ResultGroup[]>(() => {
    if (!queryReady) return [];
    const list: ResultGroup[] = [];

    const topics: SearchResult[] = [];
    for (const manifest of manifests) {
      const haystack =
        `${manifest.title} ${manifest.titleEn ?? ''} ${manifest.tags.join(' ')} ${manifest.slug}`.toLowerCase();
      if (!haystack.includes(q)) continue;
      topics.push({
        kind: 'topic',
        key: `topic-${manifest.slug}`,
        title: topicTitle(manifest, uiLanguage),
        meta: `${manifest.concepts.length} · ${manifest.difficulty}`,
        slug: manifest.slug,
      });
      if (topics.length >= TOPIC_LIMIT) break;
    }
    if (topics.length > 0) {
      list.push({ kind: 'topic', heading: tNav('groups.topics'), results: topics });
    }

    const concepts: SearchResult[] = [];
    for (const manifest of manifests) {
      for (const concept of manifest.concepts) {
        if (
          !concept.title.toLowerCase().includes(q) &&
          !(concept.titleEn?.toLowerCase().includes(q) ?? false)
        )
          continue;
        concepts.push({
          kind: 'concept',
          key: `concept-${manifest.slug}-${concept.id}`,
          title: conceptTitle(concept, uiLanguage),
          meta: topicTitle(manifest, uiLanguage),
          slug: manifest.slug,
          conceptId: concept.id,
        });
        if (concepts.length >= CONCEPT_LIMIT) break;
      }
      if (concepts.length >= CONCEPT_LIMIT) break;
    }
    if (concepts.length > 0) {
      list.push({ kind: 'concept', heading: tNav('groups.concepts'), results: concepts });
    }

    const content = searchContentEntries(entries, query, CONTENT_LIMIT).map(
      (match): SearchResult => ({
        kind: 'content',
        key: `content-${match.key}`,
        title: match.conceptTitle,
        meta: match.topicTitle,
        slug: match.slug,
        conceptId: match.conceptId,
        snippet: { before: match.before, hit: match.hit, after: match.after },
      }),
    );
    if (content.length > 0) {
      list.push({ kind: 'content', heading: tNav('groups.content'), results: content });
    }

    const interviewResults = searchInterviewEntries(interview, query, INTERVIEW_LIMIT).map(
      (item): SearchResult => ({
        kind: 'interview',
        key: `interview-${item.id}`,
        title: item.title,
        meta: item.categoryLabel,
        id: item.id,
      }),
    );
    if (interviewResults.length > 0) {
      list.push({
        kind: 'interview',
        heading: tNav('groups.interview'),
        results: interviewResults,
      });
    }

    return list;
  }, [queryReady, manifests, entries, interview, q, query, tNav, uiLanguage]);

  const flatResults = useMemo(() => groups.flatMap((group) => group.results), [groups]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (flatResults.length === 0) return;
    document.getElementById(`search-result-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, flatResults.length]);

  const openResult = (result: SearchResult): void => {
    if (result.kind === 'topic') {
      void navigate({ to: '/topics/$slug', params: { slug: result.slug } });
      return;
    }
    if (result.kind === 'interview') {
      void navigate({ to: '/interview/$id', params: { id: String(result.id) } });
      return;
    }
    void navigate({
      to: '/topics/$slug',
      params: { slug: result.slug },
      search: { concept: result.conceptId },
    });
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (flatResults.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((value) => Math.min(value + 1, flatResults.length - 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((value) => Math.max(value - 1, 0));
      return;
    }
    if (event.key === 'Enter') {
      const active = flatResults[activeIndex];
      if (active) {
        event.preventDefault();
        openResult(active);
      }
    }
  };

  let flatIndex = -1;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Seo robots="noindex,nofollow" title={t('title')} />
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-2 text-sm text-fg-muted">{t('subtitle')}</p>
      </header>

      <div className="relative">
        <Search
          size={16}
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-fg-subtle"
        />
        <input
          ref={inputRef}
          type="search"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={onInputKeyDown}
          placeholder={t('placeholder')}
          aria-label={t('title')}
          role="combobox"
          aria-expanded={flatResults.length > 0}
          aria-controls="search-results"
          aria-activedescendant={
            flatResults.length > 0 ? `search-result-${activeIndex}` : undefined
          }
          className="form-input w-full pl-10"
        />
      </div>

      <div className="hidden items-center gap-1.5 text-[11px] text-fg-subtle md:flex">
        <Kbd>↑</Kbd>
        <Kbd>↓</Kbd>
        <span>{t('keys.nav')}</span>
        <Kbd>↵</Kbd>
        <span>{t('keys.open')}</span>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {queryReady ? tNav('resultCount', { count: flatResults.length }) : ''}
      </p>

      {!queryReady ? (
        <EmptyState
          icon={<Search size={22} className="text-fg-subtle" />}
          title={t('empty.initialTitle')}
          body={t('empty.initialBody')}
        />
      ) : flatResults.length === 0 ? (
        <EmptyState
          icon={<Search size={22} className="text-fg-subtle" />}
          title={t('empty.noResultsTitle')}
          body={t('empty.noResultsBody')}
        />
      ) : (
        <div id="search-results" role="listbox" aria-label={t('title')} className="space-y-6">
          {groups.map((group) => (
            <div key={group.kind} role="group" aria-label={group.heading}>
              <div aria-hidden className="eyebrow eyebrow-accent mb-2">
                {group.heading}
              </div>
              <ul className="space-y-1" role="presentation">
                {group.results.map((result) => {
                  flatIndex += 1;
                  const index = flatIndex;
                  const active = index === activeIndex;
                  return (
                    <li key={result.key} role="presentation">
                      <button
                        type="button"
                        id={`search-result-${index}`}
                        role="option"
                        aria-selected={active}
                        onClick={() => openResult(result)}
                        className={cx(
                          'flex w-full items-start gap-3 rounded-lg px-3 py-2.5 min-h-[var(--tap)] text-left transition-colors',
                          active
                            ? 'bg-accent/10 text-fg'
                            : 'text-fg-muted hover:bg-surface-2/50 hover:text-fg',
                        )}
                      >
                        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-2/60 text-fg-subtle">
                          {groupIcon[result.kind]}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-3">
                            <span className="truncate text-[14px] font-medium">
                              <HighlightedText text={result.title} query={query} />
                            </span>
                            <span className="shrink-0 text-[11px] text-fg-subtle">
                              {result.meta}
                            </span>
                          </span>
                          {result.kind === 'content' ? (
                            <span className="mt-0.5 block text-[12.5px] leading-snug text-fg-subtle line-clamp-2">
                              {result.snippet.before}
                              {result.snippet.hit ? (
                                <span className="text-accent">{result.snippet.hit}</span>
                              ) : null}
                              {result.snippet.after}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
