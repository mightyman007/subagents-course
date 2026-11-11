import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import {
  DeckProgressBridge,
  DoneMarker,
  OverallProgress,
  QuizProgressBridge,
  RecordedQuizScore,
} from "@/components/progress-hooks";
import type { Flashcard, Question } from "@/lib/content/schema";
import { DEFAULT_PROGRESS, EXAM_READY_CHAPTERS, KEY } from "@/lib/progress";

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

  it("rehydrates persisted marks into the deck counts (position still starts at card 1)", async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ ...DEFAULT_PROGRESS, cards: { k1: "gotit" } }),
    );
    render(<DeckProgressBridge deckId="ch-x" cards={cards} />);

    await waitFor(() => expect(screen.getByText("1/2")).toBeInTheDocument());
    expect(screen.getByText("1 got it")).toBeInTheDocument();
    expect(screen.getByText("0 again")).toBeInTheDocument();
    // No auto-jump: the deck opens on its first card even with marks on file.
    expect(screen.getByRole("button", { name: "front one" })).toBeInTheDocument();
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

describe("OverallProgress", () => {
  it("starts at the deterministic empty state, then shows the stored percent", async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        ...DEFAULT_PROGRESS,
        chaptersDone: ["a", "b", "c"],
      }),
    );
    render(<OverallProgress totalChapters={9} />);

    // No flash of stored data: 0/9 · 0% until the mount effect resolves.
    expect(screen.getByText("0/9 chapters done")).toBeInTheDocument();
    expect(screen.getByText("0%")).toHaveAttribute("data-percent", "0");

    await waitFor(() => expect(screen.getByText("3/9 chapters done")).toBeInTheDocument());
    expect(screen.getByText("33%")).toHaveAttribute("data-percent", "33");
  });

  it("reads 100% only when every chapter is done", async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ ...DEFAULT_PROGRESS, chaptersDone: ["a", "b", "c", "d", "e", "f", "g", "h"] }),
    );
    render(<OverallProgress totalChapters={9} />);
    await waitFor(() => expect(screen.getByText("8/9 chapters done")).toBeInTheDocument());
    expect(screen.getByText("88%")).toBeInTheDocument();
  });

  it("hints at the exam once EXAM_READY_CHAPTERS chapters are done, linking to /exam", async () => {
    const done = Array.from({ length: EXAM_READY_CHAPTERS }, (_, i) => `ch-${i}`);
    localStorage.setItem(KEY, JSON.stringify({ ...DEFAULT_PROGRESS, chaptersDone: done }));
    render(<OverallProgress totalChapters={9} />);

    const link = await screen.findByRole("link", { name: /ready for the exam/ });
    expect(link).toHaveAttribute("href", "/exam");
  });

  it("stays quiet about the exam before the readiness threshold", async () => {
    localStorage.setItem(KEY, JSON.stringify({ ...DEFAULT_PROGRESS, chaptersDone: ["a"] }));
    render(<OverallProgress totalChapters={9} />);
    await waitFor(() => expect(screen.getByText("1/9 chapters done")).toBeInTheDocument());
    expect(screen.queryByText(/ready for the exam/)).toBeNull();
  });
});

describe("RecordedQuizScore", () => {
  it("renders nothing until the store resolves, then shows the recorded attempt", async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ ...DEFAULT_PROGRESS, quizzes: { "ch-x": { score: 2, total: 3 } } }),
    );
    render(<RecordedQuizScore chapterId="ch-x" />);

    expect(screen.queryByText(/last attempt/)).toBeNull(); // no flash of stored data
    await waitFor(() => expect(screen.getByText(/last attempt: 2\/3/)).toBeInTheDocument());
    expect(screen.getByText(/67%/)).toBeInTheDocument();
  });

  it("renders nothing when no attempt was recorded", async () => {
    render(<RecordedQuizScore chapterId="ch-x" />);
    await waitFor(() => expect(screen.queryByText(/last attempt/)).toBeNull());
  });
});
