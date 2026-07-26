export interface KnownZone {
  id: string;
  name: string;
}

const KNOWN_HAZARD_TYPES = ["fire", "gas", "water"] as const;
const KNOWN_SEVERITIES = ["SAFE", "WARNING", "CRITICAL"] as const;

export interface ValidationResult {
  valid: boolean;
  zone_match: boolean;
  hazard_match: boolean;
  severity_valid: boolean;
  errors: string[];
}

export function validateExtractedSignal(
  signal: { zone_id: string | null; hazard_type: string | null; estimated_severity: string },
  knownZones: KnownZone[]
): ValidationResult {
  const errors: string[] = [];
  const knownZoneIds = knownZones.map((z) => z.id);

  const zone_match = signal.zone_id !== null && knownZoneIds.includes(signal.zone_id);
  if (!zone_match) {
    if (signal.zone_id === null) {
      errors.push("Zone could not be determined from the report");
    } else {
      errors.push(`Unknown zone: "${signal.zone_id}"`);
    }
  }

  const hazard_match = signal.hazard_type !== null && (KNOWN_HAZARD_TYPES as readonly string[]).includes(signal.hazard_type);
  if (!hazard_match) {
    if (signal.hazard_type === null) {
      errors.push("Hazard type could not be determined from the report");
    } else {
      errors.push(`Unknown hazard type: "${signal.hazard_type}"`);
    }
  }

  const severity_valid = (KNOWN_SEVERITIES as readonly string[]).includes(signal.estimated_severity);
  if (!severity_valid) {
    errors.push(`Invalid severity: "${signal.estimated_severity}"`);
  }

  return {
    valid: zone_match && hazard_match && severity_valid,
    zone_match,
    hazard_match,
    severity_valid,
    errors,
  };
}

export function getZoneName(zoneId: string, knownZones: KnownZone[]): string {
  return knownZones.find((z) => z.id === zoneId)?.name ?? zoneId;
}

export function formatSeverity(severity: "SAFE" | "WARNING" | "CRITICAL"): string {
  switch (severity) {
    case "CRITICAL": return "CRITICAL";
    case "WARNING": return "WARNING";
    case "SAFE": return "SAFE (no action)";
  }
}

export function hazardLabel(type: string): string {
  switch (type) {
    case "fire": return "Fire";
    case "gas": return "Gas";
    case "water": return "Water";
    default: return type;
  }
}
