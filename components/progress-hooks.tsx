"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Flashcard, Question } from "@/lib/content/schema";
import { Quiz } from "@/components/quiz";
import { FlashcardDeck } from "@/components/flashcard-deck";
import {
  DEFAULT_PROGRESS,
  loadProgress,
  saveProgress,
  markQuiz,
  markChapterDone,
  markCard,
  CHAPTER_DONE_PERCENT,
  EXAM_READY_CHAPTERS,
  courseDonePercent,
  type CardMark,
  type Progress,
  type QuizResult,
} from "@/lib/progress";

/**
 * Bridges between the interactive components and the progress store.
 *
 * These wrappers are the ONLY place where component callbacks touch storage:
 * `Quiz`/`FlashcardDeck` stay storage-free, and `lib/progress` stays
 * component-free. The store functions are pure, so this file composes them
 * and decides when to persist.
 *
 * Hydration rule (binding): progress must NEVER be read during the initial
 * render. Server HTML and the first client render must agree, so initial
 * state is the deterministic DEFAULT_PROGRESS and the real stored value is
 * read inside a mount effect — one deterministic render, then an update.
 */

/**
 * Shared hook: current progress + an update helper that persists and stages
 * the next state. `latest` mirrors the newest value so callbacks composed
 * from several store calls can never act on a stale snapshot.
 */
function useProgress(): {
  progress: Progress;
  update: (next: Progress) => void;
  latest: React.RefObject<Progress>;
} {
  const [progress, setProgress] = useState<Progress>(DEFAULT_PROGRESS);
  const latest = useRef<Progress>(DEFAULT_PROGRESS);

  useEffect(() => {
    // Read outside the synchronous effect body (react-hooks/set-state-in-effect):
    // one promise tick keeps the mount-effect read while avoiding a cascading
    // synchronous render. The state update itself still happens in the effect,
    // never during initial render — hydration stays deterministic.
    void Promise.resolve().then(() => {
      const stored = loadProgress();
      latest.current = stored;
      setProgress(stored);
    });
  }, []);

  const update = useCallback((next: Progress) => {
    latest.current = next;
    saveProgress(next);
    setProgress(next);
  }, []);

  return { progress, update, latest };
}

interface QuizProgressBridgeProps {
  /** Chapter the quiz belongs to (== chapter slug). */
  chapterId: string;
  /** Validated questions for this chapter's quiz. */
  questions: Question[];
}

/**
 * `<Quiz>` wired to real progress: the score is recorded on completion, and a
 * chapter scoring at or above CHAPTER_DONE_PERCENT is auto-marked done.
 * Shows the previously recorded attempt, when there is one.
 */
export function QuizProgressBridge({ chapterId, questions }: QuizProgressBridgeProps) {
  const { progress, update, latest } = useProgress();
  const recorded = progress.quizzes[chapterId];
  const done = progress.chaptersDone.includes(chapterId);

  return (
    <div className="space-y-3" data-quiz-progress={chapterId}>
      {recorded && (
        <p className="font-mono text-xs text-muted">
          [saved] last attempt: {recorded.score}/{recorded.total} ·{" "}
          {recorded.total > 0 ? Math.round((recorded.score / recorded.total) * 100) : 0}%
          {done ? " · chapter done" : ""}
        </p>
      )}
      <Quiz
        questions={questions}
        chapterId={chapterId}
        onComplete={({ score, total, percent }) => {
          let next = markQuiz(latest.current, chapterId, score, total);
          if (percent >= CHAPTER_DONE_PERCENT) next = markChapterDone(next, chapterId);
          update(next);
        }}
      />
    </div>
  );
}

interface DeckProgressBridgeProps {
  /** Deck the cards belong to (== chapter slug). */
  deckId: string;
  /** Validated cards for this chapter's deck. */
  cards: Flashcard[];
}

/**
 * `<FlashcardDeck>` wired to real progress: every mark is recorded per card
 * id, and the deck's persisted marks rehydrate into its counts on load.
 * Shows how many of this deck's cards carry a mark from earlier runs.
 */
export function DeckProgressBridge({ deckId, cards }: DeckProgressBridgeProps) {
  const { progress, update, latest } = useProgress();
  const marked = cards.filter((c) => progress.cards[c.id] !== undefined).length;

  // Persisted marks for THIS deck's cards only (marks from other decks and
  // stale ids are filtered out) — the deck merges them on hydration.
  const initialMarks: Record<string, CardMark> = {};
  for (const card of cards) {
    const mark = progress.cards[card.id];
    if (mark !== undefined) initialMarks[card.id] = mark;
  }

  return (
    <div className="space-y-3" data-deck-progress={deckId}>
      {marked > 0 && (
        <p className="font-mono text-xs text-muted">
          [saved] {marked}/{cards.length} cards marked in earlier runs
        </p>
      )}
      <FlashcardDeck
        cards={cards}
        deckId={deckId}
        initialMarks={initialMarks}
        onMark={(cardId, mark) => {
          update(markCard(latest.current, cardId, mark));
        }}
      />
    </div>
  );
}

type DoneState = "unknown" | "done" | "pending";

/**
 * Per-chapter done marker for the course index. Renders a neutral placeholder
 * until the mount effect resolves the stored state (deterministic server and
 * first-client render, then a one-time update — no hydration mismatch).
 */
export function DoneMarker({ chapterId }: { chapterId: string }) {
  const [state, setState] = useState<DoneState>("unknown");

  useEffect(() => {
    // Resolve outside the synchronous effect body (react-hooks/set-state-in-effect).
    void Promise.resolve().then(() => {
      setState(loadProgress().chaptersDone.includes(chapterId) ? "done" : "pending");
    });
  }, [chapterId]);

  if (state === "done") {
    return (
      <span data-done={chapterId} className="font-mono text-xs text-accent">
        done
      </span>
    );
  }
  return (
    <span data-done={chapterId} className="font-mono text-xs text-muted">
      {state === "unknown" ? "—" : "pending"}
    </span>
  );
}

/**
 * Overall course progress bar for the course index: chapters done, as an
 * integer percent of the whole course (floored, per courseDonePercent).
 * Hydration-safe by this file's binding rule — the initial render is the
 * deterministic empty state (0 done / 0%) and the stored count is read in a
 * mount effect. Once at least EXAM_READY_CHAPTERS chapters are done, a subtle
 * hint links to the final exam.
 */
export function OverallProgress({ totalChapters }: { totalChapters: number }) {
  const [done, setDone] = useState<number | null>(null);

  useEffect(() => {
    // Resolve outside the synchronous effect body (react-hooks/set-state-in-effect).
    void Promise.resolve().then(() => {
      setDone(loadProgress().chaptersDone.length);
    });
  }, []);

  const chaptersDone = done ?? 0;
  const percent = courseDonePercent(chaptersDone, totalChapters);
  const examReady = done !== null && chaptersDone >= EXAM_READY_CHAPTERS;

  return (
    <div data-overall-progress className="rounded-lg border border-line p-4">
      <div className="flex items-center justify-between font-mono text-xs text-muted">
        <span>{chaptersDone}/{totalChapters} chapters done</span>
        <span data-percent={percent}>{percent}%</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
      {examReady && (
        <p className="mt-3 font-mono text-xs text-accent">
          <Link href="/exam" className="underline-offset-4 hover:underline">
            &gt; ready for the exam
          </Link>
        </p>
      )}
    </div>
  );
}

/**
 * Per-chapter recorded quiz score for the course index — shown once the store
 * resolves, and only when an attempt exists. Renders nothing before that
 * (deterministic server and first-client render, then a one-time update; no
 * hydration mismatch).
 */
export function RecordedQuizScore({ chapterId }: { chapterId: string }) {
  const [recorded, setRecorded] = useState<QuizResult | null | "unknown">("unknown");

  useEffect(() => {
    // Resolve outside the synchronous effect body (react-hooks/set-state-in-effect).
    void Promise.resolve().then(() => {
      setRecorded(loadProgress().quizzes[chapterId] ?? null);
    });
  }, [chapterId]);

  if (recorded === "unknown" || recorded === null) return null;
  return (
    <p data-recorded-score={chapterId} className="font-mono text-xs text-muted">
      [saved] last attempt: {recorded.score}/{recorded.total} ·{" "}
      {recorded.total > 0 ? Math.round((recorded.score / recorded.total) * 100) : 0}%
    </p>
  );
}
