"use client";

import { useState } from "react";

type DiagramKind = "isolation" | "fanout";

interface AnimatedDiagramProps {
  /** Which concept the diagram steps through. */
  kind: DiagramKind;
}

/**
 * The captions ARE the content — each step teaches one beat of the concept,
 * so keep them readable as a standalone sequence.
 */
const CAPTIONS: Record<DiagramKind, readonly string[]> = {
  isolation: [
    "1. Parent holds full context",
    "2. Task is dispatched",
    "3. Child works in fresh context",
    "4. Only the result returns",
  ],
  fanout: [
    "1. The orchestrator keeps the goal and the plan",
    "2. It dispatches three subagents in parallel — each starts with its own fresh context",
    "3. Each subagent returns only its result; the orchestrator merges them",
  ],
};

const VIEW_BOX = "0 0 480 220";

/** Single opacity utility per element state (avoids conflicting classes). */
function vis(on: boolean): string {
  return on ? "opacity-100" : "opacity-0";
}

/**
 * Isolation: a parent context box splitting off a sealed child context.
 * Step 1 shows the parent full of context; step 2 slides the task to the
 * boundary; step 3 seals the child in with its fresh context; step 4 flies
 * only the result back.
 */
function IsolationScene({ step }: { step: number }) {
  const childIn = step >= 3;
  const result = step >= 4;
  const taskOpacity = step < 2 ? "opacity-0" : result ? "opacity-40" : "opacity-100";
  const taskPos =
    step < 2 ? "translate-x-[-48px]" : childIn ? "translate-x-[72px]" : "translate-x-0";
  return (
    <g>
      {/* Parent: full of context until the child is sealed in, then dimmed —
          what remains after the result returns is visibly less than it had. */}
      <text
        x={24}
        y={40}
        fontSize={11}
        className={`font-mono transition-opacity duration-700 ${childIn ? "fill-muted/60" : "fill-muted"}`}
      >
        parent
      </text>
      <rect
        x={24}
        y={48}
        width={190}
        height={150}
        rx={10}
        fill="none"
        strokeWidth={1.5}
        className={`stroke-line transition-opacity duration-700 ${childIn ? "opacity-50" : "opacity-100"}`}
      />
      {[
        { y: 84, label: "files" },
        { y: 116, label: "history" },
        { y: 148, label: "notes" },
      ].map((c) => (
        <g
          key={c.label}
          className={`transition-opacity duration-700 ${childIn ? "opacity-40" : "opacity-100"}`}
        >
          <rect x={44} y={c.y} width={120} height={20} rx={4} className="fill-line" />
          <text x={54} y={c.y + 14} fontSize={10} className="fill-foreground font-mono">
            {c.label}
          </text>
        </g>
      ))}

      {/* Dispatch direction (step 2 only). */}
      <g className={`transition-opacity duration-500 ${vis(step === 2)}`}>
        <line x1={170} y1={165} x2={245} y2={165} className="stroke-accent" strokeWidth={1.5} />
        <polygon points="245,160 255,165 245,170" className="fill-accent" />
      </g>

      {/* Task packet: slides to the boundary at step 2, crosses into the
          child at step 3, and stays there (dimmed) once only the result
          returns at step 4. */}
      <g className={`transition-all duration-700 ${taskOpacity} ${taskPos}`}>
        <rect
          x={196}
          y={118}
          width={52}
          height={22}
          rx={4}
          fill="none"
          strokeWidth={1}
          className="stroke-foreground"
        />
        <text x={206} y={133} fontSize={10} className="fill-foreground font-mono">
          task
        </text>
      </g>

      {/* Sealed boundary between the two contexts. */}
      <line
        x1={258}
        y1={42}
        x2={258}
        y2={204}
        strokeWidth={2}
        strokeDasharray="5 6"
        className={`stroke-accent transition-opacity duration-500 ${childIn ? "opacity-90" : "opacity-0"}`}
      />

      {/* Child context: appears sealed at step 3, dimmed to its leftover
          task once the result has returned. */}
      <g className={`transition-opacity duration-700 ${vis(childIn)} ${result ? "opacity-60" : ""}`}>
        <text x={268} y={40} fontSize={11} className="fill-muted font-mono">
          child
        </text>
        <rect
          x={268}
          y={48}
          width={190}
          height={150}
          rx={10}
          fill="none"
          strokeWidth={1.5}
          strokeDasharray="6 5"
          className="stroke-accent"
        />
        <text x={282} y={72} fontSize={9} className="fill-muted font-mono">
          started empty — only the task came in
        </text>
      </g>

      {/* Return direction (step 4 only). */}
      <g className={`transition-opacity duration-500 ${vis(result)}`}>
        <line x1={256} y1={100} x2={222} y2={100} className="stroke-accent" strokeWidth={1.5} />
        <polygon points="222,95 212,100 222,105" className="fill-accent" />
      </g>

      {/* Result packet: flies from the child back into the parent at step 4. */}
      <g
        className={`transition-all duration-700 ${vis(result)} ${result ? "translate-x-[-140px]" : "translate-x-0"}`}
      >
        <rect
          x={280}
          y={118}
          width={64}
          height={22}
          rx={4}
          fill="none"
          strokeWidth={1.25}
          className="stroke-accent"
        />
        <text x={290} y={133} fontSize={10} className="fill-accent font-mono">
          result
        </text>
      </g>
    </g>
  );
}

/**
 * Fanout: one orchestrator dispatching three subagents in parallel. The
 * dispatch lines draw themselves (stroke-dashoffset via pathLength) with a
 * stagger; at the last step the return lines draw back into the orchestrator.
 */
function FanoutScene({ step }: { step: number }) {
  const dispatching = step >= 2;
  const returning = step >= 3;
  return (
    <g>
      {/* Dispatch lines draw out to each subagent, staggered per lane. */}
      {[42, 112, 182].map((cy, i) => (
        <line
          key={`dispatch-${cy}`}
          x1={160}
          y1={112}
          x2={322}
          y2={cy}
          pathLength={1}
          strokeWidth={1.5}
          strokeDasharray="1"
          strokeLinecap="round"
          className="stroke-accent"
          style={{
            strokeDashoffset: dispatching ? 0 : 1,
            transition: `stroke-dashoffset 600ms ease ${i * 150}ms`,
          }}
        />
      ))}

      {/* Return lines draw back into the orchestrator on the last step. */}
      {[42, 112, 182].map((cy, i) => (
        <line
          key={`return-${cy}`}
          x1={322}
          y1={cy + 10}
          x2={160}
          y2={122}
          pathLength={1}
          strokeWidth={1}
          strokeDasharray="1"
          strokeLinecap="round"
          className={`stroke-muted transition-opacity duration-500 ${vis(returning)}`}
          style={{
            strokeDashoffset: returning ? 0 : 1,
            transition: `stroke-dashoffset 500ms ease ${i * 120}ms, opacity 300ms ease`,
          }}
        />
      ))}

      {/* Orchestrator: the only node that sees the whole picture. */}
      <g className={step === 1 ? "animate-pulse" : undefined}>
        <rect
          x={28}
          y={88}
          width={132}
          height={48}
          rx={10}
          strokeWidth={1.5}
          className="fill-accent/10 stroke-accent"
        />
        <text x={94} y={110} textAnchor="middle" fontSize={11} className="fill-foreground font-mono">
          orchestrator
        </text>
        <text x={94} y={126} textAnchor="middle" fontSize={9} className="fill-muted font-mono">
          goal + plan
        </text>
      </g>

      {/* Results collector, revealed on the last step. */}
      <g className={`transition-opacity duration-500 ${vis(returning)}`}>
        <rect
          x={40}
          y={56}
          width={88}
          height={22}
          rx={11}
          fill="none"
          strokeWidth={1.25}
          className="stroke-accent"
        />
        <text x={84} y={71} textAnchor="middle" fontSize={10} className="fill-accent font-mono">
          results
        </text>
      </g>

      {/* Subagent slots: faint placeholders at step 1, lit and pulsing while
          they work, solid once their results return. */}
      {[20, 90, 160].map((y, i) => (
        <g
          key={y}
          data-subagent={i + 1}
          className={`transition-all duration-700 ${dispatching ? "opacity-100" : "opacity-30"} ${step === 2 ? "animate-pulse" : ""}`}
          style={{ transitionDelay: `${i * 150}ms` }}
        >
          <rect
            x={322}
            y={y}
            width={130}
            height={44}
            rx={8}
            strokeWidth={1}
            strokeDasharray="5 4"
            className="fill-line stroke-line"
          />
          <text
            x={387}
            y={y + 26}
            textAnchor="middle"
            fontSize={11}
            className="fill-foreground font-mono"
          >
            subagent {i + 1}
          </text>
        </g>
      ))}
    </g>
  );
}

/**
 * Step-through concept diagram: pure SVG + Tailwind transitions, no animation
 * library. The current step is exposed as `data-step` on the root (1→N) so
 * tests and styling can key off it; Prev/Next step through the captions.
 */
export function AnimatedDiagram({ kind }: AnimatedDiagramProps) {
  const captions = CAPTIONS[kind];
  const total = captions.length;
  const [step, setStep] = useState(1);
  // Clamp so a kind switch can never index past its own caption list.
  const current = Math.min(step, total);
  const caption = captions[current - 1];

  return (
    <figure data-step={current} data-kind={kind} className="my-6 rounded-lg border border-line p-4">
      <svg
        viewBox={VIEW_BOX}
        role="img"
        aria-label={`${kind} diagram, step ${current} of ${total}`}
        className="h-auto w-full"
      >
        {kind === "isolation" ? <IsolationScene step={current} /> : <FanoutScene step={current} />}
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="text-sm text-foreground">
          {caption}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <span className="font-mono text-xs text-muted">
            {current}/{total}
          </span>
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, Math.min(s, total) - 1))}
            disabled={current === 1}
            className="rounded border border-line px-3 py-1.5 font-mono text-xs text-muted transition-colors hover:border-accent/60 hover:text-accent disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-line disabled:hover:text-muted"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(total, s + 1))}
            disabled={current === total}
            className="rounded border border-accent px-3 py-1.5 font-mono text-xs text-accent transition-colors hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </figcaption>
    </figure>
  );
}