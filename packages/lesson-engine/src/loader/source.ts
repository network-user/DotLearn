import type { Exercise, TopicLanguage, TopicManifest } from '@dotlearn/contracts';

export interface TheoryFile {
  filename: string;
  source: string;
}

export interface ExerciseFileBundle {
  filename: string;
  exercises: Exercise[];
}

export interface ConceptBundle {
  conceptId: string;
  theory: TheoryFile[];
  exercises: ExerciseFileBundle[];
}

export interface TopicBundle {
  manifest: TopicManifest;
  concepts: ConceptBundle[];
}

export interface TopicLoadOptions {
  languages?: TopicLanguage[];
}

export interface TopicSource {
  list(): Promise<string[]>;
  load(slug: string, options?: TopicLoadOptions): Promise<TopicBundle>;
}

export class TopicNotFoundError extends Error {
  constructor(public readonly slug: string) {
    super(`Topic "${slug}" not found`);
    this.name = 'TopicNotFoundError';
  }
}

export class TopicLoadError extends Error {
  constructor(
    public readonly slug: string,
    public readonly resource: string,
    message: string,
  ) {
    super(`Topic "${slug}" ${resource}: ${message}`);
    this.name = 'TopicLoadError';
  }
}
