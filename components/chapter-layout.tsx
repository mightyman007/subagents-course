import Link from "next/link";
import { MDXRemote } from "next-mdx-remote/rsc";
import { Mermaid } from "@/components/mermaid";
import { AnimatedDiagram } from "@/components/animated-diagram";
import { YouTubeEmbed } from "@/components/youtube-embed";
import { VideoPlaceholder } from "@/components/video-placeholder";
import { DeckProgressBridge, QuizProgressBridge } from "@/components/progress-hooks";
import { CHAPTER_DONE_PERCENT } from "@/lib/progress";
import type { LoadedChapter } from "@/lib/content/load";

/** Component map accepted by next-mdx-remote's RSC MDXRemote. */
type MdxComponents = NonNullable<React.ComponentProps<typeof MDXRemote>["components"]>;

interface ChapterLayoutProps {
  /** Fully loaded chapter (meta + MDX body + validated quiz + deck). */
  chapter: LoadedChapter;
  /** Previous chapter in course order, absent on the first chapter. */
  prev?: { slug: string; title: string };
  /** Next chapter in course order, absent on the last chapter. */
  next?: { slug: string; title: string };
}

/**
 * Components available to chapter MDX bodies. The media components are
 * referenced by name inside MDX; the element overrides keep long-form prose
 * on the site's dark tokens (there is no typography plugin — these ARE the
 * typography). Client components passed here hydrate normally.
 */
const mdxComponents: MdxComponents = {
  Mermaid,
  AnimatedDiagram,
  YouTubeEmbed,
  VideoPlaceholder,
  // Headings keep their semantic level (the page h1 is the chapter title;
  // body sections are h2/h3) — only styling is overridden here.
  h1: (props) => (
    <h1
      className="mt-10 text-2xl font-semibold tracking-tight text-foreground"
      {...props}
    />
  ),
  h2: (props) => (
    <h2
      className="mt-10 text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
      {...props}
    />
  ),
  h3: (props) => (
    <h3 className="mt-8 text-lg font-semibold tracking-tight text-foreground" {...props} />
  ),
  p: (props) => <p className="mt-4 leading-relaxed text-muted" {...props} />,
  ul: (props) => <ul className="mt-4 list-disc space-y-2 pl-6 text-muted" {...props} />,
  ol: (props) => <ol className="mt-4 list-decimal space-y-2 pl-6 text-muted" {...props} />,
  a: (props) => (
    <a className="text-accent underline-offset-4 hover:underline" {...props} />
  ),
  strong: (props) => <strong className="font-semibold text-foreground" {...props} />,
  em: (props) => <em className="italic text-foreground" {...props} />,
  blockquote: (props) => (
    <blockquote
      className="mt-4 border-l-2 border-accent/40 pl-4 italic text-muted"
      {...props}
    />
  ),
  code: (props) => (
    <code
      className="rounded border border-line bg-line/40 px-1.5 py-0.5 font-mono text-[0.85em] text-accent"
      {...props}
    />
  ),
  pre: (props) => (
    <pre
      className="mt-4 overflow-x-auto rounded-lg border border-line bg-line/30 p-4 font-mono text-xs leading-relaxed text-foreground [&_code]:border-0 [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-foreground"
      {...props}
    />
  ),
  img: ({ alt = "", ...rest }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // Static-export images are unoptimized; markdown images in MDX land here.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      loading="lazy"
      alt={alt}
      className="mt-6 rounded-lg border border-line"
      {...rest}
    />
  ),
  hr: () => <hr className="my-10 border-line" />,
  table: (props) => (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm" {...props} />
    </div>
  ),
  th: (props) => (
    <th
      className="border-b border-line px-3 py-2 font-mono text-xs font-medium text-accent"
      {...props}
    />
  ),
  td: (props) => <td className="border-b border-line px-3 py-2 align-top text-muted" {...props} />,
};

/**
 * The full chapter page body: header + objectives, MDX lesson, quiz and
 * flashcard deck wired to real progress, then prev/next navigation.
 * Server component — content was loaded at build time; only the embedded
 * bridges are client-side.
 */
export function ChapterLayout({ chapter, prev, next }: ChapterLayoutProps) {
  const { meta, mdxSource, quiz, flashcards } = chapter;
  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <nav>
        <Link href="/learn" className="font-mono text-xs text-muted hover:text-accent">
          &larr; all chapters
        </Link>
      </nav>

      <header className="mt-4">
        <p className="font-mono text-xs text-accent">
          chapter {String(meta.order).padStart(2, "0")}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {meta.title}
        </h1>
        <div className="mt-6 rounded-lg border border-line p-4 sm:p-5">
          <p className="font-mono text-xs text-muted">objectives</p>
          <ul className="mt-2 space-y-1.5">
            {meta.objectives.map((objective) => (
              <li key={objective} className="flex gap-2 text-sm text-foreground">
                <span aria-hidden className="font-mono text-accent">
                  &gt;
                </span>
                {objective}
              </li>
            ))}
          </ul>
        </div>
      </header>

      <main className="mt-2">
        {/* Chapter MDX is first-party content compiled at build time (never
            user input), so the JS-expression block is off: the Mermaid charts
            are authored as {`...`} template-literal attributes, which the
            default blockJS mode would strip. The dangerous-calls guard still
            applies by default. */}
        <MDXRemote source={mdxSource} components={mdxComponents} options={{ blockJS: false }} />
      </main>

      <section id="quiz" className="mt-14 scroll-mt-8">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Check yourself</h2>
        <p className="mt-2 text-sm text-muted">
          Submit each question for instant feedback. Score {CHAPTER_DONE_PERCENT}% or higher
          and this chapter counts as done.
        </p>
        <div className="mt-6">
          <QuizProgressBridge chapterId={meta.slug} questions={quiz} />
        </div>
      </section>

      <section id="deck" className="mt-14 scroll-mt-8">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Flashcards</h2>
        <p className="mt-2 text-sm text-muted">
          Flip each card, then mark it honestly — marks are saved per card.
        </p>
        <div className="mt-6">
          <DeckProgressBridge deckId={meta.slug} cards={flashcards} />
        </div>
      </section>

      <nav aria-label="Chapter navigation" className="mt-14 flex justify-between gap-4">
        {prev ? (
          <Link
            href={`/learn/${prev.slug}`}
            className="rounded-lg border border-line px-4 py-3 text-sm text-muted transition-colors hover:border-accent/60 hover:text-foreground"
          >
            <span aria-hidden className="font-mono text-xs text-accent">
              prev
            </span>
            <span className="mt-1 block">{prev.title}</span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={`/learn/${next.slug}`}
            className="rounded-lg border border-line px-4 py-3 text-right text-sm text-muted transition-colors hover:border-accent/60 hover:text-foreground"
          >
            <span aria-hidden className="font-mono text-xs text-accent">
              next
            </span>
            <span className="mt-1 block">{next.title}</span>
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
