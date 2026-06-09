export type {
  AiProvider,
  ConnectionStatus,
  ExerciseSuggestion,
  GenerateExercisesInput,
  GenerateTopicInput,
  ProviderCredentials,
  ProviderId,
  TopicSuggestion,
} from './types';
export { ProviderError } from './types';

export { openAiProvider } from './openai';
export { anthropicProvider } from './anthropic';
export { ollamaProvider } from './ollama';
export { openRouterProvider } from './openrouter';

import { anthropicProvider } from './anthropic';
import { ollamaProvider } from './ollama';
import { openAiProvider } from './openai';
import { openRouterProvider } from './openrouter';
import type { AiProvider, ProviderId } from './types';

export const providers: Record<ProviderId, AiProvider> = {
  openai: openAiProvider,
  anthropic: anthropicProvider,
  ollama: ollamaProvider,
  openrouter: openRouterProvider,
};

export const providerList: AiProvider[] = [
  openAiProvider,
  anthropicProvider,
  openRouterProvider,
  ollamaProvider,
];
