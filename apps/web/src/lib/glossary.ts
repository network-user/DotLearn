import glossaryData from './glossary.data.json';

export interface GlossaryEntry {
  id: string;
  term: { ru: string; en: string };
  def: { ru: string; en: string };
  topicSlug?: string;
}

export const GLOSSARY: GlossaryEntry[] = glossaryData as GlossaryEntry[];

export const getGlossaryEntry = (id: string): GlossaryEntry | undefined => {
  const normalized = id.trim().toLowerCase();
  return GLOSSARY.find((entry) => entry.id.toLowerCase() === normalized);
};
