import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { parse as parseYaml } from "yaml";
import {
  validateFlashcards,
  validateQuestionSet,
  ValidationError,
  type ChapterMeta,
  type Flashcard,
  type Question,
} from "./schema";

/**
 * Content loader for the Subagents Mastery course.
 *
 * SERVER-ONLY / BUILD-TIME: reads `content/**` from disk with Node fs. It must
 * NEVER be imported by a client component — pages load content here and pass
 * plain data down.
 *
 * Paths are rooted at `content/` under `process.cwd()`:
 *   content/chapters/<NN-slug>/index.mdx | quiz.yaml | flashcards.yaml
 *   content/exam.yaml                    (optional, arrives in Task 8)
 *
 * Tests override the root via `{ root }` (e.g. `tests/fixtures`).
 */

export type { ChapterMeta, Flashcard, Question } from "./schema";
export { ValidationError } from "./schema";

export interface LoaderOptions {
  /** Content root directory. Defaults to `<process.cwd()>/content`. */
  root?: string;
}

export interface LoadExamOptions extends LoaderOptions {
  /** Minimum number of exam questions. Defaults to 20 per the design. */
  min?: number;
}

export interface LoadedChapter {
  meta: ChapterMeta;
  mdxSource: string;
  quiz: Question[];
  flashcards: Flashcard[];
}

const CHAPTER_QUIZ_MIN = 3;
const CHAPTER_FLASHCARDS_MIN = 6;
const EXAM_MIN_DEFAULT = 20;

function contentRoot(opts?: LoaderOptions): string {
  return path.resolve(opts?.root ?? path.join(process.cwd(), "content"));
}

function chaptersDir(opts?: LoaderOptions): string {
  return path.join(contentRoot(opts), "chapters");
}

/** Validate frontmatter into ChapterMeta; throws with `frontmatter.*` paths. */
function extractMeta(slug: string, data: Record<string, unknown>): ChapterMeta {
  const issues: { path: string; message: string }[] = [];
  const title = data.title;
  if (typeof title !== "string" || title.trim() === "") {
    issues.push({ path: "frontmatter.title", message: "must be a non-empty string" });
  }
  const order = data.order;
  if (typeof order !== "number" || !Number.isInteger(order)) {
    issues.push({ path: "frontmatter.order", message: "must be an integer" });
  }
  const objectives = data.objectives;
  if (
    !Array.isArray(objectives) ||
    objectives.length < 1 ||
    !objectives.every((o) => typeof o === "string" && o.trim() !== "")
  ) {
    issues.push({
      path: "frontmatter.objectives",
      message: "must be a non-empty array of non-empty strings",
    });
  }
  if (issues.length > 0) {
    throw new ValidationError(issues, `chapter ${slug}: invalid frontmatter`);
  }
  return { slug, title: title as string, order: order as number, objectives: objectives as string[] };
}

/** Parse one chapter's index.mdx frontmatter (throws if incomplete). */
function readChapterFrontmatter(chapterDir: string, slug: string): ChapterMeta {
  const mdxPath = path.join(chapterDir, "index.mdx");
  const { data } = matter(fs.readFileSync(mdxPath, "utf8"));
  return extractMeta(slug, (data ?? {}) as Record<string, unknown>);
}

/**
 * Authoring-form normalization so YAML can use the design's shorthand:
 * - boolean questions may omit `options` (defaults to ["True","False"]) and may
 *   write `correct: true|false` instead of an index array
 * - single/multi questions may write `correct: 1` instead of `correct: [1]`
 * Explicitly-provided options are never overridden (schema still rejects
 * boolean options ≠ ["True","False"]).
 */
function normalizeQuestion(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  const r = { ...(raw as Record<string, unknown>) };
  if (r.type === "boolean") {
    if (r.options === undefined) r.options = ["True", "False"];
    if (typeof r.correct === "boolean") r.correct = r.correct ? [0] : [1];
  }
  if (typeof r.correct === "number") r.correct = [r.correct];
  return r;
}

/** Read + parse a YAML file that must contain an array. */
function loadYamlArray(file: string, label: string): unknown[] {
  if (!fs.existsSync(file)) {
    throw new ValidationError([{ path: label, message: `missing required file ${file}` }], label);
  }
  let parsed: unknown;
  try {
    parsed = parseYaml(fs.readFileSync(file, "utf8"));
  } catch (e) {
    throw new ValidationError(
      [{ path: label, message: `invalid YAML: ${(e as Error).message}` }],
      label,
    );
  }
  if (!Array.isArray(parsed)) {
    throw new ValidationError([{ path: label, message: "expected a YAML array" }], label);
  }
  return parsed;
}

/**
 * Files a chapter directory may contain. A directory holding any of the
 * content files but missing index.mdx is an incomplete chapter: it would
 * silently vanish from /learn and generateStaticParams, so the loader must
 * fail the build instead of filtering it out. Directories with none of these
 * files (empty, or stray files like .DS_Store) are safe to ignore.
 */
const CHAPTER_FILES = ["index.mdx", "quiz.yaml", "flashcards.yaml"] as const;

/**
 * All chapter slugs (directory names under content/chapters/), sorted by
 * frontmatter `order` ascending, ties broken by slug.
 */
export function loadChapterSlugs(opts: LoaderOptions = {}): string[] {
  const dir = chaptersDir(opts);
  if (!fs.existsSync(dir)) {
    throw new ValidationError(
      [{ path: "chapters", message: `chapters directory not found: ${dir}` }],
      "content root",
    );
  }
  const metas: ChapterMeta[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const chapterDir = path.join(dir, entry.name);
    const present = new Set(fs.readdirSync(chapterDir));
    if (!present.has("index.mdx")) {
      if (CHAPTER_FILES.some((f) => present.has(f))) {
        throw new ValidationError(
          [
            {
              path: `chapters.${entry.name}`,
              message: `missing index.mdx — chapter "${entry.name}" will not render because there is no frontmatter to derive its slug/title/order from; add an index.mdx or remove the directory`,
            },
          ],
          "incomplete chapter directory",
        );
      }
      continue; // empty or irrelevant directory (e.g. only .DS_Store) — safe to ignore
    }
    metas.push(readChapterFrontmatter(chapterDir, entry.name));
  }
  return metas
    .sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug))
    .map((m) => m.slug);
}

/**
 * Load one chapter: frontmatter meta, MDX body (frontmatter stripped),
 * validated quiz (≥3 questions) and flashcard deck (≥6 cards).
 */
export function loadChapter(slug: string, opts: LoaderOptions = {}): LoadedChapter {
  const dir = path.join(chaptersDir(opts), slug);
  const mdxPath = path.join(dir, "index.mdx");
  if (!fs.existsSync(mdxPath)) {
    throw new ValidationError(
      [{ path: "slug", message: `unknown chapter "${slug}" (missing ${mdxPath})` }],
      "chapter",
    );
  }
  const { data, content } = matter(fs.readFileSync(mdxPath, "utf8"));
  const meta = extractMeta(slug, (data ?? {}) as Record<string, unknown>);
  const quiz = validateQuestionSet(
    loadYamlArray(path.join(dir, "quiz.yaml"), "quiz").map(normalizeQuestion),
    { min: CHAPTER_QUIZ_MIN },
  );
  const flashcards = validateFlashcards(loadYamlArray(path.join(dir, "flashcards.yaml"), "flashcards"), {
    min: CHAPTER_FLASHCARDS_MIN,
  });
  return { meta, mdxSource: content, quiz, flashcards };
}

/**
 * Final exam questions from content/exam.yaml, or [] when the file is absent
 * (exam data arrives in Task 8). Supports either a top-level YAML array of
 * questions or `{passMarkPercent, questions: [...]}`.
 */
export function loadExam(opts: LoadExamOptions = {}): Question[] {
  const file = path.join(contentRoot(opts), "exam.yaml");
  if (!fs.existsSync(file)) return [];
  let parsed: unknown;
  try {
    parsed = parseYaml(fs.readFileSync(file, "utf8"));
  } catch (e) {
    throw new ValidationError(
      [{ path: "exam", message: `invalid YAML: ${(e as Error).message}` }],
      "exam",
    );
  }
  const raw =
    typeof parsed === "object" && parsed !== null && Array.isArray((parsed as Record<string, unknown>).questions)
      ? (parsed as { questions: unknown[] }).questions
      : parsed;
  if (!Array.isArray(raw)) {
    throw new ValidationError(
      [{ path: "exam", message: "expected a YAML array of questions (or {questions: [...]})" }],
      "exam",
    );
  }
  return validateQuestionSet(raw.map(normalizeQuestion), { min: opts.min ?? EXAM_MIN_DEFAULT });
}
