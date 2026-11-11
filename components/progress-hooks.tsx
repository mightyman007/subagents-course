"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  type Progress,
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
 * id. Shows how many of this deck's cards carry a mark from earlier runs.
 */
export function DeckProgressBridge({ deckId, cards }: DeckProgressBridgeProps) {
  const { progress, update, latest } = useProgress();
  const marked = cards.filter((c) => progress.cards[c.id] !== undefined).length;

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