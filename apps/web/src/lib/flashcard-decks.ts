import { FlashcardDeck, type Flashcard } from '@dotlearn/contracts';
import { parse } from 'yaml';

export interface DeckCard extends Flashcard {
  conceptId: string;
}

interface DeckFile {
  slug: string;
  file: string;
  language: string;
  load: () => Promise<string>;
}

const deckModules = import.meta.glob<string>('../../../../topics/*/flashcards/*.yaml', {
  query: '?raw',
  import: 'default',
});

const LANG_SUFFIX = /\.(en|ru)\.yaml$/;
const TOPIC_PATH = /\/topics\/([^/]+)\/flashcards\/([^/]+)$/;

const registry = ((): Map<string, DeckFile[]> => {
  const map = new Map<string, DeckFile[]>();
  for (const [path, load] of Object.entries(deckModules)) {
    const normalized = path.replace(/^.*\/topics\//, '/topics/');
    const match = TOPIC_PATH.exec(normalized);
    if (!match) continue;
    const slug = match[1] as string;
    const file = match[2] as string;
    const langMatch = LANG_SUFFIX.exec(file);
    const language = langMatch ? (langMatch[1] as string) : 'ru';
    const bucket = map.get(slug) ?? [];
    bucket.push({ slug, file, language, load: load as () => Promise<string> });
    map.set(slug, bucket);
  }
  return map;
})();

export const flashcardTopicSlugs = (): string[] => [...registry.keys()].sort();

export const topicHasDecks = (slug: string): boolean => registry.has(slug);

const pickLanguage = (files: DeckFile[], requested: string): string => {
  const languages = new Set(files.map((entry) => entry.language));
  if (languages.has(requested)) return requested;
  if (languages.has('ru')) return 'ru';
  return files[0]?.language ?? 'ru';
};

const parsedCardsCache = new Map<string, Promise<DeckCard[]>>();

const parseTopicCards = async (language: string, files: DeckFile[]): Promise<DeckCard[]> => {
  const chosen = files
    .filter((entry) => entry.language === language)
    .sort((a, b) => a.file.localeCompare(b.file));
  const cards: DeckCard[] = [];
  for (const entry of chosen) {
    const raw = await entry.load();
    const deck = FlashcardDeck.parse(parse(raw));
    for (const card of deck.cards) {
      cards.push({ ...card, conceptId: deck.conceptId });
    }
  }
  return cards;
};

export const loadTopicCards = async (
  slug: string,
  requestedLanguage: string,
): Promise<DeckCard[]> => {
  const files = registry.get(slug);
  if (!files || files.length === 0) return [];
  const language = pickLanguage(files, requestedLanguage);
  const cacheKey = `${slug}:${language}`;
  const cached = parsedCardsCache.get(cacheKey);
  if (cached) return cached;
  const pending = parseTopicCards(language, files);
  parsedCardsCache.set(cacheKey, pending);
  pending.catch(() => parsedCardsCache.delete(cacheKey));
  return pending;
};
