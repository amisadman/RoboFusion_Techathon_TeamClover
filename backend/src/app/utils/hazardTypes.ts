// Single source of truth for the hazard-type vocabulary used on
// Incident.hazardTypes. Sensor-triggered incidents (readings.service.ts)
// and the NL-report bonus path (bonus.service.ts) must both draw from this
// same set -- see docs/audit-findings.md F13.
export const KNOWN_HAZARD_TYPES = ["fire", "gas", "water"] as const;
export type HazardType = (typeof KNOWN_HAZARD_TYPES)[number];

export function isKnownHazardType(value: string | null | undefined): value is HazardType {
  return !!value && (KNOWN_HAZARD_TYPES as readonly string[]).includes(value);
}
