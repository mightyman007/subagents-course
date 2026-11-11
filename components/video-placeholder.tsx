interface VideoPlaceholderProps {
  /** What the future screencast will cover — shown while the slot is empty. */
  topic: string;
}

/**
 * Reserved slot for a screencast that hasn't been recorded yet. The topic
 * stays visible so chapter outlines read correctly in review, with an
 * explicit coming-soon label instead of an empty gap.
 */
export function VideoPlaceholder({ topic }: VideoPlaceholderProps) {
  return (
    <div className="my-6 rounded-lg border border-dashed border-line p-6 text-center">
      <p className="text-sm text-foreground">{topic}</p>
      <p className="mt-1 font-mono text-xs text-muted">Screencast coming soon</p>
    </div>
  );
}
