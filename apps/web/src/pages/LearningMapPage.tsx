import { useMemo } from 'react';

import { useLiveQuery } from 'dexie-react-hooks';
import { Waypoints } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { LearningMap, type MapNode } from '@/components/LearningMap';
import { Surface } from '@/components/ui/Surface';
import { countReadConcepts, useReadConceptsByTopic } from '@/lib/mastery';
import { db } from '@/lib/progress-db';
import { useRecallByTopic } from '@/lib/retention';
import { effectiveLanguage, useContentLanguage } from '@/lib/topics';
import { useVisibleManifests } from '@/lib/use-manifests';
import topicStats from 'virtual:topic-stats';

export const LearningMapPage = () => {
  const { t } = useTranslation('map');
  const manifests = useVisibleManifests();
  const progressRecords = useLiveQuery(() => db.progress.toArray(), [], []);
  const readByTopic = useReadConceptsByTopic();
  const recallByTopic = useRecallByTopic();
  const language = useContentLanguage();

  const nodes = useMemo<MapNode[]>(() => {
    const existingSlugs = new Set(manifests.map((manifest) => manifest.slug));
    const passedByTopic = new Map<string, number>();
    for (const record of progressRecords ?? []) {
      if (record.status === 'pass') {
        passedByTopic.set(record.topicSlug, (passedByTopic.get(record.topicSlug) ?? 0) + 1);
      }
    }
    return manifests.map((manifest) => {
      const recall = recallByTopic.get(manifest.slug);
      return {
        manifest,
        total: topicStats[manifest.slug]?.[effectiveLanguage(manifest, language)] ?? 0,
        passed: passedByTopic.get(manifest.slug) ?? 0,
        readConcepts: countReadConcepts(manifest.concepts, readByTopic.get(manifest.slug)),
        prerequisites: manifest.prerequisites.filter((slug) => existingSlugs.has(slug)),
        ...(recall ? { recall } : {}),
      };
    });
  }, [manifests, progressRecords, readByTopic, recallByTopic, language]);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 eyebrow text-fg-subtle">
          <Waypoints size={12} className="text-accent" />
          <span>{t('eyebrow')}</span>
        </div>
        <h1 className="font-display text-3xl tracking-tightish text-fg">{t('title')}</h1>
        <p className="max-w-prose text-sm text-fg-muted">{t('subtitle')}</p>
      </header>

      {nodes.length === 0 ? (
        <Surface variant="inset">
          <div className="p-8 text-center">
            <p className="text-sm text-fg-muted">{t('empty')}</p>
          </div>
        </Surface>
      ) : (
        <LearningMap nodes={nodes} />
      )}
    </div>
  );
};
