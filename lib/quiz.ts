import type { Question } from "@/lib/content/schema";

/**
 * Quiz/exam grading.
 *
 * Pure functions, safe to import from client components — the only dependency
 * on `lib/content/schema` is type-level, so nothing server-side is bundled.
 *
 * Grading semantics (binding):
 * - Exact-set equality over normalized picks: deduplicated + sorted index sets.
 * - An empty pick is always incorrect.
 * - A partial (strict-subset) selection on multi questions is incorrect — no
 *   partial credit.
 * - Order of picks never matters.
 */

/** Grade one answer. `picked` holds indexes into `q.options`. */
export function gradeQuestion(q: Question, picked: number[]): { correct: boolean } {
  const norm = (a: number[]) => [...new Set(a)].sort((x, y) => x - y).join(",");
  return { correct: picked.length > 0 && norm(picked) === norm(q.correct) };
}

/** Grade a whole set of questions against the reader's answers (by question id). */
export function gradeQuiz(qs: Question[], answers: Record<string, number[]>) {
  const results = qs.map((q) => gradeQuestion(q, answers[q.id] ?? []));
  const score = results.filter((r) => r.correct).length;
  return { results, score, total: qs.length, percent: Math.round((score / qs.length) * 100) };
}
