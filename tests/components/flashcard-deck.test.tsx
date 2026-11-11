import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FlashcardDeck } from "@/components/flashcard-deck";
import { shuffleSeeded } from "@/lib/deck";
import type { Flashcard } from "@/lib/content/schema";

// vitest runs without `globals: true`, so RTL auto-cleanup must be wired here.
afterEach(cleanup);

const cards: Flashcard[] = [
  { id: "c1", front: "front one", back: "back one", tags: [] },
  { id: "c2", front: "front two", back: "back two", tags: [] },
  { id: "c3", front: "front three", back: "back three", tags: [] },
  { id: "c4", front: "front four", back: "back four", tags: [] },
];

// The deck's initial seed is fixed (1) so the server-rendered order matches
// hydration. Pin that contract once, here:
// seed 1 order for this fixture: c4, c2, c1, c3.
const seed1Order = shuffleSeeded(cards, 1).map((c) => c.id);

/** The seed-1 card at `position` in the deck order (throws if the fixture drifts). */
function cardAt(position: number): Flashcard {
  const c = cards.find((x) => x.id === seed1Order[position]);
  if (!c) throw new Error(`fixture card ${seed1Order[position]} missing`);
  return c;
}

/** Flip the named card, then choose Again / Got it. */
function flipAndMark(front: string, choice: "Again" | "Got it") {
  fireEvent.click(screen.getByRole("button", { name: front }));
  fireEvent.click(screen.getByRole("button", { name: choice }));
}

describe("FlashcardDeck", () => {
  it("pins the fixture order for seed 1 (c4, c2, c1, c3)", () => {
    expect(seed1Order).toEqual(["c4", "c2", "c1", "c3"]);
  });

  it("renders header progress 0/4 with zero counts, and only the first card of the seeded order", () => {
    render(<FlashcardDeck cards={cards} deckId="deck-1" />);
    expect(screen.getByText("0/4")).toBeInTheDocument();
    expect(screen.getByText("0 again")).toBeInTheDocument();
    expect(screen.getByText("0 got it")).toBeInTheDocument();

    const first = cardAt(0);
    expect(screen.getByRole("button", { name: first.front })).toBeInTheDocument();
    // One card at a time — the rest are not in the DOM yet.
    for (const c of cards) {
      if (c.id !== first.id) expect(screen.queryByText(c.front)).toBeNull();
    }
  });

  it("card is a real button (Enter/Space activation is the platform contract)", () => {
    render(<FlashcardDeck cards={cards} deckId="deck-1" />);
    const first = cardAt(0);
    expect(screen.getByRole("button", { name: first.front }).tagName).toBe("BUTTON");
  });

  it("clicking the card flips front→back: back text + Again/Got it appear, front button gone, no onMark on flip", () => {
    const onMark = vi.fn();
    render(<FlashcardDeck cards={cards} deckId="deck-1" onMark={onMark} />);
    const first = cardAt(0);

    fireEvent.click(screen.getByRole("button", { name: first.front }));

    expect(screen.queryByRole("button", { name: first.front })).toBeNull();
    expect(screen.getByText(first.back)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Again" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Got it" })).toBeInTheDocument();
    // Focus follows the flip so keyboard users aren't dropped back to <body>.
    expect(screen.getByRole("group", { name: "Card back" })).toHaveFocus();
    expect(onMark).not.toHaveBeenCalled();
  });

  it("Got it records the mark, advances to the next card, and updates counts", () => {
    const onMark = vi.fn();
    render(<FlashcardDeck cards={cards} deckId="deck-1" onMark={onMark} />);

    flipAndMark("front four", "Got it"); // c4 = seed-1 first card

    expect(onMark).toHaveBeenCalledTimes(1);
    expect(onMark).toHaveBeenCalledWith("c4", "gotit");
    expect(screen.getByText("1/4")).toBeInTheDocument();
    expect(screen.getByText("1 got it")).toBeInTheDocument();
    expect(screen.getByText("0 again")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "front two" })).toBeInTheDocument(); // next in seed order
    expect(screen.queryByText("back four")).toBeNull();
  });

  it("Again records its own mark; counts track both marks independently", () => {
    const onMark = vi.fn();
    render(<FlashcardDeck cards={cards} deckId="deck-1" onMark={onMark} />);

    flipAndMark("front four", "Got it"); // c4
    flipAndMark("front two", "Again"); // c2

    expect(onMark).toHaveBeenCalledTimes(2);
    expect(onMark).toHaveBeenNthCalledWith(2, "c2", "again");
    expect(screen.getByText("2/4")).toBeInTheDocument();
    expect(screen.getByText("1 got it")).toBeInTheDocument();
    expect(screen.getByText("1 again")).toBeInTheDocument();
  });

  it("marking every card shows the end-of-deck summary (counts, no play UI) and fires onMark per card", () => {
    const onMark = vi.fn();
    render(<FlashcardDeck cards={cards} deckId="deck-1" onMark={onMark} />);

    flipAndMark("front four", "Got it"); // c4
    flipAndMark("front two", "Again"); // c2
    flipAndMark("front one", "Got it"); // c1
    flipAndMark("front three", "Again"); // c3

    expect(onMark).toHaveBeenCalledTimes(4);
    expect(screen.getByText("[done] deck complete")).toBeInTheDocument();
    expect(screen.getByText("2 got it")).toBeInTheDocument();
    expect(screen.getByText("2 again")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restart" })).toBeInTheDocument();
    // Play UI is fully replaced by the summary.
    expect(screen.queryByRole("button", { name: "Again" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Got it" })).toBeNull();
    expect(screen.queryByText("4/4")).toBeNull();
  });

  it("Restart resets counts and reshuffles with a new seed (first card changes)", () => {
    const onMark = vi.fn();
    render(<FlashcardDeck cards={cards} deckId="deck-1" onMark={onMark} />);

    flipAndMark("front four", "Got it"); // c4
    flipAndMark("front two", "Got it"); // c2
    flipAndMark("front one", "Got it"); // c1
    flipAndMark("front three", "Got it"); // c3
    expect(screen.getByText("[done] deck complete")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Restart" }));

    expect(screen.getByText("0/4")).toBeInTheDocument();
    expect(screen.getByText("0 again")).toBeInTheDocument();
    expect(screen.getByText("0 got it")).toBeInTheDocument();
    expect(screen.queryByText("[done] deck complete")).toBeNull();
    // New seed ⇒ reshuffled: the first card differs from the seed-1 first card.
    const second = shuffleSeeded(cards, 2)[0];
    expect(second.id).not.toBe(seed1Order[0]);
    expect(screen.getByRole("button", { name: second.front })).toBeInTheDocument();
    // Restart clears marks locally; it is not a mark event.
    expect(onMark).toHaveBeenCalledTimes(4);
  });

  it("empty deck renders an empty state instead of crashing", () => {
    render(<FlashcardDeck cards={[]} deckId="deck-1" />);
    expect(screen.getByText("[empty] no cards")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
