"use client";

import { useEffect, useId, useRef, useState } from "react";

interface MermaidProps {
  /** Mermaid diagram source, e.g. "graph TD; A-->B". */
  chart: string;
}

/**
 * mermaid is a large browser-only bundle: importing it at module top level
 * would pull it into every page's prerender pass (and there is no DOM to
 * measure against there). Instead it is imported dynamically inside the mount
 * effect, initialized exactly once per page load, and asked to render the
 * chart to an SVG string that is injected into the container. Any failure —
 * bad syntax, a diagram type the environment can't measure — degrades to the
 * raw chart in a <pre>: a broken diagram must never take the page down.
 */
let initialized = false;

/**
 * Static server-rendered diagram block. Renders a "Diagram loading…"
 * placeholder on first paint (which is also the prerendered markup), then the
 * SVG once mermaid resolves client-side.
 */
export function Mermaid({ chart }: MermaidProps) {
  // State records what has been rendered/failed, not a phase enum: the
  // loading phase is derived from "current chart isn't rendered yet", so a
  // chart prop change flips back to the placeholder without a setState call
  // inside the effect.
  const [rendered, setRendered] = useState<{ chart: string; svg: string } | null>(null);
  const [failedChart, setFailedChart] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const reactId = useId();
  const renders = useRef(0);
  // useId emits characters ("«r0»"-shaped in React 19) that are legal in HTML
  // ids but hostile to the url(#id) references mermaid bakes into its SVG —
  // strip down to a safe charset. The per-render counter keeps ids unique
  // across re-renders and remounts.
  const baseId = `mermaid-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        if (!initialized) {
          mermaid.initialize({ startOnLoad: false, theme: "dark" });
          initialized = true;
        }
        renders.current += 1;
        const { svg } = await mermaid.render(`${baseId}-${renders.current}`, chart);
        if (cancelled) return;
        if (containerRef.current) containerRef.current.innerHTML = svg;
        setRendered({ chart, svg });
      } catch {
        if (!cancelled) setFailedChart(chart);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [baseId, chart]);

  const done = rendered?.chart === chart;
  const phase = done ? "done" : failedChart === chart ? "error" : "loading";

  return (
    <div className="my-6 rounded-lg border border-line p-4">
      {phase === "loading" && (
        <p className="font-mono text-xs text-muted">Diagram loading…</p>
      )}
      {phase === "error" && (
        <div>
          <p className="font-mono text-xs text-red-400">[diagram error] raw source:</p>
          <pre className="mt-2 overflow-x-auto font-mono text-xs text-muted">{chart}</pre>
        </div>
      )}
      {/* The rendered SVG is mermaid's own sanitized output for a chart we
          ship in course content; React doesn't manage this container's
          children, so the injected markup survives re-renders. A chart that
          failed before re-enters through the error phase until a retry
          succeeds, which is why the container stays mounted but hidden. */}
      <div
        ref={containerRef}
        data-mermaid-container=""
        className={phase === "done" ? "overflow-x-auto [&_svg]:mx-auto" : "hidden"}
      />
    </div>
  );
}