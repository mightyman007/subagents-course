import Link from "next/link";
import { loadChapterSlugs, loadChapter } from "@/lib/content/load";
import { DoneMarker, OverallProgress, RecordedQuizScore } from "@/components/progress-hooks";
import { CHAPTER_DONE_PERCENT } from "@/lib/progress";

/**
 * Course index: one card per chapter, built entirely at build time from the
 * content loaders (no separate metadata loader — loadChapter provides meta,
 * quiz size and deck size). Completion state is per-browser, so the overall
 * progress bar, per-chapter scores and done markers are the client-side
 * pieces here (see OverallProgress, RecordedQuizScore, DoneMarker).
 */
export default function LearnIndex() {
  const slugs = loadChapterSlugs();
  const chapters = slugs.map((slug) => loadChapter(slug));
  const quizTotal = chapters.reduce((sum, c) => sum + c.quiz.length, 0);
  const cardTotal = chapters.reduce((sum, c) => sum + c.flashcards.length, 0);

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <header>
        <p className="font-mono text-xs text-accent">~/learn</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Course chapters
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Work through the chapters in order — each builds on the last. Score{" "}
          {CHAPTER_DONE_PERCENT}% or higher on a chapter quiz to mark it done. The course holds{" "}
          {chapters.length} chapters, {quizTotal} quiz questions, and {cardTotal} flashcards, and
          it finishes with{" "}
          <Link href="/exam" className="text-accent underline-offset-4 hover:underline">
            a final exam
          </Link>
          .
        </p>
      </header>

      <div className="mt-6">
        <OverallProgress totalChapters={chapters.length} />
      </div>

      <p className="mt-4 text-sm text-muted">
        Prefer spaced repetition outside the browser?{" "}
        <Link href="/downloads" className="text-accent underline-offset-4 hover:underline">
          Download the flashcards as an Anki deck
        </Link>{" "}
        — plus the agent templates.
      </p>

      <ol className="mt-10 space-y-4">
        {chapters.map((chapter) => (
          <li key={chapter.meta.slug}>
            <Link
              href={`/learn/${chapter.meta.slug}`}
              className="block rounded-lg border border-line p-5 transition-colors hover:border-accent/60"
            >
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  {chapter.meta.title}
                </h2>
                <DoneMarker chapterId={chapter.meta.slug} />
              </div>
              <p className="mt-2 font-mono text-xs text-muted">
                chapter {String(chapter.meta.order).padStart(2, "0")} ·{" "}
                {chapter.meta.objectives.length} objectives · {chapter.quiz.length} quiz
                questions · {chapter.flashcards.length} flashcards
              </p>
              <RecordedQuizScore chapterId={chapter.meta.slug} />
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
