"use client";

import { useEffect, useRef, useState } from "react";
import type { Flashcard } from "@/lib/content/schema";
import { deckStats, shuffleSeeded, type Mark } from "@/lib/deck";

/**
 * Fixed first-run seed: the server-rendered (prerendered) card order must match
 * hydration, so the initial shuffle can't be random. Restart bumps the seed,
 * which reshuffles deterministically into a different order.
 */
const INITIAL_SEED = 1;

interface FlashcardDeckProps {
  /** Cards for this deck (validated upstream by the content layer). */
  cards: Flashcard[];
  /** Deck the cards belong to (used by progress wiring in a later task). */
  deckId: string;
  /**
   * Optional hook fired when a card is marked. Progress persistence wires
   * through this later — this component never touches storage itself.
   */
  onMark?: (cardId: string, mark: "again" | "gotit") => void;
}

/**
 * Flashcard deck: one card at a time — click/tap (or Enter/Space on the
 * focused card, which is a native button) flips front→back; "Again" / "Got it"
 * record the mark and advance. A live header shows progress (done/total) and
 * per-mark counts; finishing shows a summary with a restart control that
 * reshuffles under a new seed.
 */
export function FlashcardDeck({ cards, deckId, onMark }: FlashcardDeckProps) {
  const [seed, setSeed] = useState(INITIAL_SEED);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [marks, setMarks] = useState<Record<string, Mark>>({});

  // Deterministic per seed, so recomputing on every render is safe and cheap
  // (and memoization could never change the outcome anyway).
  const order = shuffleSeeded(cards, seed);
  const stats = deckStats(cards.map((c) => c.id), marks);
  const complete = stats.total > 0 && stats.done >= stats.total;
  const card = order[index];

  const frontRef = useRef<HTMLButtonElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  // Keyboard flow: after a flip, focus lands on the card back (not directly on
  // "Again", so a habitual second Enter can't mis-mark); after a mark, focus
  // lands on the next card front. The initial render steals no focus.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (flipped) backRef.current?.focus();
    else frontRef.current?.focus();
  }, [flipped, index]);

  function choose(mark: Mark) {
    if (!card) return;
    setMarks((prev) => ({ ...prev, [card.id]: mark }));
    onMark?.(card.id, mark);
    setFlipped(false);
    setIndex((i) => i + 1);
  }

  function restart() {
    setMarks({});
    setIndex(0);
    setFlipped(false);
    setSeed((s) => s + 1);
  }

  if (cards.length === 0) {
    return (
      <div data-deck-id={deckId}>
        <p className="font-mono text-xs text-muted">[empty] no cards</p>
      </div>
    );
  }

  if (complete) {
    return (
      <div data-deck-id={deckId} className="space-y-4">
        <div className="rounded-lg border border-line p-4">
          <p className="font-mono text-xs text-accent">[done] deck complete</p>
          <p className="mt-1 text-sm text-foreground">
            <span>{stats.gotit} got it</span> · <span>{stats.again} again</span>
          </p>
          <button
            type="button"
            onClick={restart}
            className="mt-3 rounded border border-line px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:border-accent hover:text-accent"
          >
            Restart
          </button>
        </div>
      </div>
    );
  }

  return (
    <div data-deck-id={deckId} className="space-y-4">
      <div className="flex items-center justify-between font-mono text-xs text-muted">
        <span>
          {stats.done}/{stats.total}
        </span>
        <span className="flex gap-3">
          <span>{stats.again} again</span>
          <span>{stats.gotit} got it</span>
        </span>
      </div>

      {!flipped ? (
        <>
          <button
            ref={frontRef}
            type="button"
            onClick={() => setFlipped(true)}
            className="block w-full rounded-lg border border-line p-4 text-left text-sm text-foreground transition-colors hover:border-accent/60 sm:p-5"
          >
            {card.front}
          </button>
          <p className="font-mono text-xs text-muted">click to flip (Enter/Space works too)</p>
        </>
      ) : (
        <div
          ref={backRef}
          role="group"
          aria-label="Card back"
          tabIndex={-1}
          className="rounded-lg border border-accent/40 p-4 outline-none focus:outline-none sm:p-5"
        >
          <p className="text-sm text-foreground">{card.back}</p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => choose("again")}
              className="rounded border border-line px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:border-accent hover:text-accent"
            >
              Again
            </button>
            <button
              type="button"
              onClick={() => choose("gotit")}
              className="rounded border border-accent px-3 py-1.5 font-mono text-xs text-accent transition-colors hover:bg-accent/10"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
