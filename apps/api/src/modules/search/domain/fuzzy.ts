export const normalizeQuery = (value: string): string => value.trim().toLowerCase();

export const tokenize = (value: string): string[] =>
  normalizeQuery(value)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 0);

export const levenshtein = (a: string, b: string): number => {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    const ai = a.charCodeAt(i - 1);
    for (let j = 1; j <= b.length; j += 1) {
      const cost = ai === b.charCodeAt(j - 1) ? 0 : 1;
      const insertion = (current[j - 1] ?? 0) + 1;
      const deletion = (previous[j] ?? 0) + 1;
      const substitution = (previous[j - 1] ?? 0) + cost;
      current[j] = Math.min(insertion, deletion, substitution);
    }
    previous = current.slice();
  }
  return previous[b.length] ?? 0;
};

const fuzzinessThreshold = (token: string): number => {
  if (token.length <= 3) return 0;
  if (token.length <= 5) return 1;
  return 2;
};

export const tokenMatchScore = (queryToken: string, candidateToken: string): number => {
  if (candidateToken.startsWith(queryToken)) {
    return 1 + Math.min(queryToken.length / candidateToken.length, 1);
  }
  if (candidateToken.includes(queryToken)) {
    return 1;
  }
  const distance = levenshtein(queryToken, candidateToken);
  const threshold = fuzzinessThreshold(queryToken);
  if (distance <= threshold) {
    return Math.max(0, 1 - distance / Math.max(queryToken.length, 1));
  }
  return 0;
};

export interface FieldWeights {
  title: number;
  outline: number;
  tags: number;
}

export const DEFAULT_FIELD_WEIGHTS: FieldWeights = {
  title: 4,
  outline: 1,
  tags: 3,
};

export interface ScoredFields {
  title: string;
  outline: string;
  tags: string[];
}

const scoreFieldTokens = (queryTokens: string[], candidateTokens: string[]): number => {
  if (queryTokens.length === 0 || candidateTokens.length === 0) return 0;
  let total = 0;
  for (const queryToken of queryTokens) {
    let best = 0;
    for (const candidate of candidateTokens) {
      const score = tokenMatchScore(queryToken, candidate);
      if (score > best) best = score;
      if (best === 2) break;
    }
    total += best;
  }
  return total / queryTokens.length;
};

export const scoreDocument = (
  query: string,
  fields: ScoredFields,
  weights: FieldWeights = DEFAULT_FIELD_WEIGHTS,
): number => {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return 0;
  const titleTokens = tokenize(fields.title);
  const outlineTokens = tokenize(fields.outline);
  const tagTokens = fields.tags.flatMap((tag) => tokenize(tag));
  const titleScore = scoreFieldTokens(queryTokens, titleTokens);
  const outlineScore = scoreFieldTokens(queryTokens, outlineTokens);
  const tagsScore = scoreFieldTokens(queryTokens, tagTokens);
  return titleScore * weights.title + outlineScore * weights.outline + tagsScore * weights.tags;
};
