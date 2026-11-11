import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import {
  DeckProgressBridge,
  DoneMarker,
  QuizProgressBridge,
} from "@/components/progress-hooks";
import type { Flashcard, Question } from "@/lib/content/schema";
import { DEFAULT_PROGRESS, KEY } from "@/lib/progress";

// vitest runs without `globals: true`, so RTL auto-cleanup must be wired here;
// localStorage is cleared too — the progress store is global per test file.
afterEach(() => {
  cleanup();
  localStorage.clear();
});

const questions: Question[] = [
  {
    id: "q1",
    type: "single",
    prompt: "One?",
    options: ["a1", "b1"],
    correct: [0],
    explanation: "a1 is right",
  },
  {
    id: "q2",
    type: "single",
    prompt: "Two?",
    options: ["a2", "b2"],
    correct: [0],
    explanation: "a2 is right",
  },
  {
    id: "q3",
    type: "single",
    prompt: "Three?",
    options: ["a3", "b3"],
    correct: [0],
    explanation: "a3 is right",
  },
];

const cards: Flashcard[] = [
  { id: "k1", front: "front one", back: "back one", tags: [] },
  { id: "k2", front: "front two", back: "back two", tags: [] },
];

function stored(): Record<string, unknown> {
  const raw = localStorage.getItem(KEY);
  return raw === null ? {} : (JSON.parse(raw) as Record<string, unknown>);
}

function answerAll(correctly: boolean) {
  const pick = correctly ? "a" : "b";
  const prompts: [string, string][] = [
    ["One?", "1"],
    ["Two?", "2"],
    ["Three?", "3"],
  ];
  for (const [prompt, n] of prompts) {
    const g = within(screen.getByRole("group", { name: prompt }));
    fireEvent.click(g.getByRole("button", { name: `${pick}${n}` }));
    fireEvent.click(g.getByRole("button", { name: "Submit" }));
  }
}

describe("QuizProgressBridge", () => {
  it("records the quiz score AND auto-marks the chapter done at ≥60%", async () => {
    render(<QuizProgressBridge chapterId="ch-x" questions={questions} />);
    answerAll(true); // 3/3 = 100%

    await waitFor(() => {
      const data = stored();
      expect(data.quizzes).toEqual({ "ch-x": { score: 3, total: 3 } });
      expect(data.chaptersDone).toEqual(["ch-x"]);
    });
  });

  it("records a sub-threshold score without marking the chapter done", async () => {
    render(<QuizProgressBridge chapterId="ch-x" questions={questions} />);
    answerAll(false); // 0/3 = 0%

    await waitFor(() => {
      const data = stored();
      expect(data.quizzes).toEqual({ "ch-x": { score: 0, total: 3 } });
      expect(data.chaptersDone).toEqual([]);
    });
  });

  it("shows the previously recorded attempt once progress loads", async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ ...DEFAULT_PROGRESS, quizzes: { "ch-x": { score: 2, total: 3 } } }),
    );
    render(<QuizProgressBridge chapterId="ch-x" questions={questions} />);
    expect(screen.queryByText(/last attempt/)).toBeNull(); // no flash of stored data
    await waitFor(() => expect(screen.getByText(/last attempt: 2\/3/)).toBeInTheDocument());
  });
});

describe("DeckProgressBridge", () => {
  it("persists a card mark to the store", async () => {
    render(<DeckProgressBridge deckId="ch-x" cards={cards} />);
    fireEvent.click(screen.getByRole("button", { name: "front one" }));
    fireEvent.click(screen.getByRole("button", { name: "Got it" }));

    await waitFor(() => {
      expect(stored().cards).toEqual({ k1: "gotit" });
    });
  });

  it("shows how many of this deck's cards were marked in earlier runs", async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ ...DEFAULT_PROGRESS, cards: { k1: "again", k2: "gotit" } }),
    );
    render(<DeckProgressBridge deckId="ch-x" cards={cards} />);
    await waitFor(() =>
      expect(screen.getByText(/2\/2 cards marked in earlier runs/)).toBeInTheDocument(),
    );
  });
});

describe("DoneMarker", () => {
  it("resolves to 'done' when the chapter is in chaptersDone", async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ ...DEFAULT_PROGRESS, chaptersDone: ["ch-x"] }),
    );
    render(<DoneMarker chapterId="ch-x" />);
    await waitFor(() => expect(screen.getByText("done")).toBeInTheDocument());
  });

  it("resolves to 'pending' for an unfinished chapter", async () => {
    render(<DoneMarker chapterId="ch-x" />);
    await waitFor(() => expect(screen.getByText("pending")).toBeInTheDocument());
  });
});
