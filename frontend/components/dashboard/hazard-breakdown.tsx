import { HugeiconsIcon } from "@hugeicons/react";
import { Fire02Icon, GasPipeIcon, DropletsIcon, FootprintsIcon } from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

type ContributionKey = "fire" | "gas" | "water" | "occupancy";

const HAZARD_ROWS: Array<{ key: ContributionKey; label: string; icon: IconSvgElement }> = [
  { key: "fire", label: "Fire", icon: Fire02Icon },
  { key: "gas", label: "Gas", icon: GasPipeIcon },
  { key: "water", label: "Water", icon: DropletsIcon },
  { key: "occupancy", label: "Occupancy", icon: FootprintsIcon },
];

// Per-hazard share of the CURRENT total risk_score -- deliberately not
// divided by a hardcoded max weight (fire/gas/water/occupancy weights
// aren't reliably known here and could change independently of this
// component), so this stays correct regardless of what the fusion
// weights actually are.
export function HazardBreakdown({
  contributions,
  riskScore,
}: {
  contributions?: { fire: number; gas: number; water: number; occupancy: number };
  riskScore: number;
}) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-hairline px-(--card-spacing) pt-2">
      {HAZARD_ROWS.map((row) => {
        const value = contributions?.[row.key];
        const pct = value !== undefined && riskScore > 0 ? Math.min(100, Math.max(0, (value / riskScore) * 100)) : 0;

        return (
          <div key={row.key} className="flex items-center gap-2">
            <HugeiconsIcon icon={row.icon} strokeWidth={2} className="size-3 shrink-0 text-text-muted" aria-hidden="true" />
            <span className="w-16 shrink-0 text-[0.625rem] text-text-muted">{row.label}</span>
            <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-hairline">
              <div className="h-full rounded-full bg-text-muted" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-8 shrink-0 text-right font-mono text-[0.625rem] text-text-muted tabular-nums">
              {value !== undefined ? value.toFixed(1) : "--"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
