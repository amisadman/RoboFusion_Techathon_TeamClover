"use client";

import { useEffect, useRef, useState } from "react";

// Drives the Dispatch Ledger's "critical Ns" counter. `serverSeconds` is the
// latest seconds_critical value pushed over the socket; this hook fills the
// gaps between socket updates by ticking locally once a second, resyncing
// whenever a fresh server value arrives.
//
// Respects prefers-reduced-motion by ticking on a slower, non-animated
// cadence instead of every second -- the number still updates, just not in
// a way that reads as continuous motion.
export function useTickingSeconds(serverSeconds: number): number {
  const [display, setDisplay] = useState(serverSeconds);
  const baseRef = useRef<{ serverSeconds: number; receivedAt: number } | null>(null);

  useEffect(() => {
    baseRef.current = { serverSeconds, receivedAt: Date.now() };
    // Resyncing to a server-pushed live value, not deriving state from a
    // prop -- the anchor timestamp can only be captured at the moment the
    // new value actually arrives.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDisplay(serverSeconds);
  }, [serverSeconds]);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const intervalMs = prefersReducedMotion ? 5000 : 1000;

    const tick = () => {
      if (!baseRef.current) return;
      const elapsed = Math.floor((Date.now() - baseRef.current.receivedAt) / 1000);
      setDisplay(baseRef.current.serverSeconds + elapsed);
    };

    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, []);

  return display;
}
