import {
  CheckmarkCircle02Icon,
  Alert02Icon,
  AlertDiamondIcon,
  WifiDisconnected03Icon,
  AlertCircleIcon,
  CheckmarkBadge01Icon,
} from "@hugeicons/core-free-icons";
import type { HazardState, IncidentStatus } from "@/types/contract";

export const HAZARD_STATE_CONFIG: Record<
  HazardState,
  {
    label: string;
    icon: typeof Alert02Icon;
    dotClass: string;
    textClass: string;
    borderClass: string;
    bgSoftClass: string;
  }
> = {
  SAFE: {
    label: "SAFE",
    icon: CheckmarkCircle02Icon,
    dotClass: "bg-safe",
    textClass: "text-safe",
    borderClass: "border-safe",
    bgSoftClass: "bg-safe/10",
  },
  WARNING: {
    label: "WARNING",
    icon: Alert02Icon,
    dotClass: "bg-warning",
    textClass: "text-warning",
    borderClass: "border-warning",
    bgSoftClass: "bg-warning/10",
  },
  CRITICAL: {
    label: "CRITICAL",
    icon: AlertDiamondIcon,
    dotClass: "bg-critical",
    textClass: "text-critical",
    borderClass: "border-critical",
    bgSoftClass: "bg-critical/10",
  },
  OFFLINE: {
    label: "OFFLINE",
    icon: WifiDisconnected03Icon,
    dotClass: "bg-offline",
    textClass: "text-offline",
    borderClass: "border-offline",
    bgSoftClass: "bg-offline/10",
  },
};

// Rank order for "most urgent first" sorting -- lower sorts first.
export const HAZARD_STATE_RANK: Record<HazardState, number> = {
  CRITICAL: 0,
  WARNING: 1,
  SAFE: 2,
  OFFLINE: 3,
};

export const INCIDENT_STATUS_CONFIG: Record<
  IncidentStatus,
  { label: string; icon: typeof Alert02Icon; textClass: string; bgSoftClass: string }
> = {
  OPEN: {
    label: "Open",
    icon: AlertCircleIcon,
    textClass: "text-critical",
    bgSoftClass: "bg-critical/10",
  },
  ACKED: {
    label: "Acknowledged",
    icon: CheckmarkBadge01Icon,
    textClass: "text-warning",
    bgSoftClass: "bg-warning/10",
  },
  RESOLVED: {
    label: "Resolved",
    icon: CheckmarkCircle02Icon,
    textClass: "text-safe",
    bgSoftClass: "bg-safe/10",
  },
};
