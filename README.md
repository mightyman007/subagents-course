# Subagents Mastery

An interactive self-study course on AI coding subagents — dispatching, orchestrating, and scaling programming work with **OpenCode V2** and **Claude Code**.

Fully static site (Next.js App Router, `output: "export"`) deployed to Netlify from `main`.

## Stack

- **Next.js 16** (App Router, TypeScript strict, static export)
- **Tailwind CSS v4** — dark theme with terminal/monospace accents, no component kits
- **MDX content** via `next-mdx-remote` + `gray-matter` (chapters in `content/chapters/`)
- **Vitest** + Testing Library for logic/render tests, zod for build-time content validation
- **pnpm@10.17.0**, Node ≥ 22

## Getting started

```bash
pnpm install
pnpm dev        # dev server
pnpm build      # static export → out/
pnpm test       # vitest run (all tests)
pnpm validate   # content validation tests (tests/content)
pnpm lint       # eslint
```

## Deployment

Netlify reads `netlify.toml`: `pnpm build` → publish `out/`. No server functions — the build produces pure static assets.

## Repo layout

- `app/` — routes (landing, `/learn/[slug]`, `/exam`, `/downloads`)
- `content/` — MDX chapters + frontmatter
- `tests/` — Vitest suites (`tests/content` validates chapter frontmatter/body)
- `docs/` — design spec and implementation plan
