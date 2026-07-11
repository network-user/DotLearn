import { useMemo } from 'react';

import { Link } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight, BookOpen, History, RotateCcw, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { Surface } from '@/components/ui/Surface';
import { getCurrentLanguage } from '@/lib/i18n';
import { countReadConcepts, useReadConceptsByTopic } from '@/lib/mastery';
import {
  resolveNextAction,
  type NextAction,
  type NextActionKind,
  type NextActionTopicInput,
} from '@/lib/next-action';
import { db, type ProgressRecord } from '@/lib/progress-db';
import { useRecallByTopic } from '@/lib/retention';
import { effectiveLanguage } from '@/lib/topics';
import { useLastPlace } from '@/lib/use-learning';
import { useVisibleManifests } from '@/lib/use-manifests';
import topicStats from 'virtual:topic-stats';

interface NextActionData {
  progressRecords: ProgressRecord[];
  readByTopic: Map<string, Set<string>>;
}

const useNextActionFromData = (
  progressRecords: ProgressRecord[],
  readByTopic: Map<string, Set<string>>,
): NextAction | undefined => {
  const manifests = useVisibleManifests();
  const recallByTopic = useRecallByTopic();
  const place = useLastPlace();
  const language = getCurrentLanguage();

  const topics = useMemo<NextActionTopicInput[]>(() => {
    const passedByTopic = new Map<string, number>();
    for (const record of progressRecords) {
      if (record.status === 'pass') {
        passedByTopic.set(record.topicSlug, (passedByTopic.get(record.topicSlug) ?? 0) + 1);
      }
    }
    return manifests.map((manifest) => ({
      manifest,
      total: topicStats[manifest.slug]?.[effectiveLanguage(manifest, language)] ?? 0,
      passed: passedByTopic.get(manifest.slug) ?? 0,
      readConcepts: countReadConcepts(manifest.concepts, readByTopic.get(manifest.slug)),
    }));
  }, [manifests, progressRecords, readByTopic, language]);

  return useMemo(
    () =>
      resolveNextAction({
        topics,
        recallByTopic,
        lastPlace: place ? { topicSlug: place.topicSlug, conceptId: place.conceptId } : undefined,
      }),
    [topics, recallByTopic, place],
  );
};

const useNextAction = (): NextAction | undefined => {
  const progressRecords = useLiveQuery(() => db.progress.toArray(), [], []);
  const readByTopic = useReadConceptsByTopic();
  return useNextActionFromData(progressRecords, readByTopic);
};

const ICON_BY_KIND: Record<NextActionKind, typeof Sparkles> = {
  resume: History,
  'review-topic': RotateCcw,
  'due-deck': RotateCcw,
  unlocked: BookOpen,
};

const actionTarget = (
  action: NextAction,
):
  | { to: '/topics/$slug'; params: { slug: string }; search?: { concept?: string; resume?: true } }
  | { to: '/flashcards/$slug'; params: { slug: string } } => {
  if (action.kind === 'review-topic' || action.kind === 'due-deck') {
    return { to: '/flashcards/$slug', params: { slug: action.topicSlug } };
  }
  if (action.kind === 'resume' && action.conceptId) {
    return {
      to: '/topics/$slug',
      params: { slug: action.topicSlug },
      search: { concept: action.conceptId, resume: true },
    };
  }
  return { to: '/topics/$slug', params: { slug: action.topicSlug } };
};

interface ActionCopy {
  eyebrow: string;
  reason: string;
  cta: string;
}

const useActionCopy = (action: NextAction | undefined): ActionCopy | undefined => {
  const { t } = useTranslation('nextAction');
  if (!action) return undefined;
  const reasonKey = `reason.${action.kind}` as const;
  const reason =
    action.kind === 'review-topic'
      ? t(reasonKey, { percent: action.recallPercent ?? 0 })
      : action.kind === 'due-deck'
        ? t(reasonKey, { count: action.dueCount ?? 0 })
        : action.kind === 'resume' && action.conceptTitle
          ? t(reasonKey, {
              n: (action.conceptIndex ?? 0) + 1,
              title: action.conceptTitle,
            })
          : action.kind === 'resume'
            ? t('reason.resumePlain')
            : t(reasonKey);
  return {
    eyebrow: t(`eyebrow.${action.kind}`),
    reason,
    cta: t(`cta.${action.kind}`),
  };
};

const NextActionBannerView = ({ action }: { action: NextAction | undefined }) => {
  const { t } = useTranslation('nextAction');
  const copy = useActionCopy(action);
  if (!action || !copy) return null;
  const Icon = ICON_BY_KIND[action.kind];
  const target = actionTarget(action);
  return (
    <Link {...target} className="group block">
      <Surface interactive rule="left" className="border-l-accent">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent/[0.08] text-accent">
            <Icon size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 eyebrow text-[10px] text-accent">
              <Sparkles size={11} />
              {t('label')}
            </div>
            <h3 className="mt-1 font-display text-xl leading-tight tracking-tightish text-fg truncate">
              {action.topicTitle}
            </h3>
            <p className="mt-0.5 text-[13px] text-fg-muted line-clamp-2">{copy.reason}</p>
          </div>
          <span className="shrink-0 inline-flex items-center gap-1.5 text-accent text-sm font-medium">
            <span className="hidden sm:inline">{copy.cta}</span>
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </Surface>
    </Link>
  );
};

const NextActionBannerConnected = () => {
  const action = useNextAction();
  return <NextActionBannerView action={action} />;
};

const NextActionBannerProvided = ({ progressRecords, readByTopic }: NextActionData) => {
  const action = useNextActionFromData(progressRecords, readByTopic);
  return <NextActionBannerView action={action} />;
};

export const NextActionBanner = ({
  progressRecords,
  readByTopic,
}: Partial<NextActionData> = {}) => {
  if (progressRecords !== undefined && readByTopic !== undefined) {
    return <NextActionBannerProvided progressRecords={progressRecords} readByTopic={readByTopic} />;
  }
  return <NextActionBannerConnected />;
};

export const NextActionTopCard = () => {
  const { t } = useTranslation('nextAction');
  const action = useNextAction();
  const copy = useActionCopy(action);
  if (!action || !copy) return null;
  const Icon = ICON_BY_KIND[action.kind];
  const target = actionTarget(action);
  const isReview = action.kind === 'review-topic';
  return (
    <Surface variant="accent" rule="left">
      <div className="space-y-4 p-5 sm:p-6">
        <div className="flex items-center gap-2 eyebrow text-fg-subtle">
          <Sparkles size={12} className="text-accent" />
          <span>{t('label')}</span>
        </div>
        <div className="flex items-start gap-4">
          <span
            className={cx(
              'grid size-11 shrink-0 place-items-center rounded-full',
              isReview ? 'bg-warn/[0.12] text-warn' : 'bg-accent/[0.1] text-accent',
            )}
          >
            <Icon size={20} />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-2xl leading-tight tracking-tightish text-fg">
                {action.topicTitle}
              </h3>
              <Badge tone={isReview ? 'warning' : 'accent'} variant="soft">
                {copy.eyebrow}
              </Badge>
            </div>
            <p className="text-sm text-fg-muted">{copy.reason}</p>
          </div>
        </div>
        <Link {...target} className="block w-full sm:w-auto">
          <Button
            variant="primary"
            size="lg"
            className="w-full sm:w-auto"
            trailingIcon={<ArrowRight size={16} />}
          >
            {copy.cta}
          </Button>
        </Link>
      </div>
    </Surface>
  );
};
