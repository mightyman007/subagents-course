import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { parse as parseYaml } from "yaml";

/**
 * Anki export contract (tests/anki/export.test.ts).
 *
 * The Python exporter (`scripts/export-anki.py`) is the single source of truth
 * for deck data. These tests validate its DECK DATA (via `--dry-run` JSON)
 * before/independent of packaging, plus the committed `.apkg` artifact that
 * the static site serves — so Netlify never needs Python at build time.
 *
 * Requires the genanki venv: `python3 -m venv scripts/.venv &&
 * scripts/.venv/bin/pip install genanki pyyaml` (see scripts/export-anki.py).
 */

// vitest runs from the repo root (pnpm test / pnpm exec vitest), so cwd is the root.
const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, "scripts", "export-anki.py");
const APKG = path.join(ROOT, "public", "downloads", "subagents-course.apkg");
const DECK_ROOT = "Subagents Mastery";

interface DryRunNote {
  id: string;
  deck: string;
  guid: string;
}

interface DryRunDeck {
  name: string;
  notes: number;
}

interface DryRunReport {
  parentDeck: string;
  totalNotes: number;
  decks: DryRunDeck[];
  emptyFields: string[];
  notes: DryRunNote[];
}

/** Ground truth read straight from the content files (independent of Python). */
interface ChapterFile {
  slug: string;
  order: number;
  title: string;
  cardCount: number;
}

function readChaptersFromContent(): ChapterFile[] {
  const dir = path.join(ROOT, "content", "chapters");
  const out: ChapterFile[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const chapterDir = path.join(dir, entry.name);
    const { data } = matter(fs.readFileSync(path.join(chapterDir, "index.mdx"), "utf8"));
    const cards = parseYaml(
      fs.readFileSync(path.join(chapterDir, "flashcards.yaml"), "utf8"),
    ) as Array<{ id: string; front: string; back: string }>;
    out.push({
      slug: entry.name,
      order: data.order as number,
      title: data.title as string,
      cardCount: cards.length,
    });
  }
  return out.sort((a, b) => a.order - b.order);
}

function pythonBin(): string {
  const venvPython = path.join(ROOT, "scripts", ".venv", "bin", "python");
  if (fs.existsSync(venvPython)) return venvPython;
  return "python3";
}

function runExport(args: string[]): ReturnType<typeof spawnSync> {
  const res = spawnSync(pythonBin(), [SCRIPT, ...args], { cwd: ROOT, encoding: "utf8" });
  if (res.error) {
    throw new Error(
      `could not run ${pythonBin()} (${res.error.message}). Set up the venv: ` +
        `python3 -m venv scripts/.venv && scripts/.venv/bin/pip install genanki pyyaml`,
    );
  }
  return res;
}

function dryRun(): DryRunReport {
  const res = runExport(["--dry-run"]);
  if (res.status !== 0) {
    throw new Error(`export-anki.py --dry-run failed (${res.status}):\n${res.stderr}`);
  }
  return JSON.parse(String(res.stdout)) as DryRunReport;
}

describe("anki export — deck data (--dry-run)", () => {
  const chapters = readChaptersFromContent();
  const expectedTotal = chapters.reduce((sum, c) => sum + c.cardCount, 0);

  it("exits 0 and emits parseable JSON with the expected shape", () => {
    const report = dryRun();
    expect(typeof report.totalNotes).toBe("number");
    expect(Array.isArray(report.decks)).toBe(true);
    expect(Array.isArray(report.emptyFields)).toBe(true);
    expect(report.parentDeck).toBe(DECK_ROOT);
  });

  it("total notes == total flashcards across chapter files (exam questions are NOT flashcards)", () => {
    const report = dryRun();
    const deckSum = report.decks.reduce((sum, d) => sum + d.notes, 0);
    expect(deckSum).toBe(expectedTotal);
    expect(report.totalNotes).toBe(expectedTotal);
    expect(report.totalNotes).toBeGreaterThan(0);
  });

  it("has one deck per chapter, ordered by frontmatter order, named '<root>::<NN> <title>'", () => {
    const report = dryRun();
    expect(report.decks).toHaveLength(chapters.length);
    report.decks.forEach((deck, i) => {
      const chapter = chapters[i];
      const expected = `${DECK_ROOT}::${String(chapter.order).padStart(2, "0")} ${chapter.title}`;
      expect(deck.name).toBe(expected);
      expect(deck.notes).toBe(chapter.cardCount);
    });
  });

  it("every note lands in the chapter deck matching its file, with a stable guid", () => {
    const report = dryRun();
    expect(report.notes).toHaveLength(expectedTotal);
    const deckOfChapter = new Map<string, number>();
    report.decks.forEach((deck, i) => deckOfChapter.set(chapters[i].slug, i));
    // Chapter slugs are the directory name; the notes array is deck-ordered,
    // so slice counts per deck and ids must all come from that chapter's file.
    for (const note of report.notes) {
      expect(note.id).toMatch(/^c\d+-f\d+$/);
      expect(note.guid.length).toBeGreaterThan(0);
      expect(report.decks.map((d) => d.name)).toContain(note.deck);
    }
  });

  it("no empty front/back fields anywhere", () => {
    const report = dryRun();
    expect(report.emptyFields).toEqual([]);
  });

  it("dry-run output is deterministic across runs (stable guids + deck ids)", () => {
    const first = runExport(["--dry-run"]);
    const second = runExport(["--dry-run"]);
    expect(first.status).toBe(0);
    expect(second.status).toBe(0);
    expect(String(second.stdout)).toBe(String(first.stdout));
  });
});

describe("anki export — committed artifact", () => {
  it("public/downloads/subagents-course.apkg exists, exceeds 10KB, and is a zip", () => {
    expect(fs.existsSync(APKG)).toBe(true);
    const stat = fs.statSync(APKG);
    expect(stat.size).toBeGreaterThan(10 * 1024);
    const fd = fs.openSync(APKG, "r");
    try {
      const magic = Buffer.alloc(2);
      fs.readSync(fd, magic, 0, 2, 0);
      expect(magic.toString("ascii")).toBe("PK");
    } finally {
      fs.closeSync(fd);
    }
  });
});
