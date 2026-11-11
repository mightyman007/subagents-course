import { z } from "zod";

/**
 * Content schema + validators for the Subagents Mastery course.
 *
 * Server-side / build-time only: consumers parse YAML + MDX frontmatter here
 * before anything is handed to client components.
 */

/** One validation problem, with a field path pointing at the offending data. */
export interface ValidationIssue {
  path: string;
  message: string;
}

/**
 * Thrown whenever content fails validation. Never silently accept invalid
 * questions or decks: `message` lists every problem, `issues` keeps the
 * structured per-problem field paths.
 */
export class ValidationError extends Error {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[], context?: string) {
    const detail = issues.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)).join("; ");
    super(context ? `${context}: ${detail}` : detail);
    this.name = "ValidationError";
    this.issues = issues;
  }
}

export const questionSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(["single", "multi", "boolean"]),
    prompt: z.string().min(1),
    options: z.array(z.string().min(1)),
    correct: z.array(z.number().int()),
    explanation: z.string().min(1),
  })
  .superRefine((q, ctx) => {
    if (q.type === "boolean") {
      if (q.options.length !== 2 || q.options[0] !== "True" || q.options[1] !== "False") {
        ctx.addIssue({
          code: "custom",
          message: "boolean questions require options ['True','False']",
        });
      }
      if (q.correct.length !== 1) {
        ctx.addIssue({ code: "custom", message: "boolean requires exactly 1 correct index" });
      }
    } else {
      if (q.type === "single" && q.correct.length !== 1) {
        ctx.addIssue({ code: "custom", message: "single requires exactly 1 correct index" });
      }
      if (q.type === "multi" && q.correct.length < 1) {
        ctx.addIssue({ code: "custom", message: "multi requires ≥1 correct index" });
      }
      if (q.options.length < 2) {
        ctx.addIssue({ code: "custom", message: "needs ≥2 options" });
      }
    }
    for (const i of q.correct) {
      if (i < 0 || i >= q.options.length) {
        ctx.addIssue({ code: "custom", message: `correct index ${i} out of range` });
      }
    }
  });

export const flashcardSchema = z.object({
  id: z.string().min(1),
  front: z.string().min(1),
  back: z.string().min(1),
  tags: z.array(z.string()).default([]),
});

export type Question = z.infer<typeof questionSchema>;
export type Flashcard = z.infer<typeof flashcardSchema>;

/** Chapter frontmatter, per the content data model (slug = directory name). */
export interface ChapterMeta {
  slug: string;
  title: string;
  order: number;
  objectives: string[];
}

function zodIssues(
  issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>,
  prefix: string,
): ValidationIssue[] {
  return issues.map((issue) => ({
    path: `${prefix}${issue.path.map(String).join(".")}`,
    message: issue.message,
  }));
}

/**
 * Parse every question in the set; check id uniqueness; require ≥ min items.
 * Throws ValidationError listing ALL problems (with field paths), or returns
 * the parsed questions.
 */
export function validateQuestionSet(qs: unknown, { min }: { min: number }): Question[] {
  if (!Array.isArray(qs)) {
    throw new ValidationError(
      [{ path: "questions", message: "expected an array of questions" }],
      "question set",
    );
  }
  const issues: ValidationIssue[] = [];
  const parsed: Question[] = [];
  const firstSeen = new Map<string, number>();
  qs.forEach((raw, i) => {
    const result = questionSchema.safeParse(raw);
    if (!result.success) {
      issues.push(...zodIssues(result.error.issues, `questions[${i}].`));
      return;
    }
    parsed.push(result.data);
    const prev = firstSeen.get(result.data.id);
    if (prev !== undefined) {
      issues.push({
        path: `questions[${i}].id`,
        message: `duplicate id "${result.data.id}" (first seen at questions[${prev}])`,
      });
    } else {
      firstSeen.set(result.data.id, i);
    }
  });
  if (parsed.length < min) {
    issues.push({
      path: "questions",
      message: `expected at least ${min} question(s), got ${parsed.length}`,
    });
  }
  if (issues.length > 0) {
    throw new ValidationError(issues, "question set");
  }
  return parsed;
}

/** Same pattern as validateQuestionSet, for flashcard decks. */
export function validateFlashcards(cs: unknown, { min }: { min: number }): Flashcard[] {
  if (!Array.isArray(cs)) {
    throw new ValidationError(
      [{ path: "flashcards", message: "expected an array of flashcards" }],
      "flashcard set",
    );
  }
  const issues: ValidationIssue[] = [];
  const parsed: Flashcard[] = [];
  const firstSeen = new Map<string, number>();
  cs.forEach((raw, i) => {
    const result = flashcardSchema.safeParse(raw);
    if (!result.success) {
      issues.push(...zodIssues(result.error.issues, `flashcards[${i}].`));
      return;
    }
    parsed.push(result.data);
    const prev = firstSeen.get(result.data.id);
    if (prev !== undefined) {
      issues.push({
        path: `flashcards[${i}].id`,
        message: `duplicate id "${result.data.id}" (first seen at flashcards[${prev}])`,
      });
    } else {
      firstSeen.set(result.data.id, i);
    }
  });
  if (parsed.length < min) {
    issues.push({
      path: "flashcards",
      message: `expected at least ${min} flashcard(s), got ${parsed.length}`,
    });
  }
  if (issues.length > 0) {
    throw new ValidationError(issues, "flashcard set");
  }
  return parsed;
}
