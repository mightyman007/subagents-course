export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6">
      <main className="w-full max-w-2xl font-mono text-sm leading-relaxed">
        <p className="text-muted">
          <span className="text-accent">~$</span> ./subagents-mastery --init
        </p>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Subagents Mastery
        </h1>
        <p className="mt-3 text-muted">
          An interactive self-study course on AI coding subagents — dispatch,
          orchestrate, and scale your work with OpenCode V2 and Claude Code.
        </p>
        <p className="mt-8 text-muted">
          <span className="text-accent">[status]</span> scaffold ready — content
          coming online.
        </p>
      </main>
    </div>
  );
}
