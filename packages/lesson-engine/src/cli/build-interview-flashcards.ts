import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { extractInterviewAnswer } from '../interview/flashcard-text';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../../..');
const OUT_DIR = resolve(ROOT, 'interview');

interface MissingEntry {
  questionId: number;
  path: string;
  locale: 'ru' | 'en';
  reason: 'no-answer-section' | 'file-missing';
}

interface FlashcardEntry {
  questionId: number;
  category: string;
  categoryLabel: string;
  stage: string;
  front: string;
  back: string;
  path: string;
}

interface LocaleBundle {
  cards: FlashcardEntry[];
  missing: MissingEntry[];
}

interface FlashcardsIndex {
  generatedAt: string;
  ru: LocaleBundle;
  en: LocaleBundle;
}

const unquote = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return trimmed;
};

const parseFrontmatter = (text: string): Record<string, string> | undefined => {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match?.[1]) return undefined;
  const data: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    data[line.slice(0, idx).trim()] = unquote(line.slice(idx + 1));
  }
  return data;
};

const isDir = async (path: string): Promise<boolean> => {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
};

const buildLocale = async (
  locale: 'ru' | 'en',
  suffix: '.ru.mdx' | '.en.mdx',
): Promise<LocaleBundle> => {
  const cards: FlashcardEntry[] = [];
  const missing: MissingEntry[] = [];
  const names = await readdir(OUT_DIR);

  for (const category of names) {
    const dir = resolve(OUT_DIR, category);
    if (!(await isDir(dir))) continue;
    const entries = await readdir(dir);
    for (const file of entries) {
      if (!file.endsWith(suffix)) continue;
      const questionId = Number(file.replace(suffix, ''));
      const path = `${category}/${file}`;
      const raw = await readFile(resolve(dir, file), 'utf-8');
      const fm = parseFrontmatter(raw);
      if (!fm?.title) {
        missing.push({ questionId, path, locale, reason: 'file-missing' });
        continue;
      }
      const back = extractInterviewAnswer(raw);
      if (!back) {
        missing.push({ questionId, path, locale, reason: 'no-answer-section' });
        continue;
      }
      cards.push({
        questionId,
        category: fm.category ?? category,
        categoryLabel: fm.categoryLabel ?? category,
        stage: fm.stage ?? 'tech',
        front: fm.title,
        back,
        path,
      });
    }
  }

  cards.sort((a, b) => a.category.localeCompare(b.category) || a.questionId - b.questionId);
  missing.sort((a, b) => a.path.localeCompare(b.path));
  return { cards, missing };
};

const main = async (): Promise<number> => {
  const index: FlashcardsIndex = {
    generatedAt: new Date().toISOString(),
    ru: await buildLocale('ru', '.ru.mdx'),
    en: await buildLocale('en', '.en.mdx'),
  };

  await writeFile(
    resolve(OUT_DIR, 'flashcards-index.json'),
    `${JSON.stringify(index, null, 2)}\n`,
    'utf-8',
  );

  console.log(
    `Rebuilt flashcards-index.json — ru: ${index.ru.cards.length} cards, ${index.ru.missing.length} missing; en: ${index.en.cards.length} cards, ${index.en.missing.length} missing.`,
  );

  if (index.ru.missing.length > 0) {
    console.warn('Missing Russian flashcard sections:');
    for (const entry of index.ru.missing.slice(0, 20)) {
      console.warn(`  • ${entry.path} (${entry.reason})`);
    }
    if (index.ru.missing.length > 20) {
      console.warn(`  … and ${index.ru.missing.length - 20} more`);
    }
  }

  return 0;
};

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
