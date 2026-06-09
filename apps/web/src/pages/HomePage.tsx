import { useEffect, useMemo, useState } from 'react';

import type { TopicManifest } from '@dotlearn/contracts';
import type { TopicBundle } from '@dotlearn/lesson-engine';
import { Link } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight,
  ArrowUpRight,
  Code2,
  Database,
  FileText,
  FlaskConical,
  Sparkles,
} from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';

import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { GlassSurface } from '@/components/ui/GlassSurface';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Skeleton } from '@/components/ui/Skeleton';
import { getCurrentLanguage } from '@/lib/i18n';
import { db } from '@/lib/progress-db';
import { listManifests, loadTopic } from '@/lib/topics';

interface TopicRow {
  manifest: TopicManifest;
  total: number;
  passed: number;
}

type DifficultyFilter = 'all' | 'beginner' | 'intermediate' | 'advanced';

const DIFFICULTY_TONE: Record<string, 'success' | 'warning' | 'danger'> = {
  beginner: 'success',
  intermediate: 'warning',
  advanced: 'danger',
};

const runtimeIcon = (runtime: string) => {
  if (runtime === 'sql.js') return <Database size={14} />;
  if (runtime === 'pyodide') return <FlaskConical size={14} />;
  if (runtime === 'javascript') return <Code2 size={14} />;
  return <FileText size={14} />;
};

export const HomePage = () => {
  const { t, i18n } = useTranslation('home');
  const { t: tCommon } = useTranslation('common');
  const [bundles, setBundles] = useState<TopicBundle[] | undefined>(undefined);
  const progressRecords = useLiveQuery(() => db.progress.toArray(), [], []);
  const [filter, setFilter] = useState<DifficultyFilter>('all');

  useEffect(() => {
    let cancelled = false;
    const language = getCurrentLanguage();
    listManifests()
      .then((manifests) =>
        Promise.all(manifests.map((manifest) => loadTopic(manifest.slug, language))),
      )
      .then((loaded) => {
        if (!cancelled) {
          setBundles(loaded);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [i18n.resolvedLanguage]);

  const rows = useMemo<TopicRow[]>(() => {
    if (!bundles) return [];
    const passedByTopic = new Map<string, number>();
    for (const record of progressRecords ?? []) {
      if (record.status === 'pass') {
        passedByTopic.set(record.topicSlug, (passedByTopic.get(record.topicSlug) ?? 0) + 1);
      }
    }
    return bundles.map((bundle) => ({
      manifest: bundle.manifest,
      total: bundle.concepts.reduce(
        (sum, concept) => sum + concept.exercises.reduce((s, file) => s + file.exercises.length, 0),
        0,
      ),
      passed: passedByTopic.get(bundle.manifest.slug) ?? 0,
    }));
  }, [bundles, progressRecords]);

  const filteredRows = useMemo(() => {
    if (filter === 'all') return rows;
    return rows.filter((row) => row.manifest.difficulty === filter);
  }, [rows, filter]);

  const totalConcepts = rows.reduce((sum, row) => sum + row.manifest.concepts.length, 0);
  const runtimes = new Set(rows.map((row) => row.manifest.runtime));

  return (
    <div className="space-y-14">
      <Hero stats={{ topics: rows.length, concepts: totalConcepts, runtimes: runtimes.size }} />

      <section className="space-y-5" id="topics">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tightish">{t('topicsHeading')}</h2>
            <p className="mt-1 text-sm text-fg-muted">
              {bundles === undefined
                ? tCommon('loading')
                : t('available', { count: filteredRows.length })}
            </p>
          </div>
          <FilterBar value={filter} onChange={setFilter} />
        </div>

        {bundles === undefined ? (
          <SkeletonGrid />
        ) : rows.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger">
            {filteredRows.map((row) => (
              <li key={row.manifest.slug}>
                <TopicCard row={row} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

interface HeroStats {
  topics: number;
  concepts: number;
  runtimes: number;
}

const heroRise = (reduceMotion: boolean, delay: number) =>
  reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 18, filter: 'blur(6px)' },
        animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
        transition: { delay, duration: 0.55, ease: [0.22, 1, 0.36, 1] as const },
      };

const Hero = ({ stats }: { stats: HeroStats }) => {
  const { t } = useTranslation('home');
  const reduceMotion = useReducedMotion() ?? false;
  const scrollToTopics = (): void => {
    const el = document.querySelector('#topics');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <section className="relative pt-2">
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-6 items-stretch">
        <div className="space-y-6">
          <motion.div
            {...heroRise(reduceMotion, 0)}
            className="inline-flex items-center gap-2 rounded-pill border border-border-base bg-surface/40 px-3 py-1 text-[11px] uppercase tracking-widest text-fg-subtle"
          >
            <Sparkles size={12} className="text-accent" />
            <span>{t('eyebrow')}</span>
          </motion.div>
          <h1 className="font-display text-[clamp(40px,7vw,72px)] leading-[1.02] tracking-display text-balance">
            <motion.span {...heroRise(reduceMotion, 0.08)} className="block">
              {t('heroLineA')}
            </motion.span>
            <motion.span
              {...heroRise(reduceMotion, 0.18)}
              className="block bg-gradient-to-r from-accent via-accent-2 to-accent-3 bg-clip-text text-transparent italic"
            >
              {t('heroLineB')}
            </motion.span>
          </h1>
          <motion.p
            {...heroRise(reduceMotion, 0.28)}
            className="max-w-prose text-[15px] leading-relaxed text-fg-muted text-balance"
          >
            {t('heroSub')}
          </motion.p>
          <motion.div
            {...heroRise(reduceMotion, 0.36)}
            className="flex flex-wrap items-center gap-2 pt-1"
          >
            <Button
              variant="primary"
              size="lg"
              trailingIcon={<ArrowRight size={16} />}
              onClick={scrollToTopics}
            >
              {t('cta.explore')}
            </Button>
            <Link to="/submit">
              <Button variant="glass" size="lg" trailingIcon={<ArrowUpRight size={16} />}>
                {t('cta.submit')}
              </Button>
            </Link>
          </motion.div>
        </div>

        <motion.div {...heroRise(reduceMotion, 0.22)} className="h-full">
          <HeroSidePanel stats={stats} />
        </motion.div>
      </div>
    </section>
  );
};

const HeroSidePanel = ({ stats }: { stats: HeroStats }) => {
  const { t } = useTranslation('home');
  return (
    <GlassSurface
      intensity="strong"
      tint="accent"
      noiseOverlay
      className="relative overflow-hidden rounded-3xl h-full"
    >
      <div className="p-6 flex flex-col h-full justify-between gap-6 min-h-[260px]">
        <p className="text-[13px] leading-relaxed text-fg-muted">
          <Trans
            i18nKey="home:intro"
            components={{ code: <code className="font-mono text-accent" /> }}
          />
        </p>
        <dl className="grid grid-cols-3 gap-3">
          <Stat value={stats.topics} label={t('stats.topics')} />
          <Stat value={stats.concepts} label={t('stats.concepts')} />
          <Stat value={stats.runtimes} label={t('stats.runtimes')} />
        </dl>
      </div>
    </GlassSurface>
  );
};

const Stat = ({ value, label }: { value: number; label: string }) => (
  <div>
    <div className="font-display text-3xl leading-none text-fg tabular-nums">
      <AnimatedNumber value={value} />
    </div>
    <div className="mt-1 text-[10px] uppercase tracking-widest text-fg-subtle">{label}</div>
  </div>
);

const FilterBar = ({
  value,
  onChange,
}: {
  value: DifficultyFilter;
  onChange: (v: DifficultyFilter) => void;
}) => {
  const { t } = useTranslation('home');
  const options: DifficultyFilter[] = ['all', 'beginner', 'intermediate', 'advanced'];
  return (
    <div className="inline-flex items-center gap-1 rounded-pill border border-border-base bg-surface/40 p-1 backdrop-blur-soft">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={cx(
            'h-7 px-3 rounded-pill text-[12px] tracking-snug transition-colors duration-fast',
            value === option
              ? 'bg-surface shadow-card text-fg'
              : 'text-fg-muted hover:text-fg',
          )}
        >
          {t(`filters.${option}` as const)}
        </button>
      ))}
    </div>
  );
};

interface TopicCardProps {
  row: TopicRow;
}

const TopicCard = ({ row }: TopicCardProps) => {
  const { t } = useTranslation('home');
  const { manifest, total, passed } = row;
  const percent = total === 0 ? 0 : passed / total;
  const totalMinutes = manifest.concepts.reduce((sum, c) => sum + c.estimatedMinutes, 0);
  const availableLanguages = getAvailableLanguages(manifest);
  const taglineKey = `card.tagline.${manifest.runtime}` as const;
  return (
    <Link to="/topics/$slug" params={{ slug: manifest.slug }} className="block group h-full">
      <GlassSurface
        intensity="medium"
        interactive
        bordered
        className="h-full rounded-2xl"
      >
        <div className="p-5 h-full flex flex-col gap-4 min-h-[200px]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-fg-subtle">
                {runtimeIcon(manifest.runtime)}
                <span>{t(taglineKey)}</span>
              </div>
              <h3 className="mt-2 font-display text-2xl leading-tight tracking-tightish text-fg truncate">
                {manifest.title}
              </h3>
            </div>
            <ProgressRing
              value={percent}
              size={48}
              stroke={4}
              indicatorClassName={
                percent === 1 ? 'text-emerald-400' : percent > 0 ? 'text-accent' : 'text-fg-subtle'
              }
              label={
                <span className="tabular-nums">
                  {Math.round(percent * 100)}
                  <span className="text-[8px] text-fg-subtle">%</span>
                </span>
              }
              ariaLabel={`${Math.round(percent * 100)}%`}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <Stat3 label={t('stats.concepts')} value={manifest.concepts.length} />
            <Stat3
              label="min"
              value={totalMinutes}
              formatter={(v) => t('card.minutes', { count: v })}
            />
            <Stat3 label="ex." value={total} formatter={(v) => `${passed}/${v}`} />
          </div>

          <div className="mt-auto pt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge tone={DIFFICULTY_TONE[manifest.difficulty] ?? 'neutral'} variant="soft">
                {manifest.difficulty}
              </Badge>
              {availableLanguages.map((lang) => (
                <Badge key={lang} tone="neutral" variant="outline">
                  {t(`languageBadge.${lang}`)}
                </Badge>
              ))}
            </div>
            <span className="opacity-0 -translate-x-1 transition-all duration-fast group-hover:opacity-100 group-hover:translate-x-0">
              <ArrowRight size={16} className="text-accent" />
            </span>
          </div>
        </div>
      </GlassSurface>
    </Link>
  );
};

const Stat3 = ({
  label,
  value,
  formatter,
}: {
  label: string;
  value: number;
  formatter?: (v: number) => string;
}) => (
  <div className="rounded-md bg-surface-2/40 px-2 py-1.5">
    <div className="text-[10px] uppercase tracking-widest text-fg-subtle">{label}</div>
    <div className="text-[13px] font-medium tabular-nums text-fg">
      {formatter ? formatter(value) : value}
    </div>
  </div>
);

const SkeletonGrid = () => (
  <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" aria-hidden>
    {[0, 1, 2].map((index) => (
      <li key={index}>
        <Skeleton rounded="2xl" className="h-48" />
      </li>
    ))}
  </ul>
);

const EmptyState = () => {
  const { t } = useTranslation('home');
  return (
    <GlassSurface intensity="subtle" bordered className="rounded-2xl">
      <div className="p-8 text-center">
        <h3 className="font-display text-2xl text-fg">{t('empty.title')}</h3>
        <p className="mt-2 text-sm text-fg-muted">
          <Trans
            i18nKey="home:empty.hint"
            components={{ hint: <span className="text-accent" /> }}
          />
        </p>
      </div>
    </GlassSurface>
  );
};

const getAvailableLanguages = (manifest: TopicManifest): readonly ('ru' | 'en')[] =>
  manifest.availableLanguages;
