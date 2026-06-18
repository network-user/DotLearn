import type { ReactNode } from 'react';

import { Link } from '@tanstack/react-router';

interface ConceptLinkProps {
  slug: string;
  concept: string;
  children?: ReactNode;
}

export const ConceptLink = ({ slug, concept, children }: ConceptLinkProps) => (
  <Link
    to="/topics/$slug"
    params={{ slug }}
    search={{ concept }}
    className="text-accent underline decoration-accent/40 underline-offset-2 transition-colors hover:decoration-accent"
  >
    {children}
  </Link>
);
