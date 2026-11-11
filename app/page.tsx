import fs from "node:fs";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";
import { loadChapterSlugs, loadChapter, loadExam } from "@/lib/content/load";

/**
 * Course landing: hero illustration, title, one-paragraph BLUF, a stats row
 * derived at build time from the content loaders (never hardcoded — adding a
 * chapter, an exam question, or a template updates the numbers for free),
 * then the CTAs.
 */
export default function Home() {
  const slugs = loadChapterSlugs();
  const chapterCount = slugs.length;
  const cardTotal = slugs.reduce((sum, slug) => sum + loadChapter(slug).flashcards.length, 0);
  const examCount = loadExam().length;
  const templateCount = fs
    .readdirSync(path.join(process.cwd(), "public", "downloads", "agents"))
    .filter((file) => file.endsWith(".md")).length;

  const stats = [
    { label: "chapters", value: chapterCount },
    { label: "exam questions", value: examCount },
    { label: "flashcards", value: cardTotal },
    { label: "agent templates", value: templateCount },
  ];

  return (
    <div className="flex flex-1 flex-col justify-center px-6 py-16">
      <main className="mx-auto w-full max-w-2xl">
        <Image
          src="/images/learn/hero.svg"
          alt="Abstract illustration: a parent context dispatching tasks to three isolated subagent contexts, with results flowing back"
          width={1200}
          height={630}
          priority
          className="w-full rounded-xl border border-line"
        />

        <p className="mt-10 font-mono text-sm text-muted">
          <span className="text-accent">~$</span> ./subagents-mastery --init
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Subagents Mastery
        </h1>
        <p className="mt-3 leading-relaxed text-muted">
          Learn to dispatch AI coding subagents — child sessions with fresh context that do the
          work while your main conversation stays clean. Nine chapters take you from the core
          model through custom agent files in OpenCode V2 and Claude Code, to orchestration,
          parallel dispatch, and copy-paste recipes — with quizzes, flashcards, a final exam, and
          ready-to-use agent templates.
        </p>

        <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg border border-line p-3">
              <dt className="font-mono text-xs text-muted">{stat.label}</dt>
              <dd className="mt-1 font-mono text-xl text-foreground">{stat.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/learn"
            className="rounded border border-accent px-4 py-2 font-mono text-sm text-accent transition-colors hover:bg-accent/10"
          >
            &gt; start learning
          </Link>
          <Link
            href="/exam"
            className="rounded border border-line px-4 py-2 font-mono text-sm text-muted transition-colors hover:border-accent hover:text-accent"
          >
            &gt; take the final exam
          </Link>
          <Link
            href="/downloads"
            className="rounded border border-line px-4 py-2 font-mono text-sm text-muted transition-colors hover:border-accent hover:text-accent"
          >
            &gt; downloads
          </Link>
          <span className="font-mono text-xs text-muted">no account · progress stays in your browser</span>
        </div>
      </main>
    </div>
  );
}
