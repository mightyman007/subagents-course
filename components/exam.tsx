"use client";

import { useState } from "react";
import type { Question } from "@/lib/content/schema";
import { gradeQuiz } from "@/lib/quiz";

interface ExamProps {
  /** Exam questions (validated upstream by the content layer). */
  questions: Question[];
  /** Percent (0–100) at or above which the exam is passed. */
  passMarkPercent: number;
  /**
   * Optional hook fired once on submit with the graded result. Progress
   * persistence wires through this later — this component never touches
   * storage itself.
   */
  onComplete?: (result: { score: number; total: number; percent: number }) => void;
  /** Optional hook fired when the reader retakes (used later to clear persisted exam progress). */
  onRetake?: () => void;
}

/**
 * Final exam: no feedback while answering; results + pass/fail appear only
 * after the full exam is submitted; retake resets everything.
 * Passed = percent ≥ passMarkPercent.
 */
export function Exam({ questions, passMarkPercent, onComplete, onRetake }: ExamProps) {
  const [picked, setPicked] = useState<Record<string, number[]>>({});
  const [submitted, setSubmitted] = useState(false);

  const allAnswered =
    questions.length > 0 && questions.every((q) => (picked[q.id] ?? []).length > 0);
  const result = gradeQuiz(questions, picked);
  const passed = result.percent >= passMarkPercent;
  /** Per-question verdicts, only meaningful after submit. */
  const verdicts = submitted ? result.results : null;

  function toggle(q: Question, index: number) {
    if (submitted) return;
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

  function submitExam() {
    if (submitted || !allAnswered) return;
    setSubmitted(true);
    onComplete?.({ score: result.score, total: result.total, percent: result.percent });
  }

  function retake() {
    setPicked({});
    setSubmitted(false);
    onRetake?.();
  }

  return (
    <div className="space-y-6">
      {questions.map((q, qi) => {
        const p = picked[q.id] ?? [];
        const gradedHere = verdicts?.[qi].correct ?? false;
        return (
          <fieldset key={q.id} className="rounded-lg border border-line p-4 sm:p-5">
            <legend className="px-2 text-sm font-medium text-foreground">{q.prompt}</legend>
            <div className="mt-2 space-y-2">
              {q.options.map((opt, i) => {
                const selected = p.includes(i);
                const isRight = q.correct.includes(i);
                const state = !submitted
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
                    disabled={submitted}
                    onClick={() => toggle(q, i)}
                    className={`block w-full rounded border px-3 py-2 text-left text-sm transition-colors ${state}`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
            {submitted && (
              <div className="mt-3">
                <p
                  className={`font-mono text-xs ${
                    gradedHere ? "text-accent" : "text-red-400"
                  }`}
                >
                  {gradedHere ? "Correct" : "Incorrect"}
                </p>
                <p className="mt-1 border-l-2 border-line pl-3 text-xs text-muted">
                  {q.explanation}
                </p>
              </div>
            )}
          </fieldset>
        );
      })}

      {!submitted ? (
        <button
          type="button"
          onClick={submitExam}
          disabled={!allAnswered}
          className="rounded border border-accent px-3 py-1.5 font-mono text-xs text-accent transition-colors hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Submit exam
        </button>
      ) : (
        <div className="rounded-lg border border-line p-4">
          <p className="font-mono text-xs text-accent">[done] exam complete</p>
          <p className="mt-1 text-sm text-foreground">
            {result.score}/{result.total} ({result.percent}%)
          </p>
          <p
            className={`mt-1 font-mono text-sm ${passed ? "text-accent" : "text-red-400"}`}
          >
            {passed ? "PASSED" : "FAILED"}
          </p>
          <p className="mt-1 font-mono text-xs text-muted">pass mark {passMarkPercent}%</p>
          <button
            type="button"
            onClick={retake}
            className="mt-3 rounded border border-line px-3 py-1.5 font-mono text-xs text-foreground transition-colors hover:border-accent hover:text-accent"
          >
            Retake
          </button>
        </div>
      )}
    </div>
  );
}