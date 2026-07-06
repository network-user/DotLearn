import { createContext } from 'react';

export interface ConceptRenderContext {
  topicSlug: string;
  conceptId: string;
  conceptTitle?: string | undefined;
}

export const ConceptContext = createContext<ConceptRenderContext | null>(null);
