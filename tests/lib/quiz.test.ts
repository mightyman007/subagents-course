import { describe, it, expect } from "vitest";
import { gradeQuestion, gradeQuiz } from "@/lib/quiz";
import type { Question } from "@/lib/content/schema";

const single: Question = {
  id: "s1",
  type: "single",
  prompt: "p",
  options: ["a", "b", "c"],
  correct: [1],
  explanation: "e",
};

const multi: Question = {
  id: "m1",
  type: "multi",
  prompt: "p",
  options: ["a", "b", "c", "d"],
  correct: [0, 1, 2],
  explanation: "e",
};

const boolean: Question = {
  id: "b1",
  type: "boolean",
  prompt: "p",
  options: ["True", "False"],
  correct: [0],
  explanation: "e",
};

describe("gradeQuestion", () => {
  it("single: correct pick", () => {
    expect(gradeQuestion(single, [1]).correct).toBe(true);
  });

  it("single: wrong pick", () => {
    expect(gradeQuestion(single, [0]).correct).toBe(false);
  });

  it("multi: exact set is correct", () => {
    expect(gradeQuestion(multi, [0, 1, 2]).correct).toBe(true);
  });

  it("multi: strict subset is incorrect", () => {
    expect(gradeQuestion(multi, [0, 1]).correct).toBe(false);
  });

  it("multi: order-independent exact set", () => {
    expect(gradeQuestion(multi, [2, 0, 1]).correct).toBe(true);
  });

  it("multi: superset with an extra wrong pick is incorrect", () => {
    expect(gradeQuestion(multi, [0, 1, 2, 3]).correct).toBe(false);
  });

  it("multi: duplicate picks normalize to the same set", () => {
    expect(gradeQuestion(multi, [1, 0, 1, 2]).correct).toBe(true);
  });

  it("empty pick is always incorrect", () => {
    expect(gradeQuestion(single, []).correct).toBe(false);
    expect(gradeQuestion(multi, []).correct).toBe(false);
    expect(gradeQuestion(boolean, []).correct).toBe(false);
  });

  it("boolean grades like single over True/False options", () => {
    expect(gradeQuestion(boolean, [0]).correct).toBe(true);
    expect(gradeQuestion(boolean, [1]).correct).toBe(false);
  });
});

describe("gradeQuiz", () => {
  const qs = [single, multi, boolean];

  it("grades every question and reports score/total/percent", () => {
    const r = gradeQuiz(qs, { s1: [1], m1: [0, 1, 2], b1: [0] });
    expect(r.score).toBe(3);
    expect(r.total).toBe(3);
    expect(r.percent).toBe(100);
    expect(r.results.map((x) => x.correct)).toEqual([true, true, true]);
  });

  it("rounds percent to the nearest integer (1/3 → 33, 2/3 → 67)", () => {
    expect(gradeQuiz(qs, { s1: [1] }).percent).toBe(33);
    expect(gradeQuiz(qs, { s1: [1], b1: [0] }).percent).toBe(67);
  });

  it("treats missing answers as empty picks (incorrect)", () => {
    const r = gradeQuiz(qs, {});
    expect(r.score).toBe(0);
    expect(r.total).toBe(3);
    expect(r.results.every((x) => !x.correct)).toBe(true);
  });

  it("per-question results align with the input order", () => {
    const r = gradeQuiz(qs, { s1: [0], m1: [0, 1, 2], b1: [1] });
    expect(r.results.map((x) => x.correct)).toEqual([false, true, false]);
    expect(r.score).toBe(1);
    expect(r.percent).toBe(33);
  });
});
