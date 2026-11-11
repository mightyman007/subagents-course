import { describe, it, expect } from "vitest";
import { deckStats, shuffleSeeded, type Mark } from "@/lib/deck";

// 8 distinct cards — big enough that a broken shuffle (no-op, lossy, duping)
// can't slip through the permutation assertions.
const ids = ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"];
const cards = ids.map((id) => ({ id }));
const byId = (xs: Array<{ id: string }>) => xs.map((x) => x.id);

describe("shuffleSeeded", () => {
  it("same seed ⇒ same order (deterministic)", () => {
    expect(shuffleSeeded(cards, 7)).toEqual(shuffleSeeded(cards, 7));
    expect(shuffleSeeded(ids, 12345)).toEqual(shuffleSeeded(ids, 12345));
    expect(shuffleSeeded(ids, 0)).toEqual(shuffleSeeded(ids, 0));
  });

  it("different seeds produce different orders for the fixed fixture pair (seeds 1 vs 2)", () => {
    expect(shuffleSeeded(ids, 1)).not.toEqual(shuffleSeeded(ids, 2));
  });

  it("actually reshuffles: seed 1 ≠ input order on the fixture", () => {
    // Guards against a no-op "shuffle" passing the permutation tests.
    expect(shuffleSeeded(ids, 1)).not.toEqual(ids);
  });

  it("is a permutation: same length, no loss, no dupes (across many seeds)", () => {
    for (let seed = 0; seed < 25; seed++) {
      const out = shuffleSeeded(cards, seed);
      expect(out).toHaveLength(cards.length);
      expect(byId(out).sort()).toEqual([...ids].sort());
    }
  });

  it("does not mutate the input array (pure)", () => {
    const input = [...cards];
    const snapshot = byId(input);
    const out = shuffleSeeded(input, 42);
    expect(byId(input)).toEqual(snapshot); // original order untouched
    expect(out).not.toBe(input); // returns a new array
  });

  it("empty and single-item inputs are returned (as a copy) unchanged", () => {
    expect(shuffleSeeded([], 1)).toEqual([]);
    expect(shuffleSeeded(["only"], 99)).toEqual(["only"]);
  });
});

describe("deckStats", () => {
  it("zero marks → nothing done, everything remaining", () => {
    expect(deckStats(ids, {})).toEqual({
      total: 8,
      done: 0,
      remaining: 8,
      again: 0,
      gotit: 0,
    });
  });

  it("counts again/gotit marks and derives done/remaining", () => {
    const marks: Record<string, Mark> = { c1: "gotit", c2: "again", c3: "gotit" };
    expect(deckStats(ids, marks)).toEqual({
      total: 8,
      done: 3,
      remaining: 5,
      again: 1,
      gotit: 2,
    });
  });

  it("ignores marks for ids outside the deck", () => {
    const marks: Record<string, Mark> = { c1: "gotit", ghost: "again" };
    expect(deckStats(["c1"], marks)).toEqual({
      total: 1,
      done: 1,
      remaining: 0,
      again: 0,
      gotit: 1,
    });
  });

  it("empty deck: zeros everywhere", () => {
    expect(deckStats([], { c1: "again" })).toEqual({
      total: 0,
      done: 0,
      remaining: 0,
      again: 0,
      gotit: 0,
    });
  });
});
