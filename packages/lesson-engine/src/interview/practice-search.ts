export type PracticeMode = 'topics' | 'interview' | 'random';
export type PracticeDueFilter = 'due' | 'all';

export interface FlashcardsPracticeSearch {
  mode?: PracticeMode | undefined;
  category?: string | undefined;
  stage?: string | undefined;
  direction?: string | undefined;
  topics?: string | undefined;
  due?: PracticeDueFilter | undefined;
  count?: string | undefined;
  start?: boolean | undefined;
}

const MODES = new Set<PracticeMode>(['topics', 'interview', 'random']);
const DIRECTIONS = new Set([
  'python',
  'go',
  'frontend',
  'java',
  '1c',
  'cpp',
  'devops',
  'qa',
  'aqa',
  'all',
]);

export const parseFlashcardsPracticeSearch = (
  search: Record<string, unknown>,
): FlashcardsPracticeSearch => {
  const mode = MODES.has(search.mode as PracticeMode) ? (search.mode as PracticeMode) : undefined;
  const category =
    typeof search.category === 'string' && search.category.length > 0 ? search.category : undefined;
  const stage =
    typeof search.stage === 'string' && search.stage.length > 0 ? search.stage : undefined;
  const direction =
    typeof search.direction === 'string' && DIRECTIONS.has(search.direction)
      ? search.direction
      : undefined;
  const topics =
    typeof search.topics === 'string' && search.topics.length > 0 ? search.topics : undefined;
  const due = search.due === 'due' || search.due === 'all' ? search.due : undefined;
  const count =
    typeof search.count === 'string' && search.count.length > 0 ? search.count : undefined;
  const start = search.start === true || search.start === 'true' || search.start === '1';
  return {
    mode,
    category,
    stage,
    direction,
    topics,
    due,
    count,
    ...(start ? { start: true } : {}),
  };
};

export const parseTopicsParam = (topics: string | undefined, validSlugs: string[]): string[] => {
  if (!topics) return [];
  const wanted = topics
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  return wanted.filter((slug) => validSlugs.includes(slug));
};

export const topicsToParam = (topics: string[]): string | undefined =>
  topics.length > 0 ? topics.join(',') : undefined;

export const practiceSearchDefaults: Required<
  Pick<FlashcardsPracticeSearch, 'mode' | 'category' | 'stage' | 'direction' | 'due' | 'count'>
> = {
  mode: 'topics',
  category: 'all',
  stage: 'all',
  direction: 'all',
  due: 'due',
  count: '20',
};
