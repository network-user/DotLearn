export const normalizeQuery = (value: string): string => value.trim().toLowerCase();

export const fuzzyTokenize = (value: string): string[] =>
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

export interface FuzzyField {
  text: string;
  weight: number;
}

export const fuzzyScore = (query: string, fields: readonly FuzzyField[]): number => {
  const queryTokens = fuzzyTokenize(query);
  if (queryTokens.length === 0) return 0;
  let total = 0;
  for (const field of fields) {
    if (field.weight === 0) continue;
    const candidateTokens = fuzzyTokenize(field.text);
    total += scoreFieldTokens(queryTokens, candidateTokens) * field.weight;
  }
  return total;
};

export const fuzzyMatches = (query: string, fields: readonly FuzzyField[]): boolean =>
  fuzzyScore(query, fields) > 0;
