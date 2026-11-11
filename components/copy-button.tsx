"use client";

import { useEffect, useRef, useState } from "react";

interface CopyButtonProps {
  /** Text placed on the clipboard (e.g. the full agent-template file). */
  text: string;
  /** Resting button label. */
  label?: string;
}

/**
 * Copy-to-clipboard button for small self-contained text blobs (agent
 * templates). Shows "copied" for a moment on success; on failure (clipboard
 * blocked or unavailable) it silently keeps the resting label — the template
 * is also downloadable as a plain file, so nothing is lost.
 */
export function CopyButton({ text, label = "copy" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear the pending reset on unmount so a copied state never outlives the node.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (permission denied, insecure context): keep the
      // resting label — the file itself is downloadable as a fallback.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-live="polite"
      className={
        copied
          ? "rounded border border-accent px-2 py-1 font-mono text-xs text-accent"
          : "rounded border border-line px-2 py-1 font-mono text-xs text-muted transition-colors hover:border-accent hover:text-accent"
      }
    >
      {copied ? "copied" : label}
    </button>
  );
}