import { readdirSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

import type { Plugin } from 'vite';
import { parse as parseYaml } from 'yaml';

const VIRTUAL_BASE = 'virtual:search-index';
const SEARCH_LANGUAGES = ['ru', 'en'] as const;
const virtualId = (language: SearchLanguage): string => `${VIRTUAL_BASE}/${language}`;
const resolvedId = (language: SearchLanguage): string => `\0${virtualId(language)}`;

const THEORY_SUFFIX = /\.(en|ru)\.mdx$/;
const EXERCISE_SUFFIX = /\.(en|ru)\.yaml$/;
const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n/;
const IMPORT_EXPORT_LINE = /^\s*(import|export)\b.*$/gm;
const FENCED_CODE = /```[\s\S]*?```/g;
const INLINE_CODE = /`([^`]*)`/g;
const JSX_OR_HTML_TAG = /<\/?[A-Za-z][^>]*>/g;
const MARKDOWN_LINK = /\[([^\]]*)\]\([^)]*\)/g;
const MARKDOWN_HEADING = /^\s{0,3}#{1,6}\s+/gm;
const MARKDOWN_EMPHASIS = /(\*{1,3}|_{1,3}|~{2})/g;
const BLOCKQUOTE = /^\s{0,3}>\s?/gm;
const LIST_MARKER = /^\s{0,3}([-*+]|\d+\.)\s+/gm;
const WHITESPACE = /\s+/g;
const MAX_ENTRY_TEXT = 1500;

const clampText = (text: string): string => {
  if (text.length <= MAX_ENTRY_TEXT) return text;
  const sliced = text.slice(0, MAX_ENTRY_TEXT);
  const lastSpace = sliced.lastIndexOf(' ');
  return lastSpace > MAX_ENTRY_TEXT * 0.6 ? sliced.slice(0, lastSpace) : sliced;
};

type ConceptManifest = {
  id: string;
  title: string;
  theoryFiles?: string[];
  exerciseFiles?: string[];
};

type Manifest = {
  title: string;
  concepts: ConceptManifest[];
};

type SearchLanguage = 'en' | 'ru';

interface SearchEntry {
  type: 'concept' | 'exercise';
  slug: string;
  conceptId: string;
  topicTitle: string;
  conceptTitle: string;
  language: SearchLanguage;
  text: string;
}

type EmittedEntry = Omit<SearchEntry, 'language'>;

const entriesForLanguage = (entries: SearchEntry[], language: SearchLanguage): EmittedEntry[] => {
  const slugsWithLanguage = new Set<string>();
  for (const entry of entries) {
    if (entry.language === language) slugsWithLanguage.add(entry.slug);
  }
  const emitted: EmittedEntry[] = [];
  for (const entry of entries) {
    const keep = slugsWithLanguage.has(entry.slug) ? entry.language === language : true;
    if (!keep) continue;
    emitted.push({
      type: entry.type,
      slug: entry.slug,
      conceptId: entry.conceptId,
      topicTitle: entry.topicTitle,
      conceptTitle: entry.conceptTitle,
      text: entry.text,
    });
  }
  return emitted;
};

const stripMarkdown = (raw: string): string =>
  raw
    .replace(FRONTMATTER, '')
    .replace(IMPORT_EXPORT_LINE, '')
    .replace(FENCED_CODE, ' ')
    .replace(JSX_OR_HTML_TAG, ' ')
    .replace(MARKDOWN_LINK, '$1')
    .replace(INLINE_CODE, '$1')
    .replace(MARKDOWN_HEADING, '')
    .replace(BLOCKQUOTE, '')
    .replace(LIST_MARKER, '')
    .replace(MARKDOWN_EMPHASIS, '')
    .replace(WHITESPACE, ' ')
    .trim();

const stemConceptId = (fileName: string): string =>
  fileName.replace(THEORY_SUFFIX, '').replace(EXERCISE_SUFFIX, '').replace(/^\d+-/, '');

const buildConceptResolver = (concepts: ConceptManifest[]) => {
  const byFile = new Map<string, ConceptManifest>();
  const byStem = new Map<string, ConceptManifest>();
  for (const concept of concepts) {
    byStem.set(concept.id, concept);
    for (const file of concept.theoryFiles ?? []) {
      byFile.set(basename(file), concept);
    }
    for (const file of concept.exerciseFiles ?? []) {
      byFile.set(basename(file), concept);
    }
  }
  return (fileName: string): ConceptManifest | undefined =>
    byFile.get(fileName) ?? byStem.get(stemConceptId(fileName));
};

const readManifest = (manifestPath: string): Manifest | undefined => {
  try {
    const parsed: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as Manifest).title === 'string' &&
      Array.isArray((parsed as Manifest).concepts)
    ) {
      return parsed as Manifest;
    }
  } catch {
    return undefined;
  }
  return undefined;
};

const collectExercisePrompts = (filePath: string): string => {
  const parsed: unknown = parseYaml(readFileSync(filePath, 'utf8'));
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !Array.isArray((parsed as { exercises?: unknown }).exercises)
  ) {
    return '';
  }
  const prompts: string[] = [];
  for (const exercise of (parsed as { exercises: unknown[] }).exercises) {
    if (
      exercise &&
      typeof exercise === 'object' &&
      typeof (exercise as { prompt?: unknown }).prompt === 'string'
    ) {
      prompts.push((exercise as { prompt: string }).prompt);
    }
  }
  return prompts.join(' ').replace(WHITESPACE, ' ').trim();
};

export const searchIndexPlugin = (): Plugin => {
  const topicsRoot = resolve(__dirname, '../../topics');

  const buildIndex = (addWatchFile: (file: string) => void): SearchEntry[] => {
    const entries: SearchEntry[] = [];
    let topicDirs: string[];
    try {
      topicDirs = readdirSync(topicsRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
    } catch {
      return entries;
    }

    for (const slug of topicDirs) {
      const manifestPath = join(topicsRoot, slug, 'manifest.json');
      addWatchFile(manifestPath);
      const manifest = readManifest(manifestPath);
      if (!manifest) continue;

      const resolveConcept = buildConceptResolver(manifest.concepts);

      const theoryDir = join(topicsRoot, slug, 'theory');
      let theoryFiles: string[] = [];
      try {
        theoryFiles = readdirSync(theoryDir);
      } catch {
        theoryFiles = [];
      }
      for (const file of theoryFiles) {
        const match = THEORY_SUFFIX.exec(file);
        if (!match) continue;
        const language = match[1] as SearchLanguage;
        const concept = resolveConcept(file);
        if (!concept) continue;
        const filePath = join(theoryDir, file);
        addWatchFile(filePath);
        const text = clampText(stripMarkdown(readFileSync(filePath, 'utf8')));
        if (!text) continue;
        entries.push({
          type: 'concept',
          slug,
          conceptId: concept.id,
          topicTitle: manifest.title,
          conceptTitle: concept.title,
          language,
          text,
        });
      }

      const exercisesDir = join(topicsRoot, slug, 'exercises');
      let exerciseFiles: string[] = [];
      try {
        exerciseFiles = readdirSync(exercisesDir);
      } catch {
        exerciseFiles = [];
      }
      for (const file of exerciseFiles) {
        const match = EXERCISE_SUFFIX.exec(file);
        if (!match) continue;
        const language = match[1] as SearchLanguage;
        const concept = resolveConcept(file);
        if (!concept) continue;
        const filePath = join(exercisesDir, file);
        addWatchFile(filePath);
        const text = clampText(collectExercisePrompts(filePath));
        if (!text) continue;
        entries.push({
          type: 'exercise',
          slug,
          conceptId: concept.id,
          topicTitle: manifest.title,
          conceptTitle: concept.title,
          language,
          text,
        });
      }
    }

    return entries;
  };

  return {
    name: 'dotlearn-search-index',
    resolveId(id) {
      for (const language of SEARCH_LANGUAGES) {
        if (id === virtualId(language)) return resolvedId(language);
      }
      return undefined;
    },
    load(id) {
      const language = SEARCH_LANGUAGES.find((candidate) => id === resolvedId(candidate));
      if (!language) {
        return undefined;
      }
      const entries = buildIndex((file) => this.addWatchFile(file));
      const emitted = entriesForLanguage(entries, language);
      return `export default ${JSON.stringify(JSON.stringify(emitted))};`;
    },
  };
};
