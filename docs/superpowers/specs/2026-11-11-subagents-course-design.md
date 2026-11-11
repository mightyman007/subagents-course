# Subagents Mastery Course — Design Spec

**Date:** 2026-11-11 · **Status:** Approved (design approved by user in session)
**Repo:** `github.com/mightyman007/subagents-course` (main branch) · **Host:** Netlify (own site) + GitHub + Gitea mirror on `jpeezy-nas`

## Goal

An interactive self-study course teaching the owner how to use AI subagents for programming (OpenCode V2 + Claude Code). Success = the owner can read the course on their own hosted site, test themselves (quizzes, final exam), review flashcards (site + real Anki), and apply ready-to-use agent templates in daily programming.

## Non-goals

No backend, no accounts/auth, no comments, no CMS. All state is client-side (localStorage). Static export only.

## Architecture

- **Next.js (App Router, TypeScript strict) with `output: 'export'`** — fully static, deployed to Netlify from `main` via `netlify.toml`.
- **Tailwind CSS v4**, dark theme consistent with the owner's portfolio aesthetic (terminal/monospace accents).
- **MDX chapters** rendered with `next-mdx-remote` + `gray-matter` (same pattern as the owner's portfolio), content in `content/chapters/`, static paths via `generateStaticParams`.
- **Client components** for all interactivity; **Vitest** (+ Testing Library) for logic and render tests; build-time content validation via zod.
- **pnpm@10** package manager. Node ≥ 22 (26 present).
- ⚠️ **Next version rule:** after scaffolding, read the bundled `node_modules/next/dist/docs/` guides before writing Next code — this Next generation has breaking changes vs older training data.

## Information architecture

| Route | Purpose |
|---|---|
| `/` | Course landing: what you'll learn, chapter grid with progress state, link to exam + downloads |
| `/learn/[slug]` | Chapter page: objectives, MDX lesson, media, quiz, flashcard deck, prev/next |
| `/exam` | Final exam (all chapters), pass threshold, result + retake |
| `/downloads` | Anki `.apkg` download + agent template files for OpenCode/Claude Code |

## Chapters (9 + exam)

0 `orientation` — how to use this course
1 `what-are-subagents` — child sessions, fresh context, why main context is protected
2 `when-to-use` — decision guide; when NOT to use (related failures, shared state, exploratory debugging)
3 `opencode-subagents` — built-in `general`/`explore`, dispatching, custom `.opencode/agents/*.md`, `mode`, `permissions`, model selection
4 `claude-code-subagents` — `.claude/agents/*.md` frontmatter reference, built-ins, `/agents`
5 `crafting-dispatches` — focused scope, self-contained context, constraints, output contract; common-mistakes table
6 `parallel-dispatch` — one agent per independent domain, fan-out in one turn, integrating results
7 `subagent-driven-development` — implement → task review → fix loop → final review; ledger
8 `recipes` — copy-paste playbooks (fix failing tests, code review, codebase research, refactoring)

## Content data model (single source of truth)

Per chapter dir `content/chapters/<NN-slug>/`:
- `index.mdx` — frontmatter: `title`, `order`, `objectives: string[]`, optional `video: {youtubeId, title}`, optional `placeholderVideo: {topic}`; body = lesson MDX.
- `quiz.yaml` — array of `{id, type: single|multi|boolean, prompt, options[], correct: number[]|boolean, explanation}`; `single`/`multi`: `correct` = indexes into `options`; `boolean`: no `options`.
- `flashcards.yaml` — array of `{id, front, back, tags[]}`.
- `content/exam.yaml` — ≥20 questions, same schema, `passMarkPercent: 80`.

**Build-time validation (zod):** every chapter has ≥3 quiz questions and ≥6 flashcards; every question has ≥2 options (except boolean), a valid `correct` index set, and a non-empty `explanation`; unique ids; MDX frontmatter complete. Validation runs in CI-less `pnpm validate` and inside `next build` (prebuild step). **Failing validation fails the build.**

## Interactive components (client)

- `<Quiz questions chapterId>` — per-question instant feedback + explanation; score summary; writes progress.
- `<Exam questions>` — no per-question feedback; results + pass/fail at end; retake resets.
- `<FlashcardDeck cards deckId>` — flip, shuffle (seeded), again/got-it marks persisted.
- `<Mermaid chart>` — client-side mermaid render.
- `<AnimatedDiagram kind="isolation"|"fanout">` — bespoke SVG/CSS step-throughs (context isolation; orchestrator fanning out to 3 subagents).
- `<YouTubeEmbed id title>`, `<VideoPlaceholder topic>` — screencast stub showing "coming soon".
- Progress UI: chapter completion state on index (driven by the same store).

## Progress store (`lib/progress.ts`)

localStorage key `subagents-course:progress:v1`:
`{chaptersDone: string[], quizzes: Record<chapterId,{score,total}>, exam: {score,total,passed}|null, cards: Record<cardId,"again"|"gotit">}` — SSR-safe (lazy init, no hydration mismatch), resettable.

## Anki export

`scripts/export-anki.py` (Python `genanki`; npm fallback verified at implementation) reads all `flashcards.yaml` + exam deck → writes `public/downloads/subagents-course.apkg`, deck name `Subagents Mastery::General` (per chapter subdecks). Wired as `pnpm export-anki`; output committed so the static site serves it without Python in Netlify's build.

## Media

- **AI-generated photos** (controller generates during content tasks) → `public/images/learn/`: `hero.png`, `orchestrator.png`, `context-isolation.png`, `review-loop.png`, `recipes.png`.
- **Diagrams:** Mermaid — context isolation, fan-out, review loop, agent-file anatomy.
- **Videos:** 2–3 curated YouTube embeds per chapter (URLs verified live when authored); `<VideoPlaceholder>` stubs for future owner screencasts; ≥2 animated SVG/CSS step-throughs.

## Publishing & mirrors

1. GitHub `main` = source of truth; Netlify auto-deploys (`netlify.toml`: build `pnpm build`, publish `out`).
2. Netlify site is connected by the owner in the Netlify UI **after Milestone 1 review passes** (deploy previews of a broken site never go public).
3. Gitea mirror on `jpeezy-nas`: add remote `gitea` (URL confirmed at implementation, likely `http://jpeezy-nas:3000`), push `main`.
4. Owner's portfolio (`mightyman007/portfolio`) gets a link/card to the course (Milestone 3).

## Milestones & verification

- **M1 (walking skeleton):** scaffold → data model → Quiz/Exam → Flashcards → media components → Ch0–Ch1 fully wired (content, photo, diagram, video, quiz, deck, progress) → `pnpm test` + `pnpm build` green → review gate.
- **M2:** exam page + chapters 2–8 + Anki export + downloads page + full progress/nav → review gate.
- **M3:** portfolio link + Gitea mirror + final polish → whole-repo final review (most capable available model).
- Per-task reviews check spec compliance + quality; findings enter a fix loop (resume implementer rounds 1–3, fresh implementer rounds 4–5) before any milestone is declared done. Evidence before "done" claims: fresh test/build output, no extrapolation.

## Testing strategy

- Unit (Vitest): quiz/exam scoring (single, multi, boolean; edge cases), deck shuffle determinism + mark persistence, progress store CRUD + SSR safety, content validator rejections (missing explanation, invalid correct index, short deck).
- Component render tests for Quiz/FlashcardDeck/media components.
- `pnpm build` must pass (includes content validation) — this is the deploy gate.
