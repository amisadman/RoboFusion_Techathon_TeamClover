import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/utils";
import { HAZARD_STATE_CONFIG } from "@/lib/status";
import type { HazardState } from "@/types/contract";

// Pairs color with an icon and a text label so status is never conveyed by
// color alone (SAFE / WARNING / CRITICAL / OFFLINE).
export function HazardStatusIndicator({
  state,
  size = "default",
  className,
}: {
  state: HazardState;
  size?: "sm" | "default";
  className?: string;
}) {
  const config = HAZARD_STATE_CONFIG[state];
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className={cn("inline-block size-1.5 shrink-0 rounded-full", config.dotClass)} aria-hidden="true" />
      <HugeiconsIcon
        icon={config.icon}
        strokeWidth={2}
        className={cn(size === "sm" ? "size-3" : "size-3.5", config.textClass)}
      />
      <span
        className={cn(
          "font-heading font-semibold tracking-wide",
          size === "sm" ? "text-[0.625rem]" : "text-xs",
          config.textClass
        )}
      >
        {config.label}
      </span>
    </span>
  );
}
