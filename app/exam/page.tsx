import type { Metadata } from "next";
import Link from "next/link";
import { loadExam } from "@/lib/content/load";
import { readExamPassMark } from "@/lib/exam-meta";
import { ExamProgress } from "@/components/exam-progress";

/**
 * Final exam page. Questions are loaded and validated at build time via
 * loadExam() (>=20 enforced); the pass mark comes from exam.yaml's
 * passMarkPercent key, defaulting to 80. Fully data-driven: exam.yaml grows
 * chapter by chapter in later tasks, so nothing here assumes a fixed question
 * count. The interactive exam runs through the ExamProgress client bridge —
 * this module (and lib/content/load) must never reach the client.
 */
export const metadata: Metadata = {
  title: "Final exam — Subagents Mastery",
};

export default function ExamPage() {
  const questions = loadExam();
  const passMark = readExamPassMark();

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <nav>
        <Link href="/learn" className="font-mono text-xs text-muted hover:text-accent">
          &larr; all chapters
        </Link>
      </nav>

      <header className="mt-4">
        <p className="font-mono text-xs text-accent">~/exam</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Final exam
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {questions.length} questions spanning the whole course: the subagent model and context
          isolation, when to dispatch (and when not to), OpenCode V2 and Claude Code tool
          specifics, dispatch crafting, parallel fan-out, the SDD loop, and copy-paste recipes.
          Unlike chapter quizzes there is no feedback while you answer — one submit at the end,
          one score, and a pass/fail verdict (pass mark {passMark}%). Retakes are free; your
          newest result replaces the recorded one.
        </p>
      </header>

      <main className="mt-10">
        {questions.length > 0 ? (
          <ExamProgress questions={questions} passMarkPercent={passMark} />
        ) : (
          <p className="font-mono text-xs text-muted">
            [empty] exam questions not published yet — check back once the next chapters land.
          </p>
        )}
      </main>
    </div>
  );
}