import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadChapterSlugs, loadChapter } from "@/lib/content/load";
import { ChapterLayout } from "@/components/chapter-layout";

/**
 * A full chapter page. Content is loaded from disk at build time — this
 * module (and lib/content/load) must never reach the client; everything the
 * interactive pieces need is passed down as plain data.
 *
 * dynamicParams=false: the course has a fixed set of chapters, all returned
 * by generateStaticParams, and the static export cannot render anything else.
 */
export const dynamicParams = false;

export function generateStaticParams(): { slug: string }[] {
  return loadChapterSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const chapter = loadChapter(slug);
  return { title: `${chapter.meta.title} — Subagents Mastery` };
}

export default async function ChapterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const slugs = loadChapterSlugs();
  const index = slugs.indexOf(slug);
  if (index === -1) notFound();

  const chapter = loadChapter(slug);
  const prev = index > 0 ? loadChapter(slugs[index - 1]).meta : undefined;
  const next = index < slugs.length - 1 ? loadChapter(slugs[index + 1]).meta : undefined;

  return <ChapterLayout chapter={chapter} prev={prev} next={next} />;
}
