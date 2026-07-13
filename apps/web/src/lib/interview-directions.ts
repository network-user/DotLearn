import { InterviewDirection, type InterviewDirection as InterviewDirectionType } from '@dotlearn/contracts';

import config from './interview-directions.data.json';

export interface DirectionConfig {
  id: InterviewDirectionType;
  labelRu: string;
  labelEn: string;
  categoryPrefixes: string[];
  legacyCategories: string[];
}

const directions = config.directions as DirectionConfig[];

const directionIds = new Set<string>(InterviewDirection.options);

export const isInterviewDirection = (value: string): value is InterviewDirectionType =>
  directionIds.has(value);

export const getInterviewDirections = (): DirectionConfig[] => directions;

export const resolveInterviewDirection = (category: string): InterviewDirectionType | undefined => {
  for (const entry of directions) {
    if (entry.id === 'python') continue;
    for (const prefix of entry.categoryPrefixes) {
      if (category.startsWith(prefix)) return entry.id;
    }
  }
  const python = directions.find((entry) => entry.id === 'python');
  if (python?.legacyCategories.includes(category)) return 'python';
  return undefined;
};

export const categoriesForDirection = (
  directionId: InterviewDirectionType,
  categories: readonly string[],
): string[] =>
  categories.filter((category) => resolveInterviewDirection(category) === directionId);

export const directionLabel = (id: InterviewDirectionType, lang: string): string => {
  const entry = directions.find((item) => item.id === id);
  if (!entry) return id;
  return lang === 'en' ? entry.labelEn : entry.labelRu;
};

export const INTERVIEW_DIRECTION_STORAGE_KEY = 'dotlearn:interview-direction';

export const readStoredInterviewDirection = (): InterviewDirectionType | undefined => {
  try {
    const raw = localStorage.getItem(INTERVIEW_DIRECTION_STORAGE_KEY);
    if (raw && isInterviewDirection(raw)) return raw;
  } catch {
    return undefined;
  }
  return undefined;
};

export const writeStoredInterviewDirection = (id: InterviewDirectionType): void => {
  try {
    localStorage.setItem(INTERVIEW_DIRECTION_STORAGE_KEY, id);
  } catch {
    return;
  }
};
