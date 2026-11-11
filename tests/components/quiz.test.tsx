import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Quiz } from "@/components/quiz";
import { Exam } from "@/components/exam";
import type { Question } from "@/lib/content/schema";

// vitest runs without `globals: true`, so RTL auto-cleanup must be wired here.
afterEach(cleanup);

const quizQs: Question[] = [
  {
    id: "s1",
    type: "single",
    prompt: "Single pick?",
    options: ["alpha", "beta", "gamma"],
    correct: [1],
    explanation: "beta is the right one",
  },
  {
    id: "m1",
    type: "multi",
    prompt: "Multi pick?",
    options: ["one", "two", "three", "four"],
    correct: [0, 2],
    explanation: "one and three",
  },
  {
    id: "b1",
    type: "boolean",
    prompt: "True or false?",
    options: ["True", "False"],
    correct: [0],
    explanation: "it is true",
  },
  {
    id: "s2",
    type: "single",
    prompt: "Final pick?",
    options: ["red", "blue"],
    correct: [1],
    explanation: "blue wins",
  },
];

function group(name: string) {
  return within(screen.getByRole("group", { name }));
}

describe("Quiz", () => {
  it("renders every question with its options as accessible buttons", () => {
    render(<Quiz questions={quizQs} chapterId="01-x" />);
    for (const prompt of ["Single pick?", "Multi pick?", "True or false?", "Final pick?"]) {
      expect(screen.getByRole("group", { name: prompt })).toBeInTheDocument();
    }
    for (const opt of ["alpha", "beta", "gamma", "one", "two", "three", "four", "True", "False", "red", "blue"]) {
      expect(screen.getByRole("button", { name: opt })).toBeInTheDocument();
    }
  });

  it("Submit is disabled until an option is picked", () => {
    render(<Quiz questions={quizQs} chapterId="01-x" />);
    expect(group("Single pick?").getByRole("button", { name: "Submit" })).toBeDisabled();
  });

  it("single: select, submit → Correct state + explanation, then locked", () => {
    render(<Quiz questions={quizQs} chapterId="01-x" />);
    const g = group("Single pick?");
    fireEvent.click(g.getByRole("button", { name: "beta" }));
    expect(g.getByRole("button", { name: "beta" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(g.getByRole("button", { name: "Submit" }));
    expect(g.getByText("Correct")).toBeInTheDocument();
    expect(g.getByText("beta is the right one")).toBeInTheDocument();
    expect(g.getByRole("button", { name: "beta" })).toBeDisabled();
    expect(g.queryByRole("button", { name: "Submit" })).toBeNull();
  });

  it("single: wrong pick → Incorrect state + explanation still shown", () => {
    render(<Quiz questions={quizQs} chapterId="01-x" />);
    const g = group("Single pick?");
    fireEvent.click(g.getByRole("button", { name: "alpha" }));
    fireEvent.click(g.getByRole("button", { name: "Submit" }));
    expect(g.getByText("Incorrect")).toBeInTheDocument();
    expect(g.getByText("beta is the right one")).toBeInTheDocument();
  });

  it("single: picking another option replaces the selection", () => {
    render(<Quiz questions={quizQs} chapterId="01-x" />);
    const g = group("Single pick?");
    fireEvent.click(g.getByRole("button", { name: "alpha" }));
    fireEvent.click(g.getByRole("button", { name: "gamma" }));
    expect(g.getByRole("button", { name: "alpha" })).toHaveAttribute("aria-pressed", "false");
    expect(g.getByRole("button", { name: "gamma" })).toHaveAttribute("aria-pressed", "true");
  });

  it("multi: options toggle independently", () => {
    render(<Quiz questions={quizQs} chapterId="01-x" />);
    const g = group("Multi pick?");
    fireEvent.click(g.getByRole("button", { name: "one" }));
    fireEvent.click(g.getByRole("button", { name: "three" }));
    expect(g.getByRole("button", { name: "one" })).toHaveAttribute("aria-pressed", "true");
    expect(g.getByRole("button", { name: "three" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(g.getByRole("button", { name: "one" }));
    expect(g.getByRole("button", { name: "one" })).toHaveAttribute("aria-pressed", "false");
    expect(g.getByRole("button", { name: "three" })).toHaveAttribute("aria-pressed", "true");
  });

  it("multi: partial selection grades Incorrect after submit", () => {
    render(<Quiz questions={quizQs} chapterId="01-x" />);
    const g = group("Multi pick?");
    fireEvent.click(g.getByRole("button", { name: "one" }));
    fireEvent.click(g.getByRole("button", { name: "Submit" }));
    expect(g.getByText("Incorrect")).toBeInTheDocument();
    expect(g.getByText("one and three")).toBeInTheDocument();
  });

  it("multi: exact selection grades Correct after submit", () => {
    render(<Quiz questions={quizQs} chapterId="01-x" />);
    const g = group("Multi pick?");
    fireEvent.click(g.getByRole("button", { name: "one" }));
    fireEvent.click(g.getByRole("button", { name: "three" }));
    fireEvent.click(g.getByRole("button", { name: "Submit" }));
    expect(g.getByText("Correct")).toBeInTheDocument();
  });

  it("after all questions are submitted, shows '3/4 (75%)' and fires onComplete once", () => {
    const onComplete = vi.fn();
    render(<Quiz questions={quizQs} chapterId="01-x" onComplete={onComplete} />);
    // s1 correct
    fireEvent.click(group("Single pick?").getByRole("button", { name: "beta" }));
    fireEvent.click(group("Single pick?").getByRole("button", { name: "Submit" }));
    // m1 correct
    fireEvent.click(group("Multi pick?").getByRole("button", { name: "one" }));
    fireEvent.click(group("Multi pick?").getByRole("button", { name: "three" }));
    fireEvent.click(group("Multi pick?").getByRole("button", { name: "Submit" }));
    // b1 correct
    fireEvent.click(group("True or false?").getByRole("button", { name: "True" }));
    fireEvent.click(group("True or false?").getByRole("button", { name: "Submit" }));
    // s2 wrong
    fireEvent.click(group("Final pick?").getByRole("button", { name: "red" }));
    fireEvent.click(group("Final pick?").getByRole("button", { name: "Submit" }));

    expect(screen.getByText("3/4 (75%)")).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({ score: 3, total: 4, percent: 75 });
  });

  it("no summary until every question has been submitted", () => {
    render(<Quiz questions={quizQs} chapterId="01-x" />);
    fireEvent.click(group("Single pick?").getByRole("button", { name: "beta" }));
    fireEvent.click(group("Single pick?").getByRole("button", { name: "Submit" }));
    expect(screen.queryByText(/\/4 \(/)).toBeNull();
  });
});

const examQs: Question[] = [
  { id: "e1", type: "single", prompt: "E1?", options: ["ea", "eb"], correct: [0], explanation: "ea is right" },
  { id: "e2", type: "single", prompt: "E2?", options: ["ec", "ed"], correct: [1], explanation: "ed is right" },
  { id: "e3", type: "single", prompt: "E3?", options: ["ee", "ef"], correct: [0], explanation: "ee is right" },
  { id: "e4", type: "single", prompt: "E4?", options: ["eg", "eh"], correct: [1], explanation: "eh is right" },
  { id: "e5", type: "multi", prompt: "E5?", options: ["ei", "ej", "ek"], correct: [0, 1], explanation: "ei and ej" },
];

function answerExam(correctCount: number) {
  const answers: Record<string, string[]> = {
    e1: ["ea"],
    e2: ["ed"],
    e3: ["ee"],
    e4: correctCount >= 4 ? ["eh"] : ["eg"],
    e5: correctCount >= 5 ? ["ei", "ej"] : ["ei"],
  };
  for (const [id, opts] of Object.entries(answers)) {
    const g = within(screen.getByRole("group", { name: `${id.toUpperCase()}?` }));
    for (const opt of opts) fireEvent.click(g.getByRole("button", { name: opt }));
  }
}

describe("Exam", () => {
  it("shows no per-question feedback and no results before submit", () => {
    render(<Exam questions={examQs} passMarkPercent={80} />);
    answerExam(4);
    expect(screen.queryByText("Correct")).toBeNull();
    expect(screen.queryByText("Incorrect")).toBeNull();
    expect(screen.queryByText("PASSED")).toBeNull();
    expect(screen.queryByText("FAILED")).toBeNull();
    expect(screen.queryByRole("button", { name: "Retake" })).toBeNull();
  });

  it("Submit exam stays disabled until every question is answered", () => {
    render(<Exam questions={examQs} passMarkPercent={80} />);
    const submit = screen.getByRole("button", { name: "Submit exam" });
    const g = (name: string) => within(screen.getByRole("group", { name }));
    expect(submit).toBeDisabled();
    fireEvent.click(g("E1?").getByRole("button", { name: "ea" }));
    fireEvent.click(g("E2?").getByRole("button", { name: "ed" }));
    fireEvent.click(g("E3?").getByRole("button", { name: "ee" }));
    fireEvent.click(g("E4?").getByRole("button", { name: "eh" }));
    expect(submit).toBeDisabled(); // E5 still unanswered
    fireEvent.click(g("E5?").getByRole("button", { name: "ei" }));
    fireEvent.click(g("E5?").getByRole("button", { name: "ej" }));
    expect(submit).toBeEnabled();
  });

  it("after full submit: 80% at a pass mark of 80 → PASSED (percent ≥ passMark)", () => {
    render(<Exam questions={examQs} passMarkPercent={80} />);
    answerExam(4); // 4/5 = 80%
    fireEvent.click(screen.getByRole("button", { name: "Submit exam" }));
    expect(screen.getByText("4/5 (80%)")).toBeInTheDocument();
    expect(screen.getByText("PASSED")).toBeInTheDocument();
  });

  it("after full submit: 60% at a pass mark of 80 → FAILED", () => {
    render(<Exam questions={examQs} passMarkPercent={80} />);
    answerExam(3); // 3/5 = 60%
    fireEvent.click(screen.getByRole("button", { name: "Submit exam" }));
    expect(screen.getByText("3/5 (60%)")).toBeInTheDocument();
    expect(screen.getByText("FAILED")).toBeInTheDocument();
  });

  it("fires onComplete once on submit; retake clears selections, results, and calls onRetake", () => {
    const onComplete = vi.fn();
    const onRetake = vi.fn();
    render(
      <Exam questions={examQs} passMarkPercent={80} onComplete={onComplete} onRetake={onRetake} />,
    );
    answerExam(4);
    fireEvent.click(screen.getByRole("button", { name: "Submit exam" }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({ score: 4, total: 5, percent: 80 });

    fireEvent.click(screen.getByRole("button", { name: "Retake" }));
    expect(onRetake).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("PASSED")).toBeNull();
    expect(screen.queryByText("4/5 (80%)")).toBeNull();
    expect(screen.queryByText("Correct")).toBeNull();
    for (const opt of ["ea", "ed", "ee", "eh", "ei", "ej"]) {
      expect(screen.getByRole("button", { name: opt })).toHaveAttribute("aria-pressed", "false");
    }
    expect(screen.getByRole("button", { name: "Submit exam" })).toBeDisabled();
  });
});
