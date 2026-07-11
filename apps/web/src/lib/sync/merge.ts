// Pure merge core for cross-device progress sync.
//
// The sync engine pulls the remote snapshot, merges it with the local export, applies the
// result, and pushes it back. This module is that merge: given two snapshots it produces a
// third that is
//   - symmetric:        mergeSnapshots(a, b) deep-equals mergeSnapshots(b, a)
//   - idempotent:       re-merging the result with either input changes nothing
//   - order-independent so two devices that see the same set of edits (in any order) converge
//     on byte-identical state.
//
// It is deliberately dependency-free at runtime: only *type* imports (which erase at compile
// time), no Dexie, no DOM. That keeps it trivially unit-testable and safe to run inside the
// engine's leader tab without touching IndexedDB.
//
// Conflict resolution is per-table (see the merge table in the approved plan). Most tables
// union by key; the genuinely conflicting ones (reading positions, note text, settings) are
// last-writer-wins by an explicit timestamp field. LWW ties (equal timestamp, different
// content) are broken by taking the record whose canonical serialization sorts first: both
// devices compute the same winner without any per-record device id (snapshots carry none).

import type { ProgressExport } from '../progress-io';

/** The blob the engine pushes: a v5 progress export plus an optional top-level device tag. */
export type SyncSnapshot = ProgressExport & { syncDeviceId?: string };

type Rec = Record<string, unknown>;

const SNAPSHOT_VERSION = 5;

// --- primitives ------------------------------------------------------------------------------

const isObject = (value: unknown): value is Rec =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === 'string';

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const toArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const parseTime = (value: unknown, fallback: number): number => {
  if (typeof value !== 'string') return fallback;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? fallback : ms;
};

// Later of two ISO strings. Equal (or both unparseable) falls back to the lexicographically
// larger string so the choice is still deterministic.
const maxIso = (a: unknown, b: unknown): string => {
  const ta = parseTime(a, Number.NEGATIVE_INFINITY);
  const tb = parseTime(b, Number.NEGATIVE_INFINITY);
  if (ta > tb) return a as string;
  if (tb > ta) return b as string;
  const sa = typeof a === 'string' ? a : '';
  const sb = typeof b === 'string' ? b : '';
  return sa >= sb ? sa : sb;
};

// Earlier of two ISO strings, deterministic on ties.
const minIso = (a: unknown, b: unknown): string => {
  const ta = parseTime(a, Number.POSITIVE_INFINITY);
  const tb = parseTime(b, Number.POSITIVE_INFINITY);
  if (ta < tb) return a as string;
  if (tb < ta) return b as string;
  const sa = typeof a === 'string' ? a : '';
  const sb = typeof b === 'string' ? b : '';
  return sa <= sb ? sa : sb;
};

// --- canonical serialization ------------------------------------------------------------------

// Rebuilds a value with every object's keys sorted (recursively) and undefined members dropped,
// so structurally-equal states serialize byte-identically regardless of key insertion order.
// Array order is preserved on purpose - arrays are ordered data.
const sortValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortValue);
  if (isObject(value)) {
    const out: Rec = {};
    for (const key of Object.keys(value).sort()) {
      const child = value[key];
      if (child === undefined) continue;
      out[key] = sortValue(child);
    }
    return out;
  }
  return value;
};

const stableStringify = (value: unknown): string => {
  const json: string | undefined = JSON.stringify(sortValue(value));
  return json ?? 'null';
};

/** Stable serialization (recursively sorted object keys) - equal states give equal strings. */
export const canonicalStringify = (snapshot: SyncSnapshot): string => stableStringify(snapshot);

/**
 * Fast synchronous content hash (FNV-1a family, two lanes -> 16 hex chars) over the canonical
 * serialization. The engine uses it to skip no-op pushes; a collision would at worst drop one
 * push and self-heals on the next real change, so 64 bits is ample.
 */
export const snapshotHash = (snapshot: SyncSnapshot): string => {
  const str = canonicalStringify(snapshot);
  let h1 = 0x811c9dc5;
  let h2 = 0x1000193b | 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x85ebca77);
  }
  const hex = (n: number): string => (n >>> 0).toString(16).padStart(8, '0');
  return hex(h1) + hex(h2);
};

// --- shared helpers for the merge specs -------------------------------------------------------

// Picks whichever record's projection over `fields` sorts first canonically. Used to choose the
// "identity" columns (topicSlug/exerciseId/conceptId) of a synthesized record deterministically.
// These columns are derived from the key and equal in practice; the pick only matters if a
// crafted snapshot desyncs them, and being a min over a fixed projection keeps it idempotent.
const pickIdentity = (x: Rec, y: Rec, fields: readonly string[]): Rec => {
  const project = (rec: Rec): Rec => {
    const out: Rec = {};
    for (const f of fields) out[f] = rec[f];
    return out;
  };
  return stableStringify(project(x)) <= stableStringify(project(y)) ? x : y;
};

const hasNonEmptyNote = (rec: Rec): boolean => isString(rec.note) && rec.note.trim().length > 0;

// Sorted, de-duplicated union of two possible string-tag arrays. Sorted (rather than
// insertion-ordered) so the result is independent of merge order - the price is that tag order
// becomes alphabetical once a bookmark has been merged, which is acceptable for labels.
const unionSortedTags = (a: unknown, b: unknown): string[] => {
  const set = new Set<string>();
  for (const source of [a, b]) {
    if (!Array.isArray(source)) continue;
    for (const tag of source) if (isString(tag)) set.add(tag);
  }
  return [...set].sort();
};

// --- keyed-table merge ------------------------------------------------------------------------

interface KeyedSpec {
  // Validates + normalizes one record to its canonical single-record form (or null to drop it).
  // Invariant every spec upholds: combine(parse(r), parse(r)) deep-equals parse(r).
  parse: (raw: unknown) => Rec | null;
  key: (rec: Rec) => string;
  combine: (x: Rec, y: Rec) => Rec;
  sortTime: (rec: Rec) => number;
}

const mergeKeyed = (a: unknown[], b: unknown[], spec: KeyedSpec): Rec[] => {
  const groups = new Map<string, Rec>();
  const consume = (raw: unknown): void => {
    const rec = spec.parse(raw);
    if (!rec) return;
    const k = spec.key(rec);
    const existing = groups.get(k);
    groups.set(k, existing ? spec.combine(existing, rec) : rec);
  };
  for (const raw of a) consume(raw);
  for (const raw of b) consume(raw);
  const out = [...groups.values()];
  out.sort((x, y) => {
    const tx = spec.sortTime(x);
    const ty = spec.sortTime(y);
    if (tx !== ty) return tx - ty;
    const kx = spec.key(x);
    const ky = spec.key(y);
    return kx < ky ? -1 : kx > ky ? 1 : 0;
  });
  return out;
};

// Last-writer-wins by a timestamp field, whole winning record kept verbatim. Ties (equal
// timestamp, different content) go to the canonically-smaller record so both devices agree.
const lwwByField =
  (field: string) =>
  (x: Rec, y: Rec): Rec => {
    const tx = parseTime(x[field], 0);
    const ty = parseTime(y[field], 0);
    if (tx !== ty) return tx > ty ? x : y;
    return stableStringify(x) <= stableStringify(y) ? x : y;
  };

const ACTIVITY_COUNTERS = [
  'exercisesAttempted',
  'exercisesPassed',
  'interviewStudied',
  'cardsReviewed',
  'conceptsRead',
  'focusBlocks',
] as const;

const progressSpec: KeyedSpec = {
  parse: (raw) => {
    if (!isObject(raw)) return null;
    const { id, topicSlug, exerciseId, status, attempts, lastAttemptAt } = raw;
    if (!isString(id) || !isString(topicSlug) || !isString(exerciseId)) return null;
    if (status !== 'pass' && status !== 'fail') return null;
    if (!isFiniteNumber(attempts) || !isString(lastAttemptAt)) return null;
    return { id, topicSlug, exerciseId, status, attempts, lastAttemptAt };
  },
  key: (rec) => rec.id as string,
  combine: (x, y) => {
    const idSrc = pickIdentity(x, y, ['topicSlug', 'exerciseId']);
    return {
      id: x.id,
      topicSlug: idSrc.topicSlug,
      exerciseId: idSrc.exerciseId,
      status: x.status === 'pass' || y.status === 'pass' ? 'pass' : 'fail',
      attempts: Math.max(x.attempts as number, y.attempts as number),
      lastAttemptAt: maxIso(x.lastAttemptAt, y.lastAttemptAt),
    };
  },
  sortTime: (rec) => parseTime(rec.lastAttemptAt, 0),
};

const activitySpec: KeyedSpec = {
  parse: (raw) => {
    if (!isObject(raw) || !isString(raw.day)) return null;
    const out: Rec = { day: raw.day };
    for (const counter of ACTIVITY_COUNTERS) {
      if (isFiniteNumber(raw[counter])) out[counter] = raw[counter];
    }
    return out;
  },
  key: (rec) => rec.day as string,
  combine: (x, y) => {
    const out: Rec = { day: x.day };
    for (const counter of ACTIVITY_COUNTERS) {
      const hasX = counter in x;
      const hasY = counter in y;
      if (hasX || hasY) {
        out[counter] = Math.max(
          hasX ? (x[counter] as number) : 0,
          hasY ? (y[counter] as number) : 0,
        );
      }
    }
    return out;
  },
  sortTime: (rec) => parseTime(rec.day, 0),
};

const flashcardSpec: KeyedSpec = {
  parse: (raw) => (isObject(raw) && isString(raw.id) ? raw : null),
  key: (rec) => rec.id as string,
  combine: (x, y) => {
    const tx = parseTime(x.lastReviewAt, 0);
    const ty = parseTime(y.lastReviewAt, 0);
    if (tx !== ty) return tx > ty ? x : y;
    const rx = isFiniteNumber(x.reps) ? x.reps : 0;
    const ry = isFiniteNumber(y.reps) ? y.reps : 0;
    if (rx !== ry) return rx > ry ? x : y;
    const dx = parseTime(x.due, 0);
    const dy = parseTime(y.due, 0);
    if (dx !== dy) return dx > dy ? x : y;
    return stableStringify(x) <= stableStringify(y) ? x : y;
  },
  sortTime: (rec) => parseTime(rec.lastReviewAt, 0),
};

const interviewSpec: KeyedSpec = {
  parse: (raw) => {
    if (!isObject(raw) || !isFiniteNumber(raw.id) || !isString(raw.studiedAt)) return null;
    return { id: raw.id, studiedAt: raw.studiedAt };
  },
  key: (rec) => String(rec.id),
  combine: (x, y) => ({ id: x.id, studiedAt: minIso(x.studiedAt, y.studiedAt) }),
  sortTime: (rec) => parseTime(rec.studiedAt, 0),
};

const topicPlaceSpec: KeyedSpec = {
  parse: (raw) => {
    if (!isObject(raw)) return null;
    if (!isString(raw.topicSlug) || !isString(raw.conceptId) || !isString(raw.updatedAt))
      return null;
    return raw;
  },
  key: (rec) => rec.topicSlug as string,
  combine: lwwByField('updatedAt'),
  sortTime: (rec) => parseTime(rec.updatedAt, 0),
};

const conceptNotesSpec: KeyedSpec = {
  parse: (raw) => (isObject(raw) && isString(raw.id) && isString(raw.updatedAt) ? raw : null),
  key: (rec) => rec.id as string,
  combine: lwwByField('updatedAt'),
  sortTime: (rec) => parseTime(rec.updatedAt, 0),
};

const bookmarksSpec: KeyedSpec = {
  parse: (raw) => {
    if (!isObject(raw)) return null;
    if (!isString(raw.id) || !isString(raw.topicSlug) || !isString(raw.conceptId)) return null;
    if (!isString(raw.createdAt)) return null;
    const out: Rec = {
      id: raw.id,
      topicSlug: raw.topicSlug,
      conceptId: raw.conceptId,
      createdAt: raw.createdAt,
    };
    const tags = unionSortedTags(raw.tags, undefined);
    if (tags.length > 0) out.tags = tags;
    return out;
  },
  key: (rec) => rec.id as string,
  combine: (x, y) => {
    const idSrc = pickIdentity(x, y, ['topicSlug', 'conceptId']);
    const out: Rec = {
      id: x.id,
      topicSlug: idSrc.topicSlug,
      conceptId: idSrc.conceptId,
      createdAt: minIso(x.createdAt, y.createdAt),
    };
    const tags = unionSortedTags(x.tags, y.tags);
    if (tags.length > 0) out.tags = tags;
    return out;
  },
  sortTime: (rec) => parseTime(rec.createdAt, 0),
};

const conceptReadSpec: KeyedSpec = {
  parse: (raw) => {
    if (!isObject(raw)) return null;
    if (!isString(raw.id) || !isString(raw.topicSlug) || !isString(raw.conceptId)) return null;
    if (!isString(raw.readAt)) return null;
    return { id: raw.id, topicSlug: raw.topicSlug, conceptId: raw.conceptId, readAt: raw.readAt };
  },
  key: (rec) => rec.id as string,
  combine: (x, y) => {
    const idSrc = pickIdentity(x, y, ['topicSlug', 'conceptId']);
    return {
      id: x.id,
      topicSlug: idSrc.topicSlug,
      conceptId: idSrc.conceptId,
      readAt: minIso(x.readAt, y.readAt),
    };
  },
  sortTime: (rec) => parseTime(rec.readAt, 0),
};

const conceptScrollSpec: KeyedSpec = {
  parse: (raw) => (isObject(raw) && isString(raw.id) && isString(raw.updatedAt) ? raw : null),
  key: (rec) => rec.id as string,
  combine: lwwByField('updatedAt'),
  sortTime: (rec) => parseTime(rec.updatedAt, 0),
};

const highlightsSpec: KeyedSpec = {
  parse: (raw) => (isObject(raw) && isString(raw.id) ? raw : null),
  key: (rec) => rec.id as string,
  combine: (x, y) => {
    const nx = hasNonEmptyNote(x);
    const ny = hasNonEmptyNote(y);
    if (nx !== ny) return nx ? x : y;
    return stableStringify(x) <= stableStringify(y) ? x : y;
  },
  sortTime: (rec) => parseTime(rec.createdAt, 0),
};

const achievementsSpec: KeyedSpec = {
  parse: (raw) => {
    if (!isObject(raw) || !isString(raw.id) || !isString(raw.unlockedAt)) return null;
    return { id: raw.id, unlockedAt: raw.unlockedAt };
  },
  key: (rec) => rec.id as string,
  combine: (x, y) => ({ id: x.id, unlockedAt: minIso(x.unlockedAt, y.unlockedAt) }),
  sortTime: (rec) => parseTime(rec.unlockedAt, 0),
};

// Immutable rows: same id => same content, so any deterministic pick works. Canonical-min keeps
// it symmetric even if a crafted snapshot desyncs two rows that share an id.
const immutableUnionCombine = (x: Rec, y: Rec): Rec =>
  stableStringify(x) <= stableStringify(y) ? x : y;

const examResultsSpec: KeyedSpec = {
  parse: (raw) => (isObject(raw) && isString(raw.id) ? raw : null),
  key: (rec) => rec.id as string,
  combine: immutableUnionCombine,
  sortTime: (rec) => parseTime(rec.finishedAt, 0),
};

const userCardsSpec: KeyedSpec = {
  parse: (raw) => (isObject(raw) && isString(raw.id) ? raw : null),
  key: (rec) => rec.id as string,
  combine: immutableUnionCombine,
  sortTime: (rec) => parseTime(rec.createdAt, 0),
};

const reExamSpec: KeyedSpec = {
  parse: (raw) => (isObject(raw) && isString(raw.id) && isString(raw.updatedAt) ? raw : null),
  key: (rec) => rec.id as string,
  combine: lwwByField('updatedAt'),
  sortTime: (rec) => parseTime(rec.updatedAt, 0),
};

// --- content-keyed (auto-increment ++id) merge ------------------------------------------------

interface ContentSpec {
  parse: (raw: unknown) => Rec | null;
  contentKey: (rec: Rec) => string;
  cap?: number;
}

const dropId = (rec: Rec): Rec => {
  if (!('id' in rec)) return rec;
  const { id: _id, ...rest } = rec;
  return rest;
};

// attemptEvents / checkpointResults use Dexie ++id, so ids are meaningless across devices. We
// drop the id, dedup by a content key covering every value-bearing field, sort ascending by
// `at`, then (attemptEvents only) cap to the newest N. Because the cap keeps the newest rows,
// re-merging can never resurrect a trimmed row past the boundary, so the trim stays idempotent.
const mergeContent = (a: unknown[], b: unknown[], spec: ContentSpec): Rec[] => {
  const groups = new Map<string, Rec>();
  const consume = (raw: unknown): void => {
    const parsed = spec.parse(raw);
    if (!parsed) return;
    const rec = dropId(parsed);
    const k = spec.contentKey(rec);
    const existing = groups.get(k);
    if (!existing || stableStringify(rec) < stableStringify(existing)) groups.set(k, rec);
  };
  for (const raw of a) consume(raw);
  for (const raw of b) consume(raw);
  let out = [...groups.values()];
  out.sort((x, y) => {
    const tx = parseTime(x.at, 0);
    const ty = parseTime(y.at, 0);
    if (tx !== ty) return tx - ty;
    const kx = spec.contentKey(x);
    const ky = spec.contentKey(y);
    return kx < ky ? -1 : kx > ky ? 1 : 0;
  });
  if (spec.cap !== undefined && out.length > spec.cap) out = out.slice(out.length - spec.cap);
  return out;
};

const ATTEMPT_EVENT_CAP = 4000;

const attemptEventSpec: ContentSpec = {
  parse: (raw) => {
    if (!isObject(raw)) return null;
    if (!isString(raw.topicSlug) || !isString(raw.exerciseId)) return null;
    if (!isString(raw.concept) || !isString(raw.difficulty)) return null;
    if (raw.status !== 'pass' && raw.status !== 'fail') return null;
    if (!isString(raw.at)) return null;
    return raw;
  },
  contentKey: (rec) =>
    [
      rec.at,
      rec.topicSlug,
      rec.exerciseId,
      rec.concept,
      rec.difficulty,
      rec.status,
      rec.mode ?? '',
      rec.hintsRevealed ?? '',
      rec.durationMs ?? '',
      rec.confidence ?? '',
    ].join(' '),
  cap: ATTEMPT_EVENT_CAP,
};

const checkpointSpec: ContentSpec = {
  parse: (raw) => {
    if (!isObject(raw)) return null;
    if (!isString(raw.topicSlug) || !isString(raw.conceptId)) return null;
    if (raw.status !== 'pass' && raw.status !== 'fail') return null;
    if (!isString(raw.at)) return null;
    return raw;
  },
  // Covers every value-bearing column of CheckpointResultRecord (absent `source` defaults to
  // 'checkpoint' per the interface). conceptTitle is placed last - the only free-text field -
  // so leading fixed-format tokens keep the joined key collision-free.
  contentKey: (rec) =>
    [
      rec.at,
      rec.topicSlug,
      rec.conceptId,
      rec.status,
      rec.source ?? 'checkpoint',
      rec.recalled ?? '',
      rec.total ?? '',
      rec.confidence ?? '',
      rec.conceptTitle ?? '',
    ].join(' '),
};

// --- settings ---------------------------------------------------------------------------------

const hasSettings = (snap: SyncSnapshot): boolean => {
  const value = snap.settings as unknown;
  return value !== undefined && value !== null;
};

// Deterministic, merge-stable winner used when settings alone can't decide (equal settings, or
// neither side has settings). Tie key uses only fields that become fixed points after a merge
// (exportedAt/settings/syncDeviceId) so re-merging never flips the choice.
const snapshotTieWinner = (a: SyncSnapshot, b: SyncSnapshot): SyncSnapshot => {
  const ta = parseTime(a.exportedAt, Number.NEGATIVE_INFINITY);
  const tb = parseTime(b.exportedAt, Number.NEGATIVE_INFINITY);
  if (ta !== tb) return ta > tb ? a : b;
  const tieKey = (s: SyncSnapshot): string =>
    stableStringify({
      exportedAt: typeof s.exportedAt === 'string' ? s.exportedAt : '',
      settings: (s.settings as unknown) ?? null,
      syncDeviceId: s.syncDeviceId ?? '',
    });
  return tieKey(a) <= tieKey(b) ? a : b;
};

// Chooses which snapshot's settings (and syncDeviceId) the merged result carries. "One side
// lacks settings -> take the other" wins over the exportedAt comparison; equal or absent
// settings fall back to the merge-stable tiebreak.
const settingsWinner = (a: SyncSnapshot, b: SyncSnapshot): SyncSnapshot => {
  const aHas = hasSettings(a);
  const bHas = hasSettings(b);
  if (aHas && !bHas) return a;
  if (bHas && !aHas) return b;
  if (aHas && bHas) {
    const ca = stableStringify(a.settings);
    const cb = stableStringify(b.settings);
    if (ca === cb) return snapshotTieWinner(a, b);
    const ta = parseTime(a.exportedAt, Number.NEGATIVE_INFINITY);
    const tb = parseTime(b.exportedAt, Number.NEGATIVE_INFINITY);
    if (ta !== tb) return ta > tb ? a : b;
    return ca <= cb ? a : b;
  }
  return snapshotTieWinner(a, b);
};

// --- entry point ------------------------------------------------------------------------------

const tableOf = (snap: SyncSnapshot, name: string): unknown[] => {
  const data = (snap as { data?: Rec }).data;
  return toArray(data ? data[name] : undefined);
};

/**
 * Merges two sync snapshots into one. Symmetric, idempotent and order-independent (see the file
 * header). Missing/absent tables are treated as empty; records missing the fields needed for
 * keying or comparison are dropped. The result is a fresh v5 snapshot whose exportedAt is the
 * later of the two and whose settings/syncDeviceId come from the settings winner.
 */
export const mergeSnapshots = (a: SyncSnapshot, b: SyncSnapshot): SyncSnapshot => {
  const data: Record<string, Rec[]> = {
    progress: mergeKeyed(tableOf(a, 'progress'), tableOf(b, 'progress'), progressSpec),
    activity: mergeKeyed(tableOf(a, 'activity'), tableOf(b, 'activity'), activitySpec),
    flashcardReviews: mergeKeyed(
      tableOf(a, 'flashcardReviews'),
      tableOf(b, 'flashcardReviews'),
      flashcardSpec,
    ),
    interviewStudied: mergeKeyed(
      tableOf(a, 'interviewStudied'),
      tableOf(b, 'interviewStudied'),
      interviewSpec,
    ),
    topicPlace: mergeKeyed(tableOf(a, 'topicPlace'), tableOf(b, 'topicPlace'), topicPlaceSpec),
    conceptNotes: mergeKeyed(
      tableOf(a, 'conceptNotes'),
      tableOf(b, 'conceptNotes'),
      conceptNotesSpec,
    ),
    bookmarks: mergeKeyed(tableOf(a, 'bookmarks'), tableOf(b, 'bookmarks'), bookmarksSpec),
    conceptRead: mergeKeyed(tableOf(a, 'conceptRead'), tableOf(b, 'conceptRead'), conceptReadSpec),
    conceptScroll: mergeKeyed(
      tableOf(a, 'conceptScroll'),
      tableOf(b, 'conceptScroll'),
      conceptScrollSpec,
    ),
    highlights: mergeKeyed(tableOf(a, 'highlights'), tableOf(b, 'highlights'), highlightsSpec),
    attemptEvents: mergeContent(
      tableOf(a, 'attemptEvents'),
      tableOf(b, 'attemptEvents'),
      attemptEventSpec,
    ),
    achievements: mergeKeyed(
      tableOf(a, 'achievements'),
      tableOf(b, 'achievements'),
      achievementsSpec,
    ),
    checkpointResults: mergeContent(
      tableOf(a, 'checkpointResults'),
      tableOf(b, 'checkpointResults'),
      checkpointSpec,
    ),
    examResults: mergeKeyed(tableOf(a, 'examResults'), tableOf(b, 'examResults'), examResultsSpec),
    userCards: mergeKeyed(tableOf(a, 'userCards'), tableOf(b, 'userCards'), userCardsSpec),
    reExamSchedule: mergeKeyed(
      tableOf(a, 'reExamSchedule'),
      tableOf(b, 'reExamSchedule'),
      reExamSpec,
    ),
  };

  const winner = settingsWinner(a, b);
  const merged: SyncSnapshot = {
    app: 'dotlearn',
    kind: 'progress-export',
    version: SNAPSHOT_VERSION,
    exportedAt: maxIso(a.exportedAt, b.exportedAt),
    data: data as unknown as ProgressExport['data'],
  };
  // hasSettings guarantees a defined, non-null backup; the cast just sheds the `| undefined`.
  if (hasSettings(winner))
    merged.settings = winner.settings as Exclude<ProgressExport['settings'], undefined>;
  if (winner.syncDeviceId !== undefined) merged.syncDeviceId = winner.syncDeviceId;
  return merged;
};
