import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

/**
 * Final-exam pass mark sourcing.
 *
 * The pass mark lives in content/exam.yaml as a top-level `passMarkPercent`
 * key — the same `{passMarkPercent, questions: [...]}` shape the content
 * loader's loadExam() understands. BUILD-TIME ONLY: reads the file from disk
 * exactly like the content loaders, and must never reach the client.
 *
 * When the key is absent or not a sane percent (1-100), the course spec's
 * default of 80 applies.
 */

export const DEFAULT_PASS_MARK_PERCENT = 80;

/**
 * Pure: pick `passMarkPercent` out of a parsed exam.yaml document, falling
 * back to the 80% default when it is missing, the wrong type, or outside
 * 1-100. Accepts any parsed YAML (arrays and scalars included) so callers
 * never need to pre-validate the shape.
 */
export function resolvePassMarkPercent(parsed: unknown): number {
  const mark =
    typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>).passMarkPercent
      : undefined;
  if (typeof mark === "number" && Number.isFinite(mark) && mark >= 1 && mark <= 100) {
    return mark;
  }
  return DEFAULT_PASS_MARK_PERCENT;
}

/**
 * Read content/exam.yaml and resolve its pass mark. Never throws: a missing
 * or unparseable file yields the default (a broken exam.yaml is caught by the
 * content loader with a proper ValidationError at build time anyway).
 */
export function readExamPassMark(opts: { root?: string } = {}): number {
  const file = path.resolve(opts.root ?? path.join(process.cwd(), "content"), "exam.yaml");
  if (!fs.existsSync(file)) return DEFAULT_PASS_MARK_PERCENT;
  try {
    return resolvePassMarkPercent(parseYaml(fs.readFileSync(file, "utf8")));
  } catch {
    return DEFAULT_PASS_MARK_PERCENT;
  }
}
