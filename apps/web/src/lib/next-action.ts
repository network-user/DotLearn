import type { TopicLanguage, TopicManifest } from '@dotlearn/contracts';

import { blendRecallIntoMastery, computeMastery, RECALL_REVIEW_THRESHOLD } from './mastery';
import type { TopicRecall } from './retention';
import { conceptTitle as resolveConceptTitle, topicTitle as resolveTopicTitle } from './topics';

export type NextActionKind = 'resume' | 'review-topic' | 'due-deck' | 'unlocked';

export interface NextAction {
  kind: NextActionKind;
  topicSlug: string;
  topicTitle: string;
  conceptId?: string;
  conceptIndex?: number;
  conceptTitle?: string;
  recallPercent?: number;
  dueCount?: number;
}

export interface NextActionTopicInput {
  manifest: TopicManifest;
  total: number;
  passed: number;
  readConcepts: number;
}

export interface NextActionInput {
  topics: readonly NextActionTopicInput[];
  recallByTopic: Map<string, TopicRecall>;
  lastPlace?: { topicSlug: string; conceptId: string } | undefined;
  reviewThreshold?: number;
  language: TopicLanguage;
}

const PRIORITY: Record<NextActionKind, number> = {
  'review-topic': 4,
  resume: 3,
  'due-deck': 2,
  unlocked: 1,
};

const masteredSlugsOf = (topics: readonly NextActionTopicInput[]): Set<string> => {
  const set = new Set<string>();
  for (const topic of topics) {
    const mastery = computeMastery(
      topic.readConcepts,
      topic.manifest.concepts.length,
      topic.passed,
      topic.total,
    );
    if (mastery.mastery >= 0.999) set.add(topic.manifest.slug);
  }
  return set;
};

const conceptLocator = (
  manifest: TopicManifest,
  conceptId: string,
  language: TopicLanguage,
): { conceptId: string; conceptIndex: number; conceptTitle: string } | undefined => {
  const index = manifest.concepts.findIndex((concept) => concept.id === conceptId);
  if (index < 0) return undefined;
  const concept = manifest.concepts[index];
  if (!concept) return undefined;
  return { conceptId, conceptIndex: index, conceptTitle: resolveConceptTitle(concept, language) };
};

const reviewTopicCandidate = (
  input: NextActionInput,
): { action: NextAction; recall: number } | undefined => {
  const threshold = input.reviewThreshold ?? RECALL_REVIEW_THRESHOLD;
  let worst: { action: NextAction; recall: number } | undefined;
  for (const topic of input.topics) {
    const recall = input.recallByTopic.get(topic.manifest.slug);
    if (!recall || recall.reviewedCards === 0) continue;
    const base = computeMastery(
      topic.readConcepts,
      topic.manifest.concepts.length,
      topic.passed,
      topic.total,
    );
    const blended = blendRecallIntoMastery(base, recall.recall, threshold);
    if (!blended.needsReview) continue;
    if (!worst || recall.recall < worst.recall) {
      worst = {
        recall: recall.recall,
        action: {
          kind: 'review-topic',
          topicSlug: topic.manifest.slug,
          topicTitle: resolveTopicTitle(topic.manifest, input.language),
          recallPercent: Math.round(recall.recall * 100),
          dueCount: recall.dueCards,
        },
      };
    }
  }
  return worst;
};

const resumeCandidate = (input: NextActionInput): NextAction | undefined => {
  const place = input.lastPlace;
  if (!place) return undefined;
  const topic = input.topics.find((entry) => entry.manifest.slug === place.topicSlug);
  if (!topic) return undefined;
  const base = computeMastery(
    topic.readConcepts,
    topic.manifest.concepts.length,
    topic.passed,
    topic.total,
  );
  if (base.mastery >= 0.999) return undefined;
  const locator = conceptLocator(topic.manifest, place.conceptId, input.language);
  return {
    kind: 'resume',
    topicSlug: topic.manifest.slug,
    topicTitle: resolveTopicTitle(topic.manifest, input.language),
    ...(locator ?? {}),
  };
};

const dueDeckCandidate = (input: NextActionInput): NextAction | undefined => {
  let best: { topic: NextActionTopicInput; dueCards: number } | undefined;
  for (const topic of input.topics) {
    const recall = input.recallByTopic.get(topic.manifest.slug);
    if (!recall || recall.dueCards === 0) continue;
    if (!best || recall.dueCards > best.dueCards) {
      best = { topic, dueCards: recall.dueCards };
    }
  }
  if (!best) return undefined;
  return {
    kind: 'due-deck',
    topicSlug: best.topic.manifest.slug,
    topicTitle: resolveTopicTitle(best.topic.manifest, input.language),
    dueCount: best.dueCards,
  };
};

const unlockedCandidate = (input: NextActionInput): NextAction | undefined => {
  const existingSlugs = new Set(input.topics.map((topic) => topic.manifest.slug));
  const mastered = masteredSlugsOf(input.topics);
  const untouched = input.topics
    .filter((topic) => {
      const base = computeMastery(
        topic.readConcepts,
        topic.manifest.concepts.length,
        topic.passed,
        topic.total,
      );
      return base.mastery === 0 && topic.readConcepts === 0 && topic.passed === 0;
    })
    .filter((topic) => {
      const prereqs = topic.manifest.prerequisites.filter((slug) => existingSlugs.has(slug));
      return prereqs.length > 0 && prereqs.every((slug) => mastered.has(slug));
    })
    .sort((a, b) =>
      resolveTopicTitle(a.manifest, input.language).localeCompare(
        resolveTopicTitle(b.manifest, input.language),
      ),
    );
  const first = untouched[0];
  if (!first) return undefined;
  return {
    kind: 'unlocked',
    topicSlug: first.manifest.slug,
    topicTitle: resolveTopicTitle(first.manifest, input.language),
  };
};

export const resolveNextAction = (input: NextActionInput): NextAction | undefined => {
  const review = reviewTopicCandidate(input);
  const candidates: NextAction[] = [];
  if (review) candidates.push(review.action);
  const resume = resumeCandidate(input);
  if (resume) candidates.push(resume);
  const dueDeck = dueDeckCandidate(input);
  if (dueDeck) candidates.push(dueDeck);
  const unlocked = unlockedCandidate(input);
  if (unlocked) candidates.push(unlocked);
  if (candidates.length === 0) return undefined;
  return candidates.sort((a, b) => PRIORITY[b.kind] - PRIORITY[a.kind])[0];
};
