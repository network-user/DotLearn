import {
  ProviderError,
  type AiProvider,
  type ConnectionStatus,
  type ExerciseSuggestion,
  type GenerateExercisesInput,
  type GenerateTopicInput,
  type ProviderCredentials,
  type TopicSuggestion,
} from './types';

const DEFAULT_BASE = 'http://localhost:11434';

export const ollamaProvider: AiProvider = {
  id: 'ollama',
  displayName: 'Ollama (local)',

  async testConnection(credentials: ProviderCredentials): Promise<ConnectionStatus> {
    const base = credentials.baseUrl ?? DEFAULT_BASE;
    try {
      const response = await fetch(`${base}/api/tags`);
      if (!response.ok) {
        return { ok: false, message: `HTTP ${response.status} from ${base}` };
      }
      return { ok: true, message: 'connected' };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  },

  async generateTopic(_input: GenerateTopicInput): Promise<TopicSuggestion> {
    throw new ProviderError('ollama', 'generateTopic is not implemented yet');
  },

  async generateExercises(_input: GenerateExercisesInput): Promise<ExerciseSuggestion[]> {
    throw new ProviderError('ollama', 'generateExercises is not implemented yet');
  },
};
