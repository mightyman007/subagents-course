import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { parse as parseYaml } from "yaml";
import ExamPage from "@/app/exam/page";
import { ExamProgress } from "@/components/exam-progress";
import { DEFAULT_PASS_MARK_PERCENT, resolvePassMarkPercent } from "@/lib/exam-meta";
import type { Question } from "@/lib/content/schema";
import { DEFAULT_PROGRESS, loadProgress, recordExam, saveProgress } from "@/lib/progress";
import type { Progress } from "@/lib/progress";

/**
 * Exam page + client bridge tests. The progress store is MOCKED here (the
 * brief's "mock store"): `loadProgress`/`saveProgress` are backed by a local
 * object instead of localStorage, while `recordExam` stays a call-through spy
 * so both the wiring (call args) and the persisted shape are asserted.
 */
const mockStore = vi.hoisted(() => ({ current: null as Progress | null }));

vi.mock("@/lib/progress", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/progress")>();
  return {
    ...actual,
    loadProgress: vi.fn((): Progress => mockStore.current ?? actual.DEFAULT_PROGRESS),
    saveProgress: vi.fn((p: Progress) => {
      mockStore.current = p;
    }),
    recordExam: vi.fn(actual.recordExam),
  };
});

// RTL auto-cleanup must be wired per file (vitest runs without globals: true).
afterEach(() => {
  cleanup();
});

beforeEach(() => {
  mockStore.current = null;
  vi.mocked(loadProgress).mockClear();
  vi.mocked(saveProgress).mockClear();
  vi.mocked(recordExam).mockClear();
  vi.mocked(loadProgress).mockImplementation(() => mockStore.current ?? DEFAULT_PROGRESS);
  vi.mocked(saveProgress).mockImplementation((p: Progress) => {
    mockStore.current = p;
  });
});

const questions: Question[] = [
  {
    id: "x1",
    type: "single",
    prompt: "One?",
    options: ["a1", "b1"],
    correct: [0],
    explanation: "a1 is right",
  },
  {
    id: "x2",
    type: "single",
    prompt: "Two?",
    options: ["a2", "b2"],
    correct: [0],
    explanation: "a2 is right",
  },
  {
    id: "x3",
    type: "single",
    prompt: "Three?",
    options: ["a3", "b3"],
    correct: [0],
    explanation: "a3 is right",
  },
];

/** Answer every exam question, then submit the whole exam. */
function answerExam(correctly: boolean) {
  const pick = correctly ? /^a/ : /^b/;
  for (const prompt of ["One?", "Two?", "Three?"]) {
    fireEvent.click(
      within(screen.getByRole("group", { name: prompt })).getByRole("button", { name: pick }),
    );
  }
  fireEvent.click(screen.getByRole("button", { name: "Submit exam" }));
}

describe("ExamProgress bridge", () => {
  it("records the exam result through the progress store on submit", async () => {
    render(<ExamProgress questions={questions} passMarkPercent={80} />);
    expect(screen.queryByText(/last attempt/)).toBeNull(); // no flash of stored data
    await waitFor(() => expect(loadProgress).toHaveBeenCalled());

    answerExam(true); // 3/3 = 100%

    await waitFor(() => {
      expect(recordExam).toHaveBeenCalledTimes(1);
      expect(mockStore.current).toEqual({
        chaptersDone: [],
        quizzes: {},
        cards: {},
        exam: { score: 3, total: 3, passed: true },
      });
    });
    // Wired with the page's pass mark and the progress state at submit time.
    expect(vi.mocked(recordExam).mock.calls[0][0]).toEqual(DEFAULT_PROGRESS);
    expect(vi.mocked(recordExam).mock.calls[0][1]).toBe(3);
    expect(vi.mocked(recordExam).mock.calls[0][2]).toBe(3);
    expect(vi.mocked(recordExam).mock.calls[0][3]).toBe(80);
  });

  it("records a failed attempt with passed: false below the pass mark", async () => {
    render(<ExamProgress questions={questions} passMarkPercent={80} />);
    await waitFor(() => expect(loadProgress).toHaveBeenCalled());

    answerExam(false); // 0/3 = 0%

    await waitFor(() => {
      expect(mockStore.current?.exam).toEqual({ score: 0, total: 3, passed: false });
    });
  });

  it("clears the recorded exam — and only it — when the reader retakes", async () => {
    mockStore.current = {
      ...DEFAULT_PROGRESS,
      quizzes: { c1: { score: 1, total: 2 } },
      exam: { score: 1, total: 3, passed: false },
    };
    render(<ExamProgress questions={questions} passMarkPercent={80} />);
    await waitFor(() => expect(loadProgress).toHaveBeenCalled());

    answerExam(true);
    await waitFor(() =>
      expect(mockStore.current?.exam).toEqual({ score: 3, total: 3, passed: true }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Retake" }));

    await waitFor(() => expect(mockStore.current?.exam).toBeNull());
    expect(mockStore.current?.quizzes).toEqual({ c1: { score: 1, total: 2 } });
    expect(screen.queryByText(/last attempt/)).toBeNull();
  });
});

describe("passMarkPercent sourcing", () => {
  it("uses the exam.yaml value when present — it wins over the default", () => {
    expect(resolvePassMarkPercent({ passMarkPercent: 85 })).toBe(85);
  });

  it("falls back to the 80% default when the value is absent or unusable", () => {
    expect(resolvePassMarkPercent({})).toBe(DEFAULT_PASS_MARK_PERCENT);
    expect(resolvePassMarkPercent({ passMarkPercent: "high" })).toBe(DEFAULT_PASS_MARK_PERCENT);
    expect(resolvePassMarkPercent({ passMarkPercent: 0 })).toBe(DEFAULT_PASS_MARK_PERCENT);
    expect(resolvePassMarkPercent({ passMarkPercent: 101 })).toBe(DEFAULT_PASS_MARK_PERCENT);
    expect(resolvePassMarkPercent(null)).toBe(DEFAULT_PASS_MARK_PERCENT);
    expect(resolvePassMarkPercent([1, 2])).toBe(DEFAULT_PASS_MARK_PERCENT);
    expect(DEFAULT_PASS_MARK_PERCENT).toBe(80);
  });

  it("resolves the mark declared by the real content/exam.yaml", () => {
    const file = path.join(process.cwd(), "content", "exam.yaml");
    const parsed = parseYaml(fs.readFileSync(file, "utf8")) as { passMarkPercent?: number };
    expect(parsed.passMarkPercent).toBeTypeOf("number");
    expect(resolvePassMarkPercent(parsed)).toBe(parsed.passMarkPercent);
  });
});

describe("ExamPage", () => {
  it("renders the intro pass mark and one fieldset per exam.yaml question", () => {
    const file = path.join(process.cwd(), "content", "exam.yaml");
    const parsed = parseYaml(fs.readFileSync(file, "utf8")) as {
      passMarkPercent: number;
      questions: unknown[];
    };

    render(<ExamPage />);

    expect(screen.getByText(new RegExp(`pass mark ${parsed.passMarkPercent}%`))).toBeInTheDocument();
    expect(screen.getAllByRole("group")).toHaveLength(parsed.questions.length);
  });
});
