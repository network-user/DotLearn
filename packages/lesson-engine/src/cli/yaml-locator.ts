import { LineCounter, isMap, isSeq, parseDocument } from 'yaml';

export interface ExerciseLocation {
  id: string;
  line: number;
  column: number;
}

export interface ExerciseLocationIndex {
  byId: Map<string, ExerciseLocation>;
}

const scalarValue = (node: unknown): string | undefined => {
  if (node && typeof node === 'object' && 'value' in node) {
    const value = (node as { value: unknown }).value;
    return typeof value === 'string' ? value : undefined;
  }
  return undefined;
};

export const indexExerciseLocations = (raw: string): ExerciseLocationIndex => {
  const byId = new Map<string, ExerciseLocation>();
  const lineCounter = new LineCounter();
  let document;
  try {
    document = parseDocument(raw, { lineCounter });
  } catch {
    return { byId };
  }
  const contents = document.contents;
  if (!isMap(contents)) {
    return { byId };
  }
  const exercises = contents.get('exercises', true);
  if (!isSeq(exercises)) {
    return { byId };
  }
  for (const item of exercises.items) {
    if (!isMap(item)) {
      continue;
    }
    const idNode = item.get('id', true);
    const id = scalarValue(idNode);
    if (id === undefined) {
      continue;
    }
    const idRange =
      idNode && typeof idNode === 'object' && 'range' in idNode
        ? (idNode as { range?: [number, number, number] }).range
        : undefined;
    const offset = idRange?.[0] ?? item.range?.[0] ?? 0;
    const position = lineCounter.linePos(offset);
    byId.set(id, { id, line: position.line, column: position.col });
  }
  return { byId };
};

export const locateExercise = (
  index: ExerciseLocationIndex | undefined,
  id: string,
): ExerciseLocation | undefined => index?.byId.get(id);
