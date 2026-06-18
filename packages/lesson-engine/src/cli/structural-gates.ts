import { exerciseVariantCount, type Exercise } from '@dotlearn/contracts';

import type { ConceptBundle, TopicBundle } from '../loader/source';

export interface StructuralFinding {
  scope: string;
  reason: string;
}

export const languageOfFile = (filename: string): string =>
  /\.([a-z]{2})\.(?:ya?ml|mdx)$/.exec(filename)?.[1] ?? 'unknown';

const expectedShape = (exercise: Exercise): string => {
  switch (exercise.type) {
    case 'sql-query':
    case 'predict-output':
      return `${exercise.type}:${exercise.expected.kind}`;
    case 'theory-quiz':
      return `${exercise.type}:choices=${exercise.choices.length}`;
    case 'python-function':
    case 'javascript-function':
      return `${exercise.type}:cases=${exercise.cases.length}`;
    case 'fill-in-blanks':
      return `${exercise.type}:blanks=${Object.keys(exercise.blanks).length}`;
    case 'git-challenge':
      return `${exercise.type}:goals=${exercise.goal.length}`;
    default:
      return (exercise as Exercise).type;
  }
};

interface ExerciseSignature {
  type: string;
  difficulty: number;
  shape: string;
  variantCount: number;
}

const signature = (exercise: Exercise): ExerciseSignature => ({
  type: exercise.type,
  difficulty: exercise.difficulty,
  shape: expectedShape(exercise),
  variantCount: exerciseVariantCount(exercise),
});

const formatSignature = (sig: ExerciseSignature): string =>
  `type=${sig.type} difficulty=${sig.difficulty} shape=${sig.shape} variants=${sig.variantCount}`;

export const checkSlugUniqueness = (slugs: string[]): StructuralFinding[] => {
  const findings: StructuralFinding[] = [];
  const seen = new Map<string, number>();
  for (const slug of slugs) {
    seen.set(slug, (seen.get(slug) ?? 0) + 1);
  }
  for (const [slug, count] of seen) {
    if (count > 1) {
      findings.push({
        scope: slug,
        reason: `slug "${slug}" is used by ${count} topic directories`,
      });
    }
  }
  return findings;
};

export const checkPrerequisites = (
  manifestSlug: string,
  prerequisites: string[],
  knownSlugs: ReadonlySet<string>,
): StructuralFinding[] => {
  const findings: StructuralFinding[] = [];
  for (const prerequisite of prerequisites) {
    if (prerequisite === manifestSlug) {
      findings.push({
        scope: manifestSlug,
        reason: `prerequisite "${prerequisite}" points at itself`,
      });
      continue;
    }
    if (!knownSlugs.has(prerequisite)) {
      findings.push({
        scope: manifestSlug,
        reason: `prerequisite "${prerequisite}" does not resolve to an existing topic`,
      });
    }
  }
  return findings;
};

const distinctExercisesForConcept = (concept: ConceptBundle): Map<string, Exercise> => {
  const byId = new Map<string, Exercise>();
  for (const file of concept.exercises) {
    for (const exercise of file.exercises) {
      if (!byId.has(exercise.id)) {
        byId.set(exercise.id, exercise);
      }
    }
  }
  return byId;
};

export const checkCoverage = (bundle: TopicBundle): StructuralFinding[] => {
  const findings: StructuralFinding[] = [];
  for (const concept of bundle.concepts) {
    const distinct = distinctExercisesForConcept(concept);
    const exercises = [...distinct.values()];
    const scope = `${bundle.manifest.slug} :: ${concept.conceptId}`;
    if (exercises.length < 3) {
      findings.push({
        scope,
        reason: `concept has ${exercises.length} distinct exercise(s); at least 3 are required`,
      });
    }
    const hasEasy = exercises.some((exercise) => exercise.difficulty <= 2);
    const hasHard = exercises.some((exercise) => exercise.difficulty >= 3);
    if (exercises.length > 0 && !hasEasy) {
      findings.push({ scope, reason: 'concept has no introductory exercise (difficulty <= 2)' });
    }
    if (exercises.length > 0 && !hasHard) {
      findings.push({ scope, reason: 'concept has no consolidation exercise (difficulty >= 3)' });
    }
  }
  return findings;
};

export const checkLanguageParity = (bundle: TopicBundle): StructuralFinding[] => {
  const findings: StructuralFinding[] = [];
  for (const concept of bundle.concepts) {
    const byLanguage = new Map<string, Map<string, ExerciseSignature>>();
    for (const file of concept.exercises) {
      const language = languageOfFile(file.filename);
      const perLanguage = byLanguage.get(language) ?? new Map<string, ExerciseSignature>();
      for (const exercise of file.exercises) {
        perLanguage.set(exercise.id, signature(exercise));
      }
      byLanguage.set(language, perLanguage);
    }
    const languages = [...byLanguage.keys()].sort();
    if (languages.length < 2) {
      continue;
    }
    const [reference, ...rest] = languages;
    const referenceMap = byLanguage.get(reference as string) as Map<string, ExerciseSignature>;
    for (const other of rest) {
      const otherMap = byLanguage.get(other) as Map<string, ExerciseSignature>;
      const scopeBase = `${bundle.manifest.slug} :: ${concept.conceptId}`;
      for (const id of referenceMap.keys()) {
        if (!otherMap.has(id)) {
          findings.push({
            scope: `${scopeBase} :: ${id}`,
            reason: `exercise present in "${reference}" but missing in "${other}"`,
          });
        }
      }
      for (const id of otherMap.keys()) {
        if (!referenceMap.has(id)) {
          findings.push({
            scope: `${scopeBase} :: ${id}`,
            reason: `exercise present in "${other}" but missing in "${reference}"`,
          });
        }
      }
      for (const [id, referenceSignature] of referenceMap) {
        const otherSignature = otherMap.get(id);
        if (!otherSignature) {
          continue;
        }
        if (
          referenceSignature.type !== otherSignature.type ||
          referenceSignature.difficulty !== otherSignature.difficulty ||
          referenceSignature.shape !== otherSignature.shape ||
          referenceSignature.variantCount !== otherSignature.variantCount
        ) {
          findings.push({
            scope: `${scopeBase} :: ${id}`,
            reason: `structure differs across languages — "${reference}": ${formatSignature(
              referenceSignature,
            )} vs "${other}": ${formatSignature(otherSignature)}`,
          });
        }
      }
    }
  }
  return findings;
};
