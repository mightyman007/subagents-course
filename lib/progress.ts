/**
 * Progress store for the Subagents Mastery course.
 *
 * All progress lives client-side in localStorage (no backend, per the design).
 * The shape and key are a stable contract — downstream tasks (chapter pages,
 * exam page, progress dashboards) build directly on them:
 *
 *   KEY = "subagents-course:progress:v1"
 *   Progress = { chaptersDone: string[], quizzes: Record<chapterId, {score,total}>,
 *                exam: {score,total,passed} | null, cards: Record<cardId, "again"|"gotit"> }
 *
 * Purity rules:
 * - `mark*` / `recordExam` are PURE transforms of a Progress object: they
 *   never touch storage and never mutate their input. The caller decides what
 *   to do with the returned next state (typically `saveProgress(next)`).
 * - Only `loadProgress` / `saveProgress` / `resetProgress` touch localStorage,
 *   and every access is guarded: server renders (no `window`) get DEFAULTS,
 *   and browsers that block storage (privacy modes) degrade to a no-op instead
 *   of crashing the page.
 */

export interface QuizResult {
  score: number;
  total: number;
}

export interface ExamResult {
  score: number;
  total: number;
  passed: boolean;
}

export interface Progress {
  chaptersDone: string[];
  quizzes: Record<string, QuizResult>;
  exam: ExamResult | null;
  cards: Record<string, "again" | "gotit">;
}

export const KEY = "subagents-course:progress:v1";

/** The progress of someone who has never visited before. */
export const DEFAULT_PROGRESS: Progress = Object.freeze({
  chaptersDone: [],
  quizzes: {},
  exam: null,
  cards: {},
});

export type CardMark = "again" | "gotit";

/**
 * Course policy: a chapter quiz scoring at or above this percent marks the
 * chapter as done (enforced by the quiz completion bridge; displayed on
 * chapter pages and the course index).
 */
export const CHAPTER_DONE_PERCENT = 60;

/**
 * Read persisted progress. SSR-safe by design: when there is no `window`
 * (server render / build / node), return DEFAULT_PROGRESS — never read
 * storage, never throw. Corrupted or wrong-shaped stored data is treated as
 * absent: a broken value must never take the site down.
 */
export function loadProgress(): Progress {
  if (typeof window === "undefined") return DEFAULT_PROGRESS;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return DEFAULT_PROGRESS;
  }
  if (raw === null) return DEFAULT_PROGRESS;
  const parsed = parseStored(raw);
  return parsed ?? DEFAULT_PROGRESS;
}

/** Persist progress. No-op (never throws) where storage is unavailable. */
export function saveProgress(p: Progress): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Storage can be full or blocked; losing progress beats crashing a page.
  }
}

/** Clear stored progress and return the fresh default. */
export function resetProgress(): Progress {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      // Ignore — nothing stored (or storage blocked) means already reset.
    }
  }
  return DEFAULT_PROGRESS;
}

/** Record a chapter quiz result (upsert: a retake replaces the old score). */
export function markQuiz(p: Progress, chapterId: string, score: number, total: number): Progress {
  return { ...p, quizzes: { ...p.quizzes, [chapterId]: { score, total } } };
}

/** Add a chapter to the done set. Idempotent: already-done chapters return the same object. */
export function markChapterDone(p: Progress, id: string): Progress {
  if (p.chaptersDone.includes(id)) return p;
  return { ...p, chaptersDone: [...p.chaptersDone, id] };
}

/**
 * Record the final exam result. `passed` compares the rounded percent (the
 * same number the exam UI shows) against `passMarkPercent`: percent ≥ mark
 * passes, exactly at the mark passes too.
 */
export function recordExam(
  p: Progress,
  score: number,
  total: number,
  passMarkPercent: number,
): Progress {
  const percent = total > 0 ? Math.round((score / total) * 100) : 0;
  return { ...p, exam: { score, total, passed: percent >= passMarkPercent } };
}

/** Record a flashcard mark (upsert: re-marking replaces the old mark). */
export function markCard(p: Progress, cardId: string, mark: CardMark): Progress {
  return { ...p, cards: { ...p.cards, [cardId]: mark } };
}

/* ------------------------------------------------------------------ */
/* internals: stored-data validation                                   */
/* ------------------------------------------------------------------ */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isCardMark(v: unknown): v is CardMark {
  return v === "again" || v === "gotit";
}

/**
 * Validate a freshly-parsed stored value into a Progress, or null when it
 * doesn't have the expected shape (older/corrupt data → treated as default).
 */
function parseStored(raw: string): Progress | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(data)) return null;
  const { chaptersDone, quizzes, cards } = data;
  if (
    !Array.isArray(chaptersDone) ||
    !chaptersDone.every((id) => typeof id === "string")
  ) {
    return null;
  }
  if (!isRecord(quizzes)) return null;
  for (const value of Object.values(quizzes)) {
    if (
      !isRecord(value) ||
      typeof value.score !== "number" ||
      typeof value.total !== "number"
    ) {
      return null;
    }
  }
  let exam: ExamResult | null = null;
  const e = data.exam;
  if (e !== undefined && e !== null) {
    if (
      !isRecord(e) ||
      typeof e.score !== "number" ||
      typeof e.total !== "number" ||
      typeof e.passed !== "boolean"
    ) {
      return null;
    }
    exam = { score: e.score, total: e.total, passed: e.passed };
  }
  if (!isRecord(cards)) return null;
  for (const value of Object.values(cards)) {
    if (!isCardMark(value)) return null;
  }
  return {
    chaptersDone: chaptersDone as string[],
    quizzes: quizzes as Record<string, QuizResult>,
    exam,
    cards: cards as Record<string, CardMark>,
  };
}
