import type { TopicLanguage, TopicRuntime } from '@dotlearn/contracts';

export type ProviderId = 'openai' | 'anthropic' | 'ollama' | 'openrouter';

export interface ProviderCredentials {
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
}

export interface ConnectionStatus {
  ok: boolean;
  message: string;
}

export interface GenerateTopicInput {
  subject: string;
  depth: 'introduction' | 'deep dive' | 'beginner-to-intermediate';
  estimatedHours: number;
  runtime: TopicRuntime;
  language: TopicLanguage;
}

export interface TopicSuggestion {
  slug: string;
  title: string;
  tags: string[];
  concepts: Array<{
    id: string;
    title: string;
    estimatedMinutes: number;
    summary: string;
  }>;
}

export interface GenerateExercisesInput {
  topicSlug: string;
  conceptId: string;
  runtime: TopicRuntime;
  count: number;
}

export interface ExerciseSuggestion {
  id: string;
  type: string;
  prompt: string;
  difficulty: number;
  notes?: string;
}

export interface AiProvider {
  readonly id: ProviderId;
  readonly displayName: string;
  testConnection(credentials: ProviderCredentials): Promise<ConnectionStatus>;
  generateTopic(
    input: GenerateTopicInput,
    credentials: ProviderCredentials,
  ): Promise<TopicSuggestion>;
  generateExercises(
    input: GenerateExercisesInput,
    credentials: ProviderCredentials,
  ): Promise<ExerciseSuggestion[]>;
}

export class ProviderError extends Error {
  constructor(
    public readonly providerId: ProviderId,
    message: string,
    cause?: unknown,
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'ProviderError';
  }
}
