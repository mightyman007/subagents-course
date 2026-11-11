"use client";

import { useState } from "react";
import type { Question } from "@/lib/content/schema";
import { gradeQuestion, gradeQuiz } from "@/lib/quiz";

interface QuizProps {
  /** Questions for this chapter's quiz (validated upstream by the content layer). */
  questions: Question[];
  /** Chapter the quiz belongs to (used by progress wiring in a later task). */
  chapterId: string;
  /**
   * Optional completion hook, fired once when the last question is graded.
   * Progress persistence wires through this later — this component never
   * touches storage itself.
   */
  onComplete?: (result: { score: number; total: number; percent: number }) => void;
}

/**
 * Chapter quiz: per-question instant feedback with explanation, then a score
 * summary once every question has been submitted.
 */
export function Quiz({ questions, chapterId, onComplete }: QuizProps) {
  const [picked, setPicked] = useState<Record<string, number[]>>({});
  const [graded, setGraded] = useState<Record<string, boolean>>({});

  const allGraded = questions.length > 0 && questions.every((q) => graded[q.id] !== undefined);
  const summary = allGraded ? gradeQuiz(questions, picked) : null;

  function toggle(q: Question, index: number) {
    if (graded[q.id] !== undefined) return;
    setPicked((prev) => {
      const current = prev[q.id] ?? [];
      const next =
        q.type === "multi"
          ? current.includes(index)
            ? current.filter((i) => i !== index)
            : [...current, index]
          : [index];
      return { ...prev, [q.id]: next };
    });
  }

  function submit(q: Question) {
    if (graded[q.id] !== undefined) return;
    const p = picked[q.id] ?? [];
    if (p.length === 0) return;
    const nextGraded = { ...graded, [q.id]: gradeQuestion(q, p).correct };
    setGraded(nextGraded);
    if (questions.length > 0 && questions.every((x) => nextGraded[x.id] !== undefined)) {
      const { score, total, percent } = gradeQuiz(questions, picked);
      onComplete?.({ score, total, percent });
    }
  }

  return (
    <div data-chapter-id={chapterId} className="space-y-6">
      {questions.map((q) => {
        const isGraded = graded[q.id] !== undefined;
        const p = picked[q.id] ?? [];
        return (
          <fieldset key={q.id} className="rounded-lg border border-line p-4 sm:p-5">
            <legend className="px-2 text-sm font-medium text-foreground">{q.prompt}</legend>
            <div className="mt-2 space-y-2">
              {q.options.map((opt, i) => {
                const selected = p.includes(i);
                const isRight = q.correct.includes(i);
                const state = !isGraded
                  ? selected
                    ? "border-accent text-accent"
                    : "border-line text-foreground hover:border-accent/60"
                  : isRight
                    ? "border-accent text-accent"
                    : selected
                      ? "border-red-400 text-red-400"
                      : "border-line text-muted";
                return (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={selected}
                    disabled={isGraded}
                    onClick={() => toggle(q, i)}
                    className={`block w-full rounded border px-3 py-2 text-left text-sm transition-colors ${state}`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            {isGraded ? (
              <div className="mt-3">
                <p
                  className={`font-mono text-xs ${
                    graded[q.id] ? "text-accent" : "text-red-400"
                  }`}
                >
                  {graded[q.id] ? "Correct" : "Incorrect"}
                </p>
                <p className="mt-1 border-l-2 border-line pl-3 text-xs text-muted">
                  {q.explanation}
                </p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => submit(q)}
                disabled={p.length === 0}
                className="mt-3 rounded border border-accent px-3 py-1.5 font-mono text-xs text-accent transition-colors hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Submit
              </button>
            )}
          </fieldset>
        );
      })}
      {summary && (
        <div className="rounded-lg border border-line p-4">
          <p className="font-mono text-xs text-accent">[done] quiz complete</p>
          <p className="mt-1 text-sm text-foreground">
            {summary.score}/{summary.total} ({summary.percent}%)
          </p>
        </div>
      )}
    </div>
  );
}