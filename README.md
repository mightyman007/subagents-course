# Subagents Mastery

An interactive self-study course on AI coding subagents — dispatching, orchestrating, and scaling programming work with **OpenCode V2** and **Claude Code**.

Fully static site (Next.js App Router, `output: "export"`). Every quiz score and flashcard mark lives in your browser's localStorage — there is no account and no server.

## Chapters

| # | Title | About |
|---|-------|-------|
| 0 | How to use this course | Chapter anatomy, quizzes and decks, where progress lives |
| 1 | What are subagents | Child sessions with fresh context, why the main context stays protected |
| 2 | When to dispatch — and when not to | The three gates, the when-NOT table, brief-first thinking |
| 3 | OpenCode: built-ins and custom agents | The built-in agents, agent Markdown files, permissions |
| 4 | Claude Code: subagent files and built-ins | Agent files and scopes, model resolution, background by default |
| 5 | Crafting dispatches: the four-part brief | Scope, context, constraints, output contract |
| 6 | Parallel dispatch: the fan-out pattern | Independent domains, one agent per domain, writing isolated briefs |
| 7 | Subagent-driven development | The orchestrator loop: implement, review, bounded fix rounds, ledger |
| 8 | Recipes: dispatches you can paste | Four complete copy-paste dispatches and what to verify on return |

Chapters live in `content/chapters/` and render at `/learn/<slug>`, listed in order at `/learn` (with overall progress, per-chapter scores, and done markers from localStorage).

## Stack

- **Next.js 16** (App Router, TypeScript strict, static export)
- **Tailwind CSS v4** — dark theme with terminal/monospace accents, no component kits
- **MDX content** via `next-mdx-remote` + `gray-matter` (chapters in `content/chapters/`)
- **Vitest** + Testing Library for logic/render tests, **zod** for build-time content validation
- **pnpm@10.17.0** (enforced via `packageManager`), Node ≥ 20.9 (Next.js 16 requirement)

## Getting started

```bash
pnpm install
pnpm dev        # dev server
```

### Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server at `http://localhost:3000` |
| `pnpm test` | Full Vitest suite (lib, components, content, smoke) |
| `pnpm validate` | Content validation only (`vitest run tests/content`) |
| `pnpm lint` | ESLint |
| `pnpm build` | Static export → `out/` (loads + validates all content; invalid content fails the build) |

## Authoring content

One directory per chapter, named `<NN-slug>` (zero-padded order determines sequence):

```
content/chapters/<NN-slug>/
├── index.mdx        # lesson body + frontmatter
├── quiz.yaml        # chapter quiz
└── flashcards.yaml  # flashcard deck
```

Frontmatter (`index.mdx`): `title` (non-empty string), `order` (integer, defines chapter sequence), `objectives` (non-empty array of non-empty strings). The slug is the directory name.

### `quiz.yaml`

A YAML array of questions:

| Field | Rules |
|---|---|
| `id` | Non-empty string, unique within the file |
| `type` | `single`, `multi`, or `boolean` |
| `prompt` | Non-empty string |
| `options` | Array of non-empty strings; ≥ 2 required (`boolean` must be exactly `["True", "False"]`) |
| `correct` | Indexes into `options`: `single` exactly 1, `multi` ≥ 1, `boolean` exactly 1; every index in range |
| `explanation` | Non-empty string, shown after answering |

Shorthand (normalized by the loader): `boolean` questions may omit `options` and write `correct: true/false`; `single`/`multi` may write `correct: 1` instead of `correct: [1]`.

Minimal valid example:

```yaml
- id: c0-q1
  type: boolean
  prompt: "Chapter progress is stored on a server."
  correct: false
  explanation: "No server — progress lives in your browser's localStorage."
- id: c0-q2
  type: single
  prompt: "What marks a chapter as done?"
  options: ["Reading the lesson", "Scoring 60%+ on the quiz"]
  correct: 1
  explanation: "The quiz bar is 60%."
- id: c0-q3
  type: multi
  prompt: "Which actions record progress?"
  options: ["Submitting a quiz", "Marking a flashcard", "Opening the site"]
  correct: [0, 1]
  explanation: "Quiz submissions and card marks both write to the progress store."
```

### `flashcards.yaml`

A YAML array of cards:

| Field | Rules |
|---|---|
| `id` | Non-empty string, unique within the file |
| `front` / `back` | Non-empty strings |
| `tags` | Optional array of strings (defaults to `[]`) |

Minimal valid example:

```yaml
- id: c0-f1
  front: "Where is course progress stored?"
  back: "Browser localStorage — client-side only."
  tags: [course]
- id: c0-f2
  front: "What quiz score marks a chapter done?"
  back: "60% or higher."
  tags: [course]
- id: c0-f3
  front: "What are the two card marks?"
  back: "'Got it' (recalled) and 'Again' (didn't recall)."
  tags: [course]
- id: c0-f4
  front: "What does retaking a quiz do?"
  back: "Replaces the previous score for that chapter."
  tags: [course]
- id: c0-f5
  front: "What downloads ship with the course?"
  back: "Code-reviewer agent templates for OpenCode V2 and Claude Code."
  tags: [course, agents]
- id: c0-f6
  front: "How do you reset all progress?"
  back: "Clear the site's data in your browser."
  tags: [course]
```

### Validation rules

Every chapter must have **≥ 3 quiz questions** and **≥ 6 flashcards**. Beyond that: unique ids per file, ≥ 2 options per question (except `boolean`), in-range `correct` indexes, and non-empty prompts/explanations/fronts/backs. Failures throw with per-field paths.

Run it with `pnpm validate`, or just build — `pnpm build` loads and validates every chapter, and invalid content fails the build.

### CRITICAL: MDX rendering path

Chapter MDX **must render through `components/chapter-layout.tsx`**, which compiles it with `MDXRemote` using `options={{ blockJS: false }}`. Chapter content is first-party (compiled at build time, never user input), and media like Mermaid charts are authored as `` {`...`} `` template-literal attributes — the default `blockJS` mode would strip them. The dangerous-calls guard still applies. **Never add a second MDX render path** for chapters.

Components available inside chapter MDX: `<Mermaid>`, `<AnimatedDiagram>`, `<YouTubeEmbed>`, `<VideoPlaceholder>`.

## Deployment

- **Netlify** reads `netlify.toml`: build `pnpm build`, publish `out`. Pure static assets — no server functions.
- **Live at <https://subagents-course.netlify.app>** — site `subagents-course` (project id `e8a6a591-7a1b-4e64-b6ba-11c8c802faf3`), deployed via Netlify CLI from `out/`.
- Redeploying after content changes: run `pnpm build`, then `pnpm --package=netlify-cli dlx netlify deploy --prod --dir out --site e8a6a591-7a1b-4e64-b6ba-11c8c802faf3`. (To switch to auto-deploy-on-push instead, link the GitHub repo in the Netlify UI: Site configuration → Build & deploy.)
- **GitHub is the source of truth**: `main` at `github.com/mightyman007/subagents-course`.
- A **Gitea mirror** on `jpeezy-nas` is planned (remote `gitea`, likely `http://jpeezy-nas:3000`); not configured yet.

## Repo layout

- `app/` — routes: `/` (landing), `/learn` (course index with progress state), `/learn/[slug]` (chapter page), `/exam` (final exam), `/downloads` (Anki deck + agent templates)
- `components/` — `chapter-layout` (MDX render path + page shell), quiz, flashcard deck, progress bridges, media (mermaid, animated diagram, YouTube, placeholder), exam
- `content/` — chapters per the layout above, plus `exam.yaml`
- `lib/` — content schema + loader (build-time only), exam pass-mark sourcing, quiz/deck logic, progress store (localStorage)
- `public/images/learn/` — chapter illustrations; `public/downloads/` — the pre-generated Anki `.apkg` plus ready-to-copy reviewer agent templates (OpenCode V2 + Claude Code)
- `tests/` — Vitest suites (`lib/`, `components/`, `content/`, `anki/`, smoke)
- `docs/` — design spec and implementation plan
- `scripts/` — `export-anki.py` (regenerates the `.apkg`; run via `pnpm export-anki`)

## Roadmap

Everything planned for the course is built:

- **All nine chapters** (00–08) — each with a lesson, a quiz, and a flashcard deck
- **Final exam** — spans the whole course, pass mark 80% (from `exam.yaml`), free retakes
- **Downloads page** — the full flashcard collection as an Anki `.apkg` deck, plus the two agent templates with install paths
- **Progress tracking** — per-chapter quiz scores, done markers, flashcard marks, exam result, and an overall progress bar, all in localStorage

Possible next steps:

- Gitea mirror on `jpeezy-nas` (remote `gitea`, likely `http://jpeezy-nas:3000`) — not configured yet
