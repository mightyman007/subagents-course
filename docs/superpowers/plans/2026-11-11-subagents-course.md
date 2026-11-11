# Subagents Mastery Course Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an interactive static course site teaching subagent usage (OpenCode V2 + Claude Code) with quizzes, a final exam, flashcards (+ Anki export), diagrams, AI photos, and video embeds.

**Architecture:** Next.js App Router static export (`output: 'export'`), Tailwind v4, MDX chapters via `next-mdx-remote` + `gray-matter` loaded from `content/chapters/`, client components for interactivity, zod-validated YAML data files as the single source of truth, Vitest unit/render tests, Netlify static deploy from `main`.

**Tech Stack:** Next.js (latest, read bundled docs first), TypeScript strict, Tailwind v4, pnpm@10, next-mdx-remote, gray-matter, yaml, zod, mermaid, Vitest + Testing Library, genanki (Python) for Anki export.

**Spec:** `docs/superpowers/specs/2026-11-11-subagents-course-design.md`

## Global Constraints

- Package manager pnpm@10.17.0 (`"packageManager"` field set in scaffold); Node ≥ 22.
- **Before writing any Next.js code, read the bundled docs at `node_modules/next/dist/docs/`** — this Next generation has breaking changes vs older training data. Heed deprecation notices.
- TypeScript strict mode on.
- Static export must succeed: no server-only features, no ISR, `images.unoptimized = true`, dynamic routes need `generateStaticParams`.
- Dark theme, terminal/monospace accents (match owner's portfolio aesthetic). Tailwind only — no component kits.
- Content lives ONLY in `content/**` (YAML + MDX). Components never hardcode questions or cards.
- Every quiz/exam question MUST have a non-empty `explanation`.
- All commits on `main` (brand-new repo, nothing to protect — explicit design decision; Netlify is connected only after Milestone 1 review).
- Validation failure must fail the build (never ship an unanswerable or unexplained question).

## Review Focus

1. **Hydration mismatch from localStorage progress** — a reader loading a chapter must not get a server/client HTML mismatch; the progress store initializes empty on server and syncs in an effect. Test: `lib/progress` returns defaults when `window` is undefined; component test asserts no throw during render.
2. **Multi-select scoring ambiguity** — partial selections must NOT count as correct; grading is exact-set equality. Test: `gradeQuestion` with a strict subset of correct options returns `correct: false`.
3. **Content validation gaps** — a question missing `explanation`, or a chapter with <3 questions / <6 flashcards, must fail validation. Tests: each rejection case asserted.
4. **Client-only libraries breaking static export** (mermaid accesses `window` at import time) — Mermaid must lazy-import inside `useEffect`/mounted guard. Test: component renders placeholder on first paint; `next build` (export) passes.
5. **Dead curated YouTube links** — every embedded video ID must resolve at authoring time. Step in each content task: `curl -sI "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=<ID>&format=json"` returns HTTP 200.

**Ruling (recorded in ledger):** the spec's "boolean: no options" is simplified in this plan to a uniform representation — `type: boolean` requires `options: ["True", "False"]` and `correct: [0]` or `[1]`, so all questions share one grading path.

---

### Task 1: Repo scaffold and tooling

**Files:** Create `package.json` (via create-next-app), `next.config.ts`, `tsconfig.json`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `postcss.config.mjs`, `vitest.config.ts`, `netlify.toml`, `README.md`, `.gitignore` (from scaffold).

**Interfaces:** Produces: `pnpm dev/build/test` scripts; `vitest` runner wired; static export config other tasks rely on.

- [ ] **Step 1: Scaffold** (non-interactive):

```bash
cd ~/Projects/subagents-course
pnpm create next-app@latest . --ts --tailwind --eslint --app --import-alias "@/*" --use-pnpm --yes
```

- [ ] **Step 2: Add deps:**

```bash
pnpm add next-mdx-remote gray-matter yaml zod mermaid
pnpm add -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 3: Static export** — `next.config.ts`:

```ts
import type { NextConfig } from "next";
const nextConfig: NextConfig = { output: "export", images: { unoptimized: true } };
export default nextConfig;
```

- [ ] **Step 4: Vitest** — `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  test: { environment: "jsdom", setupFiles: ["./vitest.setup.ts"] },
});
```

`vitest.setup.ts`: `import "@testing-library/jest-dom/vitest";`
Add scripts: `"test": "vitest run"`, `"validate": "vitest run tests/content"`.

- [ ] **Step 5: `netlify.toml`:**

```toml
[build]
  command = "pnpm build"
  publish = "out"
```

- [ ] **Step 6: Verify** — `pnpm build` exits 0 and writes `out/`; add placeholder `tests/smoke.test.ts` (`expect(1+1).toBe(2)`) and `pnpm test` passes.

- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat: scaffold Next.js static export + vitest + netlify config"`

### Task 2: Content schema, loader, validator (TDD)

**Files:** Create `lib/content/schema.ts`, `lib/content/load.ts`, `tests/content/schema.test.ts`, `tests/content/load.test.ts`, fixture content `tests/fixtures/chapters/...`.

**Interfaces:** Produces (exact): `Question`, `Flashcard`, `ChapterMeta {slug,title,order,objectives}`, `loadChapterSlugs(): string[]`, `loadChapter(slug): {meta, mdxSource, quiz: Question[], flashcards: Flashcard[]}`, `loadExam(): Question[]`, `validateQuestionSet(qs, {min})`, `validateFlashcards(cs, {min})` — all throwing `ValidationError` with field paths.

- [ ] **Step 1: Failing tests** — schema rejections: question missing `explanation`; `single` with 2 correct indexes; `multi` with 0 correct; `boolean` whose options ≠ `["True","False"]`; `correct` index out of range; duplicate ids; chapter quiz <3; flashcards <6; flashcard missing `back`. Loader tests: `loadChapterSlugs()` returns order-sorted slugs from fixtures; `loadChapter("01-x")` parses frontmatter + YAML.

```ts
// tests/content/schema.test.ts (representative cases — implement ALL listed rejections)
import { describe, it, expect } from "vitest";
import { questionSchema, validateQuestionSet } from "@/lib/content/schema";
const q = (over: object) => ({ id: "q1", type: "single", prompt: "p", options: ["a","b","c"], correct: [0], explanation: "e", ...over });
describe("questionSchema", () => {
  it("rejects missing explanation", () => expect(questionSchema.safeParse(q({ explanation: "" })).success).toBe(false));
  it("rejects single with 2 correct", () => expect(questionSchema.safeParse(q({ correct: [0,1] })).success).toBe(false));
  it("rejects multi with 0 correct", () => expect(questionSchema.safeParse(q({ type: "multi", correct: [] })).success).toBe(false));
  it("rejects boolean with wrong options", () => expect(questionSchema.safeParse(q({ type: "boolean", options: ["Yes","No"], correct: [0] })).success).toBe(false));
  it("rejects out-of-range correct index", () => expect(questionSchema.safeParse(q({ correct: [5] })).success).toBe(false));
});
```

- [ ] **Step 2: Run** `pnpm test` → FAIL (modules missing).
- [ ] **Step 3: Implement** `lib/content/schema.ts`:

```ts
import { z } from "zod";
export const questionSchema = z.object({
  id: z.string().min(1), type: z.enum(["single","multi","boolean"]),
  prompt: z.string().min(1), options: z.array(z.string().min(1)),
  correct: z.array(z.number().int()), explanation: z.string().min(1),
}).superRefine((q, ctx) => {
  if (q.type === "boolean") {
    if (q.options.length !== 2 || q.options[0] !== "True" || q.options[1] !== "False")
      ctx.addIssue({ code: "custom", message: "boolean questions require options ['True','False']" });
    if (q.correct.length !== 1) ctx.addIssue({ code: "custom", message: "boolean requires exactly 1 correct index" });
  } else {
    if (q.type === "single" && q.correct.length !== 1) ctx.addIssue({ code: "custom", message: "single requires exactly 1 correct index" });
    if (q.type === "multi" && q.correct.length < 1) ctx.addIssue({ code: "custom", message: "multi requires ≥1 correct index" });
    if (q.options.length < 2) ctx.addIssue({ code: "custom", message: "needs ≥2 options" });
  }
  for (const i of q.correct) if (i >= q.options.length) ctx.addIssue({ code: "custom", message: `correct index ${i} out of range` });
});
export const flashcardSchema = z.object({ id: z.string().min(1), front: z.string().min(1), back: z.string().min(1), tags: z.array(z.string()).default([]) });
export function validateQuestionSet(qs: unknown, { min }: { min: number }) { /* parse each; check unique ids; count ≥ min; throw ValidationError listing all problems */ }
export function validateFlashcards(cs: unknown, { min }: { min: number }) { /* same pattern */ }
```

`lib/content/load.ts`: fs + gray-matter (MDX frontmatter) + yaml parse; throws if frontmatter missing `title/order/objectives`; `loadChapter` runs both validators (min 3 / min 6).

- [ ] **Step 4: Run** `pnpm test` → PASS. **Step 5: Commit** `feat: content schema, loader, validators`

### Task 3: Quiz + Exam scoring and components (TDD)

**Files:** Create `lib/quiz.ts`, `components/quiz.tsx`, `components/exam.tsx`, `tests/lib/quiz.test.ts`, `tests/components/quiz.test.tsx`.

**Interfaces:** Consumes: `Question` (Task 2). Produces: `gradeQuestion(q, picked: number[]): {correct: boolean}`, `gradeQuiz(qs, answers: Record<string, number[]>): {results, score, total, percent}`, `<Quiz questions chapterId>`, `<Exam questions passMarkPercent>`.

- [ ] **Step 1: Failing tests** (`tests/lib/quiz.test.ts`): single correct/incorrect; **multi exact-set** — picking strict subset → false; picking same set different order → true; empty pick → false; `gradeQuiz` percent rounding; exam `passed = percent ≥ passMarkPercent`.

```ts
it("multi: strict subset is incorrect", () => {
  const q = { id: "m1", type: "multi", prompt: "p", options: ["a","b","c","d"], correct: [0,1,2], explanation: "e" };
  expect(gradeQuestion(q, [0,1]).correct).toBe(false);
});
it("multi: order-independent exact set", () => expect(gradeQuestion(q, [2,0,1]).correct).toBe(true));
```

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `lib/quiz.ts`:

```ts
import type { Question } from "@/lib/content/schema";
export function gradeQuestion(q: Question, picked: number[]): { correct: boolean } {
  const norm = (a: number[]) => [...new Set(a)].sort((x, y) => x - y).join(",");
  return { correct: picked.length > 0 && norm(picked) === norm(q.correct) };
}
export function gradeQuiz(qs: Question[], answers: Record<string, number[]>) {
  const results = qs.map((q) => gradeQuestion(q, answers[q.id] ?? []));
  const score = results.filter((r) => r.correct).length;
  return { results, score, total: qs.length, percent: Math.round((score / qs.length) * 100) };
}
```

- [ ] **Step 4: Component tests** (`tests/components/quiz.test.tsx`): renders options; clicking option + Submit shows explanation and correct/incorrect state; completing quiz shows "3/4 (75%)".
- [ ] **Step 5: Implement** `components/quiz.tsx` (client): per-question selection, instant feedback w/ explanation, summary block, calls `markQuiz` from `lib/progress` on completion (progress wired in Task 6 — for now accept optional `onComplete` prop).
- [ ] **Step 6: `pnpm test` PASS** → **Commit** `feat: quiz/exam grading + components`

### Task 4: Flashcard deck (TDD)

**Files:** Create `lib/deck.ts`, `components/flashcard-deck.tsx`, `tests/lib/deck.test.ts`, `tests/components/flashcard-deck.test.tsx`.

**Interfaces:** Produces: `shuffleSeeded<T>(items: T[], seed: number): T[]`, `<FlashcardDeck cards deckId>`.

- [ ] **Step 1: Failing tests:** same seed ⇒ same order (determinism); different seed ⇒ (usually) different order (assert on fixed seed pair); shuffle is a permutation (no loss/dupes); deck reports remaining/again counts from marks.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** `lib/deck.ts` (mulberry32 + Fisher-Yates as in spec).
- [ ] **Step 4: Component tests:** click card flips (front→back), "Again"/"Got it" buttons update counts and advance.
- [ ] **Step 5: Implement** component (client; uses `markCard` via optional `onMark` prop until Task 6).
- [ ] **Step 6: PASS → Commit** `feat: flashcard deck + seeded shuffle`

### Task 5: Media components

**Files:** Create `components/mermaid.tsx`, `components/youtube-embed.tsx`, `components/video-placeholder.tsx`, `components/animated-diagram.tsx`, `tests/components/media.test.tsx`.

**Interfaces:** Produces: `<Mermaid chart: string>`, `<YouTubeEmbed id title>`, `<VideoPlaceholder topic>`, `<AnimatedDiagram kind: "isolation"|"fanout">`.

- [ ] **Step 1: Tests first:** YouTubeEmbed renders iframe with `src=https://www.youtube-nocookie.com/embed/<id>` + title attr; VideoPlaceholder renders the topic text + "Screencast coming soon"; Mermaid renders "Diagram loading…" placeholder on first paint (client-only render); AnimatedDiagram renders SVG with step button advancing `data-step` attribute 1→2.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** Mermaid: `"use client"`, `useEffect` dynamic `import("mermaid")`, `mermaid.initialize({ startOnLoad: false, theme: "dark" })`, render to SVG on mount. AnimatedDiagram: CSS transitions between steps keyed by state; two kinds exported from one file.
- [ ] **Step 4: `pnpm build`** must still exit 0 (export-safe). **Step 5: Commit** `feat: media components (mermaid, youtube, placeholder, animated)`

### Task 6: Progress store + course index + Chapter 0 & 1 content (M1 vertical slice)

**Files:** Create `lib/progress.ts`, `tests/lib/progress.test.ts`, `app/learn/page.tsx`, `app/learn/[slug]/page.tsx`, `components/chapter-layout.tsx`, `content/chapters/00-orientation/{index.mdx,quiz.yaml,flashcards.yaml}`, `content/chapters/01-what-are-subagents/{index.mdx,quiz.yaml,flashcards.yaml}`, `public/images/learn/{hero,orchestrator}.png`, `public/downloads/agents/{opencode-reviewer.md,claude-code-reviewer.md}`.

**Interfaces:** Consumes: Tasks 2–5 outputs. Produces: `loadProgress(): Progress`, `saveProgress(p)`, `markQuiz(p, chapterId, score, total): Progress`, `markChapterDone(p, id)`, `markCard(p, cardId, mark)`, `resetProgress()`; chapter route renders a full chapter; index lists chapters with completion state.

- [ ] **Step 1: Failing tests** (`tests/lib/progress.test.ts`): `loadProgress()` returns DEFAULTS when `window === undefined` (SSR safety); `saveProgress` writes localStorage under `subagents-course:progress:v1`; `markQuiz` stores score+total; `markChapterDone` idempotent; `recordExam` sets passed only when percent ≥ passMark; `markCard` upserts; `resetProgress` clears key.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** store (all functions pure on a Progress object; only `load/save/reset` touch `localStorage`, guarded).
- [ ] **Step 4: Chapter route** `app/learn/[slug]/page.tsx`: `generateStaticParams` from `loadChapterSlugs()`; renders objectives list, MDX body (`next-mdx-remote`), media blocks referenced by the chapter MDX, `<Quiz>` + `<FlashcardDeck>` wired to real progress store, prev/next links.
- [ ] **Step 5: Index page** `/learn`: chapter cards (title, objectives count, quiz state, deck size, done marker) built from `loadChapterSlugs()` + `loadChapter(slug)` metadata (no separate meta loader — derive at build time).
- [ ] **Step 6: Chapter 0 + 1 content:** Ch0 ≥3 quiz + ≥6 flashcards (course navigation, how progress works). Ch1 ≥4 quiz + ≥8 flashcards covering: subagent = child session with fresh context; parent composes the dispatch; context isolation benefit; foreground vs background; built-in agents exist. MDX embeds: `orchestrator.png`, `<Mermaid>` context-isolation chart, `<AnimatedDiagram kind="isolation">`, one verified YouTube embed.
- [ ] **Step 7: Agent template files** — `opencode-reviewer.md` (`.opencode/agents/reviewer.md` ready-to-copy: `mode: subagent`, deny edit/shell permissions, review system prompt) and `claude-code-reviewer.md` (frontmatter `name/description/tools: Read, Glob, Grep/model: sonnet` + review prompt) — these are real, correct files per the official docs researched in-session.
- [ ] **Step 8: `pnpm test` + `pnpm build` PASS. Commit** `feat: progress store, course index, chapters 0-1, agent templates`
- [ ] **Step 9: Generate AI photos** (controller, before Step 8 commit): `hero.png` + `orchestrator.png` into `public/images/learn/`.

### Task 7: Milestone 1 gate — deploy config + verification

**Files:** Modify `README.md` (dev + deploy instructions), `netlify.toml` (final).

- [ ] **Step 1:** `pnpm test` (all green), `pnpm build` (exit 0, `out/` populated), `pnpm lint` (0 errors).
- [ ] **Step 2:** Commit + push `main`. **Step 3: MILESTONE 1 REVIEW** (reviewer subagent, spec-compliance + quality). Findings → fix loop → re-review. **Gate: user connects Netlify site to the repo after review passes.**

### Task 8: Final exam page + exam data

**Files:** Create `content/exam.yaml` (≥20 questions spanning all chapters, each with explanation), `app/exam/page.tsx`, `tests/components/exam.test.tsx` (extended: no per-question feedback until submit; pass/fail UI at ≥80%; retake clears answers + progress.exam).

- [ ] Steps: failing component tests → implement page using `<Exam>` + `gradeQuiz` → write exam.yaml (validate via Task 2 schemas, min 20) → `pnpm test && pnpm build` → commit `feat: final exam`.

### Task 9: Chapters 2–4 content

**Files:** `content/chapters/{02-when-to-use,03-opencode-subagents,04-claude-code-subagents}/{index.mdx,quiz.yaml,flashcards.yaml}` + images.

- [ ] Ch2 (≥3q/6c): decision guide + "when NOT to" table → embeds `review-loop.png` optional, decision Mermaid.
- [ ] Ch3 (≥4q/8c): OpenCode built-ins (`general`, `explore`), dispatch phrasing, custom agents frontmatter (`description/mode/model/permissions`), subagent permission rules, nested agent IDs. Verify OpenCode doc claims against https://opencode.ai/docs/agents/.
- [ ] Ch4 (≥4q/8c): Claude Code `.claude/agents/*.md` frontmatter (`name, description, tools, model, disallowedTools…`), scope priority, built-ins. Verify against https://code.claude.com/docs/en/sub-agents.
- [ ] Each chapter: ≥1 Mermaid diagram, ≥1 verified YouTube embed, quiz + deck wired. `pnpm test && pnpm build` → commit per chapter (`feat: chapter 2 …` etc.).

### Task 10: Chapters 5–8 content

**Files:** `content/chapters/{05-crafting-dispatches,06-parallel-dispatch,07-subagent-driven-development,08-recipes}/{index.mdx,quiz.yaml,flashcards.yaml}` + images.

- [ ] Ch5 (≥4q/8c): dispatch anatomy (scope/context/constraints/output contract), mistakes table, good-vs-bad example pairs. Embed `context-isolation.png`.
- [ ] Ch6 (≥4q/8c): independence test, parallel vs sequential, review-and-integrate, conflict check. Embed `<AnimatedDiagram kind="fanout">`.
- [ ] Ch7 (≥4q/8c): implement→review→fix loop, ledger, breaker at round 5, model-tier guidance. Embed `review-loop.png` + Mermaid loop chart.
- [ ] Ch8 (≥4q/8c): 4 recipes with full copy-paste prompts (fix failing tests; code review; codebase research; refactor). Embed `recipes.png`.
- [ ] `pnpm test && pnpm build` → commit per chapter.

### Task 11: Anki export + downloads page

**Files:** Create `scripts/export-anki.py` (genanki; if Python/genanki unavailable, npm fallback `genanki` port — verify at implementation, prefer Python), `app/downloads/page.tsx`, `tests/anki/export.test.ts` (validate generated deck data structure pre-packaging: card count == total flashcards + exam deck, no empty fields), `public/downloads/subagents-course.apkg` (generated + committed), `public/downloads/agents/*` (copy of templates).

- [ ] Steps: verify toolchain (`python3 -c "import genanki"`, else `pip install genanki` or npm fallback) → script maps flashcards.yaml → models/notes (deck `Subagents Mastery::<chapter>`) → run script → assert `.apkg` exists + non-trivial size → downloads page lists `.apkg` + agent templates with copy buttons → `pnpm build` → commit `feat: anki export + downloads`.

### Task 12: Full-course progress + polish

**Files:** Modify `app/page.tsx` (landing: hero image, stats, CTA), `app/learn/page.tsx` (overall progress bar, exam lock hint), `components/chapter-layout.tsx` (auto-mark done when quiz ≥ threshold), `app/layout.tsx` (nav: Learn, Exam, Downloads).

- [ ] Tests: progress bar math (0%, partial, 100%); chapter auto-done threshold (percent ≥ 60). Implement, `pnpm test && pnpm build`, commit `feat: full progress + polish`.

### Task 13: Portfolio link

**Files:** Modify `~/Projects/portfolio` (separate repo — separate commit/PR there): add course entry/link (projects page card or nav item) pointing at the Netlify course URL.

- [ ] Steps: read portfolio's existing card component pattern → add entry (title "Subagents Mastery course", blurb, URL) → `pnpm build` in portfolio passes → commit there `feat: link subagents course` (user pushes/PR per their workflow).

### Task 14: Gitea mirror + final verification

**Files:** No code. Git remotes + verification only.

- [ ] Step 1: Discover Gitea endpoint: `for u in http://jpeezy-nas:3000 http://100.100.100.100:3000; do curl -s -o /dev/null -w "%{http_code}" "$u/api/v1/version" && echo " $u"; done` — confirm with user before creating repo (needs their Gitea token/credentials).
- [ ] Step 2: `git remote add gitea <URL>/<owner>/subagents-course.git` → push `main` (+ `--tags`).
- [ ] Step 3: Full verification: `pnpm test` (count failures = 0), `pnpm build` (exit 0), check `out/index.html` exists, every YouTube ID in content resolves (Review Focus #5 loop over content files), `public/downloads/subagents-course.apkg` served in `out/downloads/`.
- [ ] Step 4: Final whole-repo review subagent (most capable available), findings → one fix dispatch → scoped re-review → adjudicate residuals.
