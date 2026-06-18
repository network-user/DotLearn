import { useMemo, useState } from 'react';

import { Link } from '@tanstack/react-router';
import { ArrowRight, BookA, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/EmptyState';
import { Surface } from '@/components/ui/Surface';
import { GLOSSARY, type GlossaryEntry } from '@/lib/glossary';
import { getCurrentLanguage } from '@/lib/i18n';
import { useVisibleManifests } from '@/lib/use-manifests';

interface GlossaryGroup {
  key: string;
  title: string;
  topicSlug?: string;
  entries: GlossaryEntry[];
}

const matches = (query: string, ...values: string[]): boolean => {
  if (query.length === 0) return true;
  const needle = query.toLowerCase();
  return values.some((value) => value.toLowerCase().includes(needle));
};

export const GlossaryPage = () => {
  const { t } = useTranslation('glossary');
  const language = getCurrentLanguage();
  const manifests = useVisibleManifests();
  const [query, setQuery] = useState('');

  const titleOf = useMemo(() => {
    const map = new Map(manifests.map((manifest) => [manifest.slug, manifest.title]));
    return (slug: string): string => map.get(slug) ?? slug;
  }, [manifests]);

  const trimmed = query.trim();

  const groups = useMemo<GlossaryGroup[]>(() => {
    const filtered = GLOSSARY.filter((entry) =>
      matches(trimmed, entry.term.ru, entry.term.en, entry.def.ru, entry.def.en),
    );
    const byTopic = new Map<string, GlossaryEntry[]>();
    for (const entry of filtered) {
      const key = entry.topicSlug ?? '';
      const bucket = byTopic.get(key) ?? [];
      bucket.push(entry);
      byTopic.set(key, bucket);
    }
    const collator = new Intl.Collator(language);
    const result: GlossaryGroup[] = [];
    for (const [key, entries] of byTopic.entries()) {
      entries.sort((a, b) => collator.compare(a.term[language], b.term[language]));
      result.push({
        key: key || 'general',
        title: key ? titleOf(key) : t('generalGroup'),
        ...(key ? { topicSlug: key } : {}),
        entries,
      });
    }
    return result.sort((a, b) => {
      if (!a.topicSlug) return 1;
      if (!b.topicSlug) return -1;
      return collator.compare(a.title, b.title);
    });
  }, [trimmed, language, titleOf, t]);

  const totalMatches = groups.reduce((sum, group) => sum + group.entries.length, 0);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 eyebrow text-fg-subtle">
          <BookA size={12} className="text-accent" />
          <span>{t('eyebrow')}</span>
        </div>
        <h1 className="font-display text-3xl tracking-tightish text-fg">{t('title')}</h1>
        <p className="max-w-prose text-sm text-fg-muted">{t('subtitle')}</p>
      </header>

      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
          className="form-input w-full pl-9"
        />
      </div>

      {totalMatches === 0 ? (
        <EmptyState
          icon={<Search size={22} className="text-fg-subtle" />}
          title={t('emptyTitle')}
          body={t('emptyBody')}
        />
      ) : (
        <div className="space-y-10">
          {groups.map((group) => (
            <section key={group.key} className="space-y-4">
              <div className="flex items-center justify-between gap-3 border-b-2 border-fg/80 pb-2">
                <h2 className="font-display text-lg tracking-tightish text-fg">{group.title}</h2>
                {group.topicSlug ? (
                  <Link
                    to="/topics/$slug"
                    params={{ slug: group.topicSlug }}
                    className="inline-flex items-center gap-1 text-[12px] text-accent underline decoration-accent/40 underline-offset-2 transition-colors hover:decoration-accent"
                  >
                    {t('openTopic')}
                    <ArrowRight size={12} aria-hidden />
                  </Link>
                ) : null}
              </div>
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {group.entries.map((entry) => (
                  <Surface key={entry.id} variant="chrome" className="p-4">
                    <dt className="flex items-baseline justify-between gap-2">
                      <span className="font-display text-[15px] font-semibold text-fg">
                        {entry.term[language]}
                      </span>
                      {entry.topicSlug ? (
                        <Link
                          to="/topics/$slug"
                          params={{ slug: entry.topicSlug }}
                          aria-label={t('openSource', { term: entry.term[language] })}
                          className="shrink-0 text-fg-subtle transition-colors hover:text-accent"
                        >
                          <ArrowRight size={14} aria-hidden />
                        </Link>
                      ) : null}
                    </dt>
                    <dd className="mt-1.5 text-[13.5px] leading-relaxed text-fg-muted">
                      {entry.def[language]}
                    </dd>
                  </Surface>
                ))}
              </dl>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
