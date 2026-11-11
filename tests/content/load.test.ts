import { describe, it, expect } from "vitest";
import path from "node:path";
import { loadChapterSlugs, loadChapter, loadExam } from "@/lib/content/load";
import { ValidationError } from "@/lib/content/schema";

const fixturesRoot = path.join(process.cwd(), "tests", "fixtures");
const brokenRoot = path.join(process.cwd(), "tests", "fixtures", "broken");

function catchError(fn: () => unknown): ValidationError {
  try {
    fn();
  } catch (e) {
    return e as ValidationError;
  }
  throw new Error("expected function to throw, but it returned");
}

describe("loadChapterSlugs", () => {
  it("returns slugs sorted by frontmatter order, not directory name", () => {
    // 01-x carries order 1, 00-y carries order 2 — alphabetical order would
    // yield ["00-y", "01-x"], so this assertion only passes when sorting by order.
    expect(loadChapterSlugs({ root: fixturesRoot })).toEqual(["01-x", "00-y"]);
  });
});

describe("loadChapter", () => {
  const chapter = () => loadChapter("01-x", { root: fixturesRoot });

  it("parses frontmatter into ChapterMeta", () => {
    expect(chapter().meta).toEqual({
      slug: "01-x",
      title: "Chapter X",
      order: 1,
      objectives: ["Explain what a subagent is", "Dispatch your first subagent"],
    });
  });

  it("returns the MDX body without frontmatter", () => {
    const c = chapter();
    expect(c.mdxSource).toContain("Hello MDX body");
    expect(c.mdxSource).not.toContain("objectives");
  });

  it("parses and validates quiz.yaml (min 3)", () => {
    const c = chapter();
    expect(c.quiz).toHaveLength(3);
    expect(c.quiz[0]).toMatchObject({ id: "q1", type: "single", correct: [0] });
    expect(c.quiz[1]).toMatchObject({ id: "q2", type: "multi", correct: [0, 2] });
  });

  it("normalizes boolean questions authored without options / with boolean correct", () => {
    const c = chapter();
    expect(c.quiz[2]).toEqual({
      id: "q3",
      type: "boolean",
      prompt: "True or false?",
      options: ["True", "False"],
      correct: [0],
      explanation: "It is true",
    });
  });

  it("parses and validates flashcards.yaml (min 6)", () => {
    const c = chapter();
    expect(c.flashcards).toHaveLength(6);
    expect(c.flashcards[0]).toEqual({ id: "c1", front: "F1", back: "B1", tags: ["core"] });
  });

  it("throws ValidationError for an unknown slug", () => {
    const err = catchError(() => loadChapter("nope", { root: fixturesRoot }));
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toContain("nope");
  });

  it("throws ValidationError with frontmatter field paths when frontmatter is incomplete", () => {
    const err = catchError(() => loadChapter("10-bad", { root: brokenRoot }));
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.issues.some((i) => i.path === "frontmatter.order")).toBe(true);
    expect(err.message).toContain("frontmatter.order");
  });
});

describe("loadExam", () => {
  it("returns [] when exam.yaml is absent", () => {
    expect(loadExam({ root: brokenRoot })).toEqual([]);
  });

  it("validates and returns questions when exam.yaml exists", () => {
    const qs = loadExam({ root: fixturesRoot, min: 3 });
    expect(qs).toHaveLength(3);
    expect(qs.map((x) => x.type)).toContain("boolean");
    expect(qs[2]).toMatchObject({ id: "ex3", type: "boolean", correct: [1] });
  });

  it("enforces the ≥20 exam minimum by default", () => {
    const err = catchError(() => loadExam({ root: fixturesRoot }));
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toContain("at least 20");
  });
});
