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

const DEFAULT_BASE = 'https://api.anthropic.com/v1';

export const anthropicProvider: AiProvider = {
  id: 'anthropic',
  displayName: 'Anthropic',

  async testConnection(credentials: ProviderCredentials): Promise<ConnectionStatus> {
    if (!credentials.apiKey) {
      return { ok: false, message: 'API key is required' };
    }
    const base = credentials.baseUrl ?? DEFAULT_BASE;
    try {
      const response = await fetch(`${base}/models`, {
        headers: {
          'x-api-key': credentials.apiKey,
          'anthropic-version': '2023-06-01',
        },
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
    throw new ProviderError('anthropic', 'generateTopic is not implemented yet');
  },

  async generateExercises(_input: GenerateExercisesInput): Promise<ExerciseSuggestion[]> {
    throw new ProviderError('anthropic', 'generateExercises is not implemented yet');
  },
};
