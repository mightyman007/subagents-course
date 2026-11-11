import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PROGRESS,
  KEY,
  loadProgress,
  saveProgress,
  markQuiz,
  markChapterDone,
  recordExam,
  markCard,
  resetProgress,
  type Progress,
} from "@/lib/progress";

/**
 * jsdom provides window/localStorage; the SSR branch is exercised by stubbing
 * `window` to undefined (typeof window then reads "undefined", exactly the
 * condition a Node/server render sees).
 */
function stubNoWindow() {
  vi.stubGlobal("window", undefined);
}

// A representative non-default progress object used in round-trip tests.
const SAMPLE: Progress = {
  chaptersDone: ["00-orientation"],
  quizzes: { "00-orientation": { score: 2, total: 3 } },
  exam: { score: 18, total: 20, passed: true },
  cards: { c1: "gotit", c2: "again" },
};

describe("DEFAULT_PROGRESS / KEY", () => {
  it("KEY is the storage key the design specifies", () => {
    expect(KEY).toBe("subagents-course:progress:v1");
  });

  it("DEFAULT_PROGRESS is the empty progress shape", () => {
    expect(DEFAULT_PROGRESS).toEqual({
      chaptersDone: [],
      quizzes: {},
      exam: null,
      cards: {},
    });
  });
});

describe("loadProgress", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("returns DEFAULT_PROGRESS when window is undefined (SSR safety)", () => {
    stubNoWindow();
    expect(loadProgress()).toEqual(DEFAULT_PROGRESS);
  });

  it("returns DEFAULT_PROGRESS when nothing is stored", () => {
    expect(loadProgress()).toEqual(DEFAULT_PROGRESS);
  });

  it("round-trips what saveProgress stored", () => {
    saveProgress(SAMPLE);
    expect(loadProgress()).toEqual(SAMPLE);
  });

  it("returns DEFAULT_PROGRESS for corrupt JSON instead of throwing", () => {
    localStorage.setItem(KEY, "{not json");
    expect(loadProgress()).toEqual(DEFAULT_PROGRESS);
  });

  it("returns DEFAULT_PROGRESS when the stored shape is wrong", () => {
    localStorage.setItem(KEY, JSON.stringify({ chaptersDone: "nope" }));
    expect(loadProgress()).toEqual(DEFAULT_PROGRESS);
  });
});

describe("saveProgress", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("writes under the design's localStorage key", () => {
    saveProgress(SAMPLE);
    expect(localStorage.getItem(KEY)).not.toBeNull();
    expect(JSON.parse(localStorage.getItem(KEY) as string)).toEqual(SAMPLE);
  });

  it("is a no-op (does not throw) when window is undefined", () => {
    stubNoWindow();
    expect(() => saveProgress(SAMPLE)).not.toThrow();
  });
});

describe("markQuiz", () => {
  it("stores score+total for the chapter", () => {
    const next = markQuiz(DEFAULT_PROGRESS, "01-what-are-subagents", 3, 4);
    expect(next.quizzes["01-what-are-subagents"]).toEqual({ score: 3, total: 4 });
    expect(next.chaptersDone).toEqual([]);
    expect(next.exam).toBeNull();
    expect(next.cards).toEqual({});
  });

  it("upserts: a retake replaces the previous score", () => {
    const once = markQuiz(DEFAULT_PROGRESS, "ch", 1, 3);
    const twice = markQuiz(once, "ch", 3, 3);
    expect(twice.quizzes.ch).toEqual({ score: 3, total: 3 });
  });

  it("is pure: does not mutate the input progress", () => {
    const before = structuredClone(DEFAULT_PROGRESS);
    markQuiz(DEFAULT_PROGRESS, "ch", 1, 2);
    expect(DEFAULT_PROGRESS).toEqual(before);
  });

  it("does not touch localStorage (persistence is the caller's job)", () => {
    markQuiz(DEFAULT_PROGRESS, "ch", 1, 2);
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});

describe("markChapterDone", () => {
  it("appends the chapter id to chaptersDone", () => {
    const next = markChapterDone(DEFAULT_PROGRESS, "01-what-are-subagents");
    expect(next.chaptersDone).toEqual(["01-what-are-subagents"]);
  });

  it("is idempotent: marking twice keeps one entry (and returns the same object)", () => {
    const once = markChapterDone(DEFAULT_PROGRESS, "ch");
    const twice = markChapterDone(once, "ch");
    expect(twice.chaptersDone).toEqual(["ch"]);
    expect(twice).toBe(once);
  });

  it("preserves other progress fields", () => {
    const base = markQuiz(DEFAULT_PROGRESS, "ch", 2, 3);
    const next = markChapterDone(base, "ch");
    expect(next.quizzes.ch).toEqual({ score: 2, total: 3 });
  });

  it("is pure: does not mutate the input progress", () => {
    const before = structuredClone(DEFAULT_PROGRESS);
    markChapterDone(DEFAULT_PROGRESS, "ch");
    expect(DEFAULT_PROGRESS).toEqual(before);
  });
});

describe("recordExam", () => {
  it("records score+total and passed=true when percent ≥ passMark", () => {
    const next = recordExam(DEFAULT_PROGRESS, 16, 20, 80); // 80% at an 80% mark
    expect(next.exam).toEqual({ score: 16, total: 20, passed: true });
  });

  it("records passed=false when percent is below the pass mark", () => {
    const next = recordExam(DEFAULT_PROGRESS, 15, 20, 80); // 75% < 80%
    expect(next.exam).toEqual({ score: 15, total: 20, passed: false });
  });

  it("treats percent exactly at the pass mark as passed (≥)", () => {
    const next = recordExam(DEFAULT_PROGRESS, 4, 5, 80); // exactly 80%
    expect(next.exam?.passed).toBe(true);
  });

  it("rounds percent the way the UI displays it (e.g. 79.5% → 80 → passed)", () => {
    const next = recordExam(DEFAULT_PROGRESS, 159, 200, 80); // 79.5 → 80
    expect(next.exam?.passed).toBe(true);
  });

  it("is pure: does not mutate the input progress", () => {
    const before = structuredClone(DEFAULT_PROGRESS);
    recordExam(DEFAULT_PROGRESS, 10, 20, 80);
    expect(DEFAULT_PROGRESS).toEqual(before);
  });
});

describe("markCard", () => {
  it("records a card mark", () => {
    const next = markCard(DEFAULT_PROGRESS, "c1", "gotit");
    expect(next.cards.c1).toBe("gotit");
  });

  it("upserts: re-marking the same card replaces the mark", () => {
    const once = markCard(DEFAULT_PROGRESS, "c1", "again");
    const twice = markCard(once, "c1", "gotit");
    expect(twice.cards.c1).toBe("gotit");
  });

  it("marks are independent per card", () => {
    const a = markCard(DEFAULT_PROGRESS, "c1", "gotit");
    const b = markCard(a, "c2", "again");
    expect(b.cards).toEqual({ c1: "gotit", c2: "again" });
  });

  it("is pure: does not mutate the input progress", () => {
    const before = structuredClone(DEFAULT_PROGRESS);
    markCard(DEFAULT_PROGRESS, "c1", "again");
    expect(DEFAULT_PROGRESS).toEqual(before);
  });
});

describe("resetProgress", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("clears the stored key", () => {
    saveProgress(SAMPLE);
    resetProgress();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("returns DEFAULT_PROGRESS", () => {
    saveProgress(SAMPLE);
    expect(resetProgress()).toEqual(DEFAULT_PROGRESS);
  });

  it("does not throw when window is undefined", () => {
    stubNoWindow();
    expect(() => resetProgress()).not.toThrow();
  });
});
