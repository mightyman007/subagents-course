import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AnimatedDiagram } from "@/components/animated-diagram";
import { YouTubeEmbed } from "@/components/youtube-embed";
import { VideoPlaceholder } from "@/components/video-placeholder";
import { Mermaid } from "@/components/mermaid";

import mermaid from "mermaid";

// Mermaid is mocked wholesale: the real bundle needs DOM measurement APIs
// (getBBox & co.) that jsdom doesn't have. The component contract under test
// is the wiring — placeholder on first paint, svg injection on success, raw
// chart in a <pre> on failure — not mermaid's own rendering.
vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn(),
  },
}));

// vitest runs without `globals: true`, so RTL auto-cleanup must be wired here.
afterEach(cleanup);

describe("Mermaid", () => {
  beforeEach(() => {
    vi.mocked(mermaid.render).mockReset();
    vi.mocked(mermaid.initialize).mockReset();
  });

  // Runs first on purpose: the component's "initialize once per page load"
  // flag is module-level state, so this test must be the first to render a
  // <Mermaid> in this file to observe the exact one initialize call.
  it("initializes mermaid once (startOnLoad:false, dark theme) across re-renders, with unique render ids", async () => {
    vi.mocked(mermaid.render).mockResolvedValue({
      svg: "<svg data-diagram/>",
      diagramType: "flowchart",
    });
    const { rerender } = render(<Mermaid chart="graph TD; A-->B" />);
    await waitFor(() => expect(mermaid.render).toHaveBeenCalledTimes(1));

    // A changed chart re-renders, but must not re-initialize mermaid.
    rerender(<Mermaid chart="graph TD; B-->C" />);
    await waitFor(() => expect(mermaid.render).toHaveBeenCalledTimes(2));

    expect(mermaid.initialize).toHaveBeenCalledTimes(1);
    expect(mermaid.initialize).toHaveBeenCalledWith({ startOnLoad: false, theme: "dark" });

    const [firstId, firstChart] = vi.mocked(mermaid.render).mock.calls[0];
    const [secondId, secondChart] = vi.mocked(mermaid.render).mock.calls[1];
    expect(firstChart).toBe("graph TD; A-->B");
    expect(secondChart).toBe("graph TD; B-->C");
    expect(firstId).toMatch(/^mermaid-/);
    expect(secondId).toMatch(/^mermaid-/);
    expect(firstId).not.toBe(secondId);
  });

  it("renders the 'Diagram loading…' placeholder on first paint, then injects the rendered svg", async () => {
    vi.mocked(mermaid.render).mockResolvedValue({
      svg: "<svg data-diagram/>",
      diagramType: "flowchart",
    });
    const { container } = render(<Mermaid chart="graph TD; A-->B" />);

    // First paint: the placeholder, before the async render resolves.
    expect(screen.getByText("Diagram loading…")).toBeInTheDocument();

    const box = await waitFor(() => {
      const el = container.querySelector<HTMLElement>("[data-mermaid-container]");
      expect(el?.innerHTML).toContain("<svg");
      return el;
    });
    expect(box).not.toBeNull();
    expect(screen.queryByText("Diagram loading…")).toBeNull();
  });

  it("gives separate instances unique render ids", async () => {
    vi.mocked(mermaid.render).mockResolvedValue({
      svg: "<svg data-diagram/>",
      diagramType: "flowchart",
    });
    const { container } = render(
      <>
        <Mermaid chart="graph TD; A-->B" />
        <Mermaid chart="graph TD; C-->D" />
      </>,
    );
    await waitFor(() => {
      const boxes = container.querySelectorAll("[data-mermaid-container]");
      expect(boxes[1]?.innerHTML).toContain("<svg");
    });
    const [idA] = vi.mocked(mermaid.render).mock.calls[0];
    const [idB] = vi.mocked(mermaid.render).mock.calls[1];
    expect(idA).not.toBe(idB);
  });

  it("falls back to the raw chart in a <pre> on failure, and never crashes the page", async () => {
    vi.mocked(mermaid.render).mockRejectedValue(new Error("jsdom cannot measure"));
    const { container } = render(<Mermaid chart="graph TD; A-->B" />);

    // Placeholder holds until the failure lands, then the raw chart shows.
    expect(screen.getByText("Diagram loading…")).toBeInTheDocument();
    const pre = await screen.findByText("graph TD; A-->B", { selector: "pre" });
    expect(pre).toBeInTheDocument();
    // The page is still standing — the component degraded, it did not throw.
    expect(container.querySelector("[data-mermaid-container]")).toBeInTheDocument();
  });
});

describe("YouTubeEmbed", () => {
  it("renders a titled iframe pointing at the privacy-enhanced nocookie embed host", () => {
    render(<YouTubeEmbed id="abc123XYZ" title="Subagents in five minutes" />);
    const iframe = screen.getByTitle("Subagents in five minutes");
    expect(iframe.tagName).toBe("IFRAME");
    expect(iframe).toHaveAttribute("src", "https://www.youtube-nocookie.com/embed/abc123XYZ");
    expect(iframe).toHaveAttribute("allowfullscreen");
  });

  it("sits in a 16:9 responsive wrapper", () => {
    const { container } = render(<YouTubeEmbed id="abc123XYZ" title="t" />);
    const wrapper = container.querySelector("iframe")?.parentElement;
    expect(wrapper).toHaveClass("aspect-video");
  });
});

describe("VideoPlaceholder", () => {
  it("renders the topic and the coming-soon label in a dashed-border slot", () => {
    const { container } = render(<VideoPlaceholder topic="Streaming subagent output" />);
    expect(screen.getByText("Streaming subagent output")).toBeInTheDocument();
    expect(screen.getByText("Screencast coming soon")).toBeInTheDocument();
    expect(container.firstElementChild).toHaveClass("border-dashed");
  });
});

describe("AnimatedDiagram", () => {
  it("isolation: renders an svg at step 1 with the first caption and Prev disabled", () => {
    const { container } = render(<AnimatedDiagram kind="isolation" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.tagName).toBe("FIGURE");
    expect(root.getAttribute("data-step")).toBe("1");
    expect(container.querySelector("svg")).not.toBeNull();
    expect(screen.getByText("1. Parent holds full context")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Prev" })).toBeDisabled();
  });

  it("isolation: Next advances data-step 1→2 and swaps the caption", () => {
    const { container } = render(<AnimatedDiagram kind="isolation" />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(container.firstElementChild?.getAttribute("data-step")).toBe("2");
    expect(screen.getByText("2. Task is dispatched")).toBeInTheDocument();
    expect(screen.queryByText("1. Parent holds full context")).toBeNull();
    expect(screen.getByRole("button", { name: "Prev" })).toBeEnabled();
  });

  it("isolation: stops at the last step, then steps back down", () => {
    render(<AnimatedDiagram kind="isolation" />);
    const next = screen.getByRole("button", { name: "Next" });
    fireEvent.click(next);
    fireEvent.click(next);
    fireEvent.click(next);
    expect(screen.getByText("4. Only the result returns")).toBeInTheDocument();
    expect(next).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Prev" }));
    expect(screen.getByText("3. Child works in fresh context")).toBeInTheDocument();
  });

  it("fanout: shows three subagent nodes and its own three-step range", () => {
    const { container } = render(<AnimatedDiagram kind="fanout" />);
    expect(container.querySelectorAll("[data-subagent]")).toHaveLength(3);
    expect(screen.getByText("1. The orchestrator keeps the goal and the plan")).toBeInTheDocument();

    const next = screen.getByRole("button", { name: "Next" });
    fireEvent.click(next);
    fireEvent.click(next);
    expect(container.firstElementChild?.getAttribute("data-step")).toBe("3");
    expect(
      screen.getByText(
        "3. Each subagent returns only its result; the orchestrator merges them",
      ),
    ).toBeInTheDocument();
    expect(next).toBeDisabled();
  });
});
