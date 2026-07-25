"use client";

import { useTickingSeconds } from "@/hooks/use-ticking-seconds";
import { formatElapsed } from "@/lib/format";

// The one animated element in the UI -- proves the system is live. The
// pulsing dot is motion-safe only; the digits themselves always update via
// plain text content, and tick less often under prefers-reduced-motion.
export function CriticalTimer({ seconds }: { seconds: number }) {
  const display = useTickingSeconds(seconds);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="motion-safe:animate-pulse inline-block size-1.5 rounded-full bg-critical" aria-hidden="true" />
      <span className="font-heading text-[0.625rem] font-semibold tracking-wide text-critical">CRITICAL</span>
      <span className="font-mono text-sm text-critical tabular-nums">{formatElapsed(display)}</span>
    </span>
  );
}
