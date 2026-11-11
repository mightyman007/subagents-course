import type { Metadata } from "next";
import Link from "next/link";
import fs from "node:fs";
import path from "node:path";
import { CopyButton } from "@/components/copy-button";
import { loadChapter, loadChapterSlugs } from "@/lib/content/load";

/**
 * Downloads: the Anki deck plus the two agent templates. Static-only — the
 * .apkg is pre-generated and committed (see scripts/export-anki.py), so this
 * page needs no Python at build time. Agent-template text is read from
 * public/ at build time and passed to the client copy buttons as plain data.
 */
export const metadata: Metadata = {
  title: "Downloads — Subagents Mastery",
};

interface AgentTemplate {
  file: string;
  tool: string;
  /** One-line description shown under the template name. */
  description: string;
  /** Where the file goes after copy/download (directory + filename). */
  installPath: string;
}

const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    file: "opencode-reviewer.md",
    tool: "OpenCode V2",
    description:
      "Code-reviewer subagent, read-only by design: edit and shell actions are denied, findings reported by severity.",
    installPath: ".opencode/agents/opencode-reviewer.md",
  },
  {
    file: "claude-code-reviewer.md",
    tool: "Claude Code",
    description:
      "The same reviewer as a Claude Code subagent file: tools limited to Read, Glob, and Grep.",
    installPath: ".claude/agents/code-reviewer.md",
  },
];

function readTemplate(file: string): string {
  return fs.readFileSync(path.join(process.cwd(), "public", "downloads", "agents", file), "utf8");
}

export default function DownloadsPage() {
  const chapters = loadChapterSlugs().map((slug) => loadChapter(slug));
  const cardTotal = chapters.reduce((sum, c) => sum + c.flashcards.length, 0);

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <nav>
        <Link href="/learn" className="font-mono text-xs text-muted hover:text-accent">
          &larr; all chapters
        </Link>
      </nav>

      <header className="mt-4">
        <p className="font-mono text-xs text-accent">~/downloads</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Downloads
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Take the course material with you: the full flashcard collection as an Anki deck, and
          the two ready-to-use code-reviewer agent templates.
        </p>
      </header>

      <section className="mt-10">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Anki deck</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {cardTotal} cards across {chapters.length} chapter decks — one Anki sub-deck per
          chapter, generated from the same flashcards you can flip in the browser.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <a
            href="/downloads/subagents-course.apkg"
            download
            className="rounded border border-accent px-4 py-2 font-mono text-sm text-accent transition-colors hover:bg-accent/10"
          >
            &darr; subagents-course.apkg
          </a>
          <span className="font-mono text-xs text-muted">.apkg · works with Anki 2.1+ and AnkiDroid/AnkiMobile</span>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-muted">
          Import via <span className="font-mono text-xs text-foreground">File &rarr; Import</span>{" "}
          (or double-click the file). Cards are organized as one sub-deck per chapter under{" "}
          <span className="font-mono text-xs text-foreground">Subagents Mastery</span>, so you can
          study chapter by chapter. Re-importing a newer version of the deck updates your existing
          cards instead of duplicating them — note ids are stable.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">Agent templates</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          The code-reviewer agents used throughout the course, ready to drop into your own setup.
        </p>
        <ul className="mt-4 space-y-4">
          {AGENT_TEMPLATES.map((template) => (
            <li key={template.file} className="rounded-lg border border-line p-5">
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="font-mono text-sm font-semibold text-foreground">{template.file}</h3>
                <CopyButton text={readTemplate(template.file)} label={`copy ${template.tool} template`} />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted">{template.description}</p>
              <p className="mt-2 font-mono text-xs text-muted">
                install at <span className="text-accent">{template.installPath}</span> ·{" "}
                <a
                  href={`/downloads/agents/${template.file}`}
                  download
                  className="underline-offset-4 hover:text-accent hover:underline"
                >
                  download the file
                </a>
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}