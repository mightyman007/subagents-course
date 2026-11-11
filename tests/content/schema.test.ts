import { describe, it, expect } from "vitest";
import {
  questionSchema,
  flashcardSchema,
  validateQuestionSet,
  validateFlashcards,
  ValidationError,
} from "@/lib/content/schema";

const q = (over: object) => ({
  id: "q1",
  type: "single",
  prompt: "p",
  options: ["a", "b", "c"],
  correct: [0],
  explanation: "e",
  ...over,
});

const card = (over: object) => ({ id: "c1", front: "front", back: "back", ...over });

function catchError(fn: () => unknown): ValidationError {
  try {
    fn();
  } catch (e) {
    return e as ValidationError;
  }
  throw new Error("expected function to throw, but it returned");
}

describe("questionSchema", () => {
  it("accepts a valid single question", () => {
    expect(questionSchema.safeParse(q({})).success).toBe(true);
  });

  it("accepts a valid multi question with 2 correct indexes", () => {
    expect(
      questionSchema.safeParse(q({ id: "q2", type: "multi", correct: [0, 2] })).success,
    ).toBe(true);
  });

  it("accepts a valid boolean question", () => {
    expect(
      questionSchema.safeParse(q({ id: "q3", type: "boolean", options: ["True", "False"], correct: [0] }))
        .success,
    ).toBe(true);
  });

  it("rejects missing explanation", () =>
    expect(questionSchema.safeParse(q({ explanation: "" })).success).toBe(false));

  it("rejects single with 2 correct", () =>
    expect(questionSchema.safeParse(q({ correct: [0, 1] })).success).toBe(false));

  it("rejects multi with 0 correct", () =>
    expect(questionSchema.safeParse(q({ type: "multi", correct: [] })).success).toBe(false));

  it("rejects boolean with wrong options", () =>
    expect(
      questionSchema.safeParse(q({ type: "boolean", options: ["Yes", "No"], correct: [0] })).success,
    ).toBe(false));

  it("rejects boolean without options", () =>
    expect(
      questionSchema.safeParse(q({ type: "boolean", options: undefined, correct: [0] })).success,
    ).toBe(false));

  it("rejects out-of-range correct index", () =>
    expect(questionSchema.safeParse(q({ correct: [5] })).success).toBe(false));

  it("rejects negative correct index", () =>
    expect(questionSchema.safeParse(q({ correct: [-1] })).success).toBe(false));

  it("rejects fewer than 2 options", () =>
    expect(questionSchema.safeParse(q({ options: ["only"] })).success).toBe(false));
});

describe("validateQuestionSet", () => {
  it("returns parsed questions when the set is valid", () => {
    const out = validateQuestionSet(
      [q({}), q({ id: "q2" }), q({ id: "q3", type: "multi", correct: [0, 1] })],
      { min: 3 },
    );
    expect(out.map((x) => x.id)).toEqual(["q1", "q2", "q3"]);
  });

  it("throws ValidationError on duplicate ids, with field paths", () => {
    const err = catchError(() => validateQuestionSet([q({}), q({})], { min: 0 }));
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.issues.some((i) => i.path.endsWith(".id") && i.message.includes("duplicate"))).toBe(
      true,
    );
    expect(err.message).toContain("duplicate");
  });

  it("throws when the set is below min (chapter quiz <3)", () => {
    const err = catchError(() => validateQuestionSet([q({}), q({ id: "q2" })], { min: 3 }));
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toContain("at least 3");
  });

  it("aggregates item errors and count errors instead of failing fast", () => {
    const err = catchError(() => validateQuestionSet([q({ explanation: "" }), q({ id: "q2" })], { min: 3 }));
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.issues.length).toBeGreaterThanOrEqual(2);
    expect(err.issues.some((i) => i.path.includes("explanation"))).toBe(true);
    expect(err.issues.some((i) => i.message.includes("at least 3"))).toBe(true);
  });

  it("throws when the input is not an array", () => {
    expect(() => validateQuestionSet("nope", { min: 1 })).toThrow(ValidationError);
  });
});

describe("flashcardSchema", () => {
  it("accepts a valid card and defaults tags to []", () => {
    const parsed = flashcardSchema.parse(card({}));
    expect(parsed.tags).toEqual([]);
  });

  it("rejects missing back", () =>
    expect(flashcardSchema.safeParse(card({ back: "" })).success).toBe(false));

  it("rejects missing front", () =>
    expect(flashcardSchema.safeParse(card({ front: "" })).success).toBe(false));
});

describe("validateFlashcards", () => {
  it("accepts a deck of 6 cards", () => {
    const deck = Array.from({ length: 6 }, (_, i) => card({ id: `c${i + 1}` }));
    expect(validateFlashcards(deck, { min: 6 })).toHaveLength(6);
  });

  it("throws when the deck is below min (flashcards <6)", () => {
    const err = catchError(() => validateFlashcards([card({}), card({ id: "c2" })], { min: 6 }));
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toContain("at least 6");
  });

  it("throws on a flashcard missing back, with field path", () => {
    const err = catchError(() => validateFlashcards([card({ back: "" })], { min: 1 }));
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.issues.some((i) => i.path.includes("back"))).toBe(true);
  });

  it("throws on duplicate card ids", () => {
    const err = catchError(() => validateFlashcards([card({}), card({})], { min: 0 }));
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.issues.some((i) => i.message.includes("duplicate"))).toBe(true);
  });
});
