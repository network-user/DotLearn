import { useMemo } from 'react';

import type { TopicManifest } from '@dotlearn/contracts';
import { useLiveQuery } from 'dexie-react-hooks';

import { getCurrentLanguage, type SupportedLanguage } from './i18n';
import { computeMastery, countReadConcepts, useReadConceptsByTopic } from './mastery';
import { db, type ProgressRecord } from './progress-db';
import { effectiveLanguage } from './topics';
import { tracks, trackMemberSlugs } from './tracks';
import { useVisibleManifests } from './use-manifests';
import topicStats from 'virtual:topic-stats';

export interface TrackAggregate {
  presentSlugs: string[];
  masteryAverage: number;
  masteredCount: number;
}

const computeTrackAggregates = (
  manifests: TopicManifest[],
  progressRecords: ProgressRecord[],
  readByTopic: Map<string, Set<string>>,
  language: SupportedLanguage,
): Map<string, TrackAggregate> => {
  const bySlug = new Map<string, TopicManifest>();
  for (const manifest of manifests) bySlug.set(manifest.slug, manifest);

  const passedByTopic = new Map<string, number>();
  for (const record of progressRecords) {
    if (record.status === 'pass') {
      passedByTopic.set(record.topicSlug, (passedByTopic.get(record.topicSlug) ?? 0) + 1);
    }
  }

  const result = new Map<string, TrackAggregate>();
  for (const track of tracks) {
    const memberSlugs = trackMemberSlugs(track).filter((slug) => bySlug.has(slug));
    let masterySum = 0;
    let masteredCount = 0;
    for (const slug of memberSlugs) {
      const manifest = bySlug.get(slug);
      if (!manifest) continue;
      const total = topicStats[slug]?.[effectiveLanguage(manifest, language)] ?? 0;
      const mastery = computeMastery(
        countReadConcepts(manifest.concepts, readByTopic.get(slug)),
        manifest.concepts.length,
        passedByTopic.get(slug) ?? 0,
        total,
      );
      masterySum += mastery.mastery;
      if (mastery.mastery >= 0.999) masteredCount += 1;
    }
    result.set(track.id, {
      presentSlugs: memberSlugs,
      masteryAverage: memberSlugs.length === 0 ? 0 : masterySum / memberSlugs.length,
      masteredCount,
    });
  }
  return result;
};

export const useTrackAggregatesFromData = (
  progressRecords: ProgressRecord[],
  readByTopic: Map<string, Set<string>>,
): Map<string, TrackAggregate> => {
  const manifests = useVisibleManifests();
  const language = getCurrentLanguage();

  return useMemo(
    () => computeTrackAggregates(manifests, progressRecords, readByTopic, language),
    [manifests, progressRecords, readByTopic, language],
  );
};

export const useTrackAggregates = (): Map<string, TrackAggregate> => {
  const progressRecords = useLiveQuery(() => db.progress.toArray(), [], []);
  const readByTopic = useReadConceptsByTopic();
  return useTrackAggregatesFromData(progressRecords, readByTopic);
};
