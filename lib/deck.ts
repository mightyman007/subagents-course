/**
 * Flashcard deck mechanics: seeded shuffling + mark counting.
 *
 * Pure functions, safe to import from client components — no DOM, no storage,
 * and (like `lib/quiz.ts`) the only content-layer dependency is type-level.
 *
 * Shuffle semantics (binding):
 * - Deterministic per seed: same seed + same input ⇒ same output order.
 * - Full permutation: no cards lost, none duplicated.
 * - Pure: the input array is never mutated; a new array is returned.
 * - The seed is coerced to uint32 (`seed >>> 0`), so any number works.
 */

/** A reader's mark on a flashcard. */
export type Mark = "again" | "gotit";

/**
 * mulberry32 PRNG: tiny, fast, deterministic — 32-bit state derived from an
 * integer seed. Returns floats in [0, 1).
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Seeded Fisher-Yates shuffle. Same `seed` always yields the same permutation
 * of `items`; the input array is left untouched.
 */
export function shuffleSeeded<T>(items: T[], seed: number): T[] {
  const out = [...items];
  const rand = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Aggregate counts over a deck from the reader's marks (keyed by card id).
 * Marks for ids that aren't in the deck are ignored (stale persisted marks
 * must never inflate a deck's numbers).
 */
export function deckStats(
  cardIds: readonly string[],
  marks: Readonly<Record<string, Mark>>,
): { total: number; done: number; remaining: number; again: number; gotit: number } {
  const known = new Set(cardIds);
  let again = 0;
  let gotit = 0;
  for (const id of known) {
    const mark = marks[id];
    if (mark === "again") again += 1;
    else if (mark === "gotit") gotit += 1;
  }
  const done = again + gotit;
  return { total: known.size, done, remaining: known.size - done, again, gotit };
}
