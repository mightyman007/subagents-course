"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Question } from "@/lib/content/schema";
import { Exam } from "@/components/exam";
import {
  DEFAULT_PROGRESS,
  loadProgress,
  saveProgress,
  recordExam,
  type Progress,
} from "@/lib/progress";

/**
 * Client bridge between the final exam and the progress store — the exam-page
 * counterpart of QuizProgressBridge/DeckProgressBridge in components/
 * progress-hooks.tsx and, like them, the ONLY place where the component's
 * callbacks touch storage: <Exam> stays storage-free, lib/progress stays
 * component-free, and this file composes the two.
 *
 * Hydration rule (same as progress-hooks, binding): progress is NEVER read
 * during the initial render. Initial state is the deterministic
 * DEFAULT_PROGRESS and the stored value is read inside a mount effect — one
 * deterministic render, then an update.
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

interface ExamProgressProps {
  /** Validated exam questions, loaded at build time by app/exam/page.tsx. */
  questions: Question[];
  /** Percent (0-100) at or above which the exam is passed. */
  passMarkPercent: number;
}

/**
 * `<Exam>` wired to real progress: the result is recorded on submit, and a
 * retake clears the recorded exam (leaving every other progress entry —
 * quizzes, chapters, cards — untouched). Shows the previously recorded
 * attempt, when there is one.
 */
export function ExamProgress({ questions, passMarkPercent }: ExamProgressProps) {
  const { progress, update, latest } = useProgress();
  const recorded = progress.exam;

  return (
    <div className="space-y-3" data-exam-progress>
      {recorded && (
        <p className="font-mono text-xs text-muted">
          [saved] last attempt: {recorded.score}/{recorded.total} ·{" "}
          {recorded.passed ? "passed" : "not passed"}
        </p>
      )}
      <Exam
        questions={questions}
        passMarkPercent={passMarkPercent}
        onComplete={({ score, total }) => {
          update(recordExam(latest.current, score, total, passMarkPercent));
        }}
        onRetake={() => {
          // Retaking invalidates the exam result only — nothing else.
          update({ ...latest.current, exam: null });
        }}
      />
    </div>
  );
}