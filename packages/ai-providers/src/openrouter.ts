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

const DEFAULT_BASE = 'https://openrouter.ai/api/v1';

export const openRouterProvider: AiProvider = {
  id: 'openrouter',
  displayName: 'OpenRouter',

  async testConnection(credentials: ProviderCredentials): Promise<ConnectionStatus> {
    if (!credentials.apiKey) {
      return { ok: false, message: 'API key is required' };
    }
    const base = credentials.baseUrl ?? DEFAULT_BASE;
    try {
      const response = await fetch(`${base}/models`, {
        headers: { Authorization: `Bearer ${credentials.apiKey}` },
      });
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
    throw new ProviderError('openrouter', 'generateTopic is not implemented yet');
  },

  async generateExercises(_input: GenerateExercisesInput): Promise<ExerciseSuggestion[]> {
    throw new ProviderError('openrouter', 'generateExercises is not implemented yet');
  },
};
