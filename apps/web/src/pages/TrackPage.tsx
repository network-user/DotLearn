import { useMemo } from 'react';

import type { TopicManifest } from '@dotlearn/contracts';
import { Link, useParams } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, ArrowRight, Check, Lock, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { DualProgressBar } from '@/components/ui/DualProgressBar';
import { DualProgressRing } from '@/components/ui/DualProgressRing';
import { EmptyState } from '@/components/ui/EmptyState';
import { Surface } from '@/components/ui/Surface';
import { getCurrentLanguage } from '@/lib/i18n';
import { computeMastery, countReadConcepts, useReadConceptsByTopic } from '@/lib/mastery';
import { db } from '@/lib/progress-db';
import { effectiveLanguage, prefetchTopic } from '@/lib/topics';
import { getTrack, trackMemberSlugs } from '@/lib/tracks';
import { useVisibleManifests } from '@/lib/use-manifests';
import topicStats from 'virtual:topic-stats';

const DIFFICULTY_TONE: Record<string, 'success' | 'warning' | 'danger'> = {
  beginner: 'success',
  intermediate: 'warning',
  advanced: 'danger',
};

interface TrackStep {
  manifest: TopicManifest;
  optional: boolean;
  readingRatio: number;
  solvingRatio: number;
  mastery: number;
  mastered: boolean;
}

export const TrackPage = () => {
  const { id } = useParams({ from: '/tracks/$id' });
  const { t } = useTranslation('tracks');
  const track = getTrack(id);
  const manifests = useVisibleManifests();
  const progressRecords = useLiveQuery(() => db.progress.toArray(), [], []);
  const readByTopic = useReadConceptsByTopic();
  const language = getCurrentLanguage();

  const steps = useMemo<TrackStep[]>(() => {
    if (!track) return [];
    const bySlug = new Map<string, TopicManifest>();
    for (const manifest of manifests) bySlug.set(manifest.slug, manifest);
    const optionalSet = new Set(track.optionalSlugs ?? []);

    const passedByTopic = new Map<string, number>();
    for (const record of progressRecords ?? []) {
      if (record.status === 'pass') {
        passedByTopic.set(record.topicSlug, (passedByTopic.get(record.topicSlug) ?? 0) + 1);
      }
    }

    return trackMemberSlugs(track)
      .map((slug) => {
        const manifest = bySlug.get(slug);
        if (!manifest) return undefined;
        const total = topicStats[slug]?.[effectiveLanguage(manifest, language)] ?? 0;
        const mastery = computeMastery(
          countReadConcepts(manifest.concepts, readByTopic.get(slug)),
          manifest.concepts.length,
          passedByTopic.get(slug) ?? 0,
          total,
        );
        return {
          manifest,
          optional: optionalSet.has(slug),
          readingRatio: mastery.readingRatio,
          solvingRatio: mastery.solvingRatio,
          mastery: mastery.mastery,
          mastered: mastery.mastery >= 0.999,
        };
      })
      .filter((step): step is TrackStep => step !== undefined);
  }, [track, manifests, progressRecords, readByTopic, language]);

  const aggregate = useMemo(() => {
    if (steps.length === 0) return { reading: 0, solving: 0, mastery: 0 };
    const reading = steps.reduce((sum, step) => sum + step.readingRatio, 0) / steps.length;
    const solving = steps.reduce((sum, step) => sum + step.solvingRatio, 0) / steps.length;
    const mastery = steps.reduce((sum, step) => sum + step.mastery, 0) / steps.length;
    return { reading, solving, mastery };
  }, [steps]);

  const nextStep = useMemo(
    () => steps.find((step) => !step.optional && !step.mastered) ?? steps.find((step) => !step.mastered),
    [steps],
  );

  if (!track) {
    return (
      <Surface rule="left" className="border-l-err">
        <div className="p-6">
          <h1 className="font-display text-2xl text-err">{t('notFound.title')}</h1>
          <p className="mt-2 text-sm text-fg-muted">{t('notFound.body')}</p>
          <Link to="/tracks">
            <Button variant="ghost" leadingIcon={<ArrowLeft size={14} />} className="mt-4">
              {t('notFound.back')}
            </Button>
          </Link>
        </div>
      </Surface>
    );
  }

  const masteredCount = steps.filter((step) => step.mastered).length;
  const percent = Math.round(aggregate.mastery * 100);

  return (
    <div className="space-y-8">
      <div>
        <Link
          to="/tracks"
          className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg transition-colors"
        >
          <ArrowLeft size={14} />
          {t('backToTracks')}
        </Link>
      </div>

      <header className="space-y-4 border-y border-border-base py-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 space-y-2">
            {track.targetRole && (
              <div className="eyebrow text-[10px] text-accent">{track.targetRole}</div>
            )}
            <h1 className="font-display font-medium text-[clamp(28px,4vw,44px)] leading-tight tracking-tightish text-fg">
              {track.title}
            </h1>
            <p className="max-w-prose text-sm text-fg-muted">{track.description}</p>
          </div>
          <DualProgressRing
            reading={aggregate.reading}
            solving={aggregate.solving}
            size={72}
            stroke={4}
            gap={3}
            label={
              <span className="tabular-nums text-[13px] font-display">
                {percent}
                <span className="text-[9px] text-fg-subtle">%</span>
              </span>
            }
            ariaLabel={t('progress.aria', { percent })}
          />
        </div>
        <DualProgressBar
          reading={aggregate.reading}
          solving={aggregate.solving}
          ariaLabel={t('progress.aria', { percent })}
        />
        <p className="text-xs text-fg-subtle tabular-nums">
          {t('progress.summary', {
            mastered: masteredCount,
            total: steps.length,
            percent,
          })}
        </p>
        {nextStep && (
          <Link
            to="/topics/$slug"
            params={{ slug: nextStep.manifest.slug }}
            onMouseEnter={() => prefetchTopic(nextStep.manifest.slug)}
            onFocus={() => prefetchTopic(nextStep.manifest.slug)}
            className="inline-block w-full sm:w-auto"
          >
            <Button
              variant="primary"
              size="md"
              className="w-full min-h-[var(--tap)] sm:min-h-0 sm:w-auto"
              leadingIcon={<Sparkles size={15} />}
              trailingIcon={<ArrowRight size={15} />}
            >
              {t('nextTopic', { title: nextStep.manifest.title })}
            </Button>
          </Link>
        )}
      </header>

      {steps.length === 0 ? (
        <EmptyState
          icon={<Lock size={22} className="text-fg-subtle" />}
          title={t('empty.title')}
          body={t('empty.body')}
        />
      ) : (
        <ol className="space-y-3">
          {steps.map((step, index) => {
            const previousRequired = steps
              .slice(0, index)
              .filter((entry) => !entry.optional);
            const locked = !step.optional && previousRequired.some((entry) => !entry.mastered);
            const isNext = nextStep?.manifest.slug === step.manifest.slug;
            return (
              <li key={step.manifest.slug}>
                <Link
                  to="/topics/$slug"
                  params={{ slug: step.manifest.slug }}
                  onMouseEnter={() => prefetchTopic(step.manifest.slug)}
                  onFocus={() => prefetchTopic(step.manifest.slug)}
                  className="group block"
                >
                  <Surface
                    interactive
                    className={cx(isNext && 'border-accent ring-2 ring-accent/30')}
                  >
                    <div className="flex items-center gap-4 p-4">
                      <span
                        className={cx(
                          'grid size-9 shrink-0 place-items-center rounded-full text-[13px] font-semibold tabular-nums',
                          step.mastered
                            ? 'bg-ok/[0.1] text-ok'
                            : isNext
                              ? 'bg-accent/[0.1] text-accent'
                              : 'bg-surface-2 text-fg-muted',
                        )}
                      >
                        {step.mastered ? <Check size={16} /> : index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate font-medium text-fg">{step.manifest.title}</h3>
                          {locked && (
                            <Lock size={13} className="shrink-0 text-warn" aria-label={t('locked')} />
                          )}
                        </div>
                        <DualProgressBar
                          reading={step.readingRatio}
                          solving={step.solvingRatio}
                          className="mt-2"
                          ariaLabel={t('progress.aria', {
                            percent: Math.round(step.mastery * 100),
                          })}
                        />
                      </div>
                      <div className="hidden shrink-0 items-center gap-2 sm:flex">
                        <Badge
                          tone={DIFFICULTY_TONE[step.manifest.difficulty] ?? 'neutral'}
                          variant="soft"
                        >
                          {step.manifest.difficulty}
                        </Badge>
                        {step.optional && (
                          <Badge tone="neutral" variant="outline">
                            {t('optional')}
                          </Badge>
                        )}
                      </div>
                      <ArrowRight
                        size={16}
                        className="shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
                      />
                    </div>
                  </Surface>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
};
