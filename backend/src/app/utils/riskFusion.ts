import { HazardState } from "../types/contract.js";

export interface SensorInputs {
  flame_raw: number; // ADC or binary threshold
  gas_raw: number;   // 0 - 1023
  water_raw: number; // 0 - 1023
  motion: boolean;
}

export interface FusionResult {
  riskScore: number;
  state: HazardState;
  contributions: {
    fire: number;
    gas: number;
    water: number;
    occupancy: number;
  };
  commands: {
    led: "green" | "yellow" | "red" | "offline";
    buzzer: boolean;
    relay_cutoff: boolean;
  };
}

const WEIGHTS = {
  fire: 40,
  gas: 25,
  water: 20,
  occupancy: 15,
};

export function calculateRiskFusion(
  sensors: SensorInputs,
  debouncedFireSignal: boolean,
  isWarmUp: boolean
): FusionResult {
  // 1. Fire contribution (40 pts): binary 0 or 1 after debounce check
  const fire_norm = debouncedFireSignal ? 1.0 : 0.0;
  const fire_contrib = WEIGHTS.fire * fire_norm;

  // 2. Gas contribution (25 pts): normalized 0.0 - 1.0. Zeroed during 30s warm-up
  const raw_gas = Math.max(0, Math.min(1023, sensors.gas_raw));
  const gas_norm = isWarmUp ? 0.0 : raw_gas / 1023.0;
  const gas_contrib = WEIGHTS.gas * gas_norm;

  // 3. Water level contribution (20 pts): normalized 0.0 - 1.0
  const raw_water = Math.max(0, Math.min(1023, sensors.water_raw));
  const water_norm = raw_water / 1023.0;
  const water_contrib = WEIGHTS.water * water_norm;

  // 4. Occupancy factor (15 pts): 1.0 if motion detected, 0.0 if empty
  const occ_norm = sensors.motion ? 1.0 : 0.0;
  const occ_contrib = WEIGHTS.occupancy * occ_norm;

  // Total risk score capped at 100.0
  const totalScore = Number(
    Math.min(100.0, fire_contrib + gas_contrib + water_contrib + occ_contrib).toFixed(1)
  );

  // State classification
  let state: HazardState = "SAFE";
  if (totalScore >= 65.0) {
    state = "CRITICAL";
  } else if (totalScore >= 30.0) {
    state = "WARNING";
  }

  // Actuation commands
  let led: "green" | "yellow" | "red" | "offline" = "green";
  let buzzer = false;
  let relay_cutoff = false;

  if (state === "CRITICAL") {
    led = "red";
    buzzer = true;
    relay_cutoff = true;
  } else if (state === "WARNING") {
    led = "yellow";
    buzzer = false;
    relay_cutoff = false;
  } else {
    led = "green";
    buzzer = false;
    relay_cutoff = false;
  }

  return {
    riskScore: totalScore,
    state,
    contributions: {
      fire: Number(fire_contrib.toFixed(1)),
      gas: Number(gas_contrib.toFixed(1)),
      water: Number(water_contrib.toFixed(1)),
      occupancy: Number(occ_contrib.toFixed(1)),
    },
    commands: {
      led,
      buzzer,
      relay_cutoff,
    },
  };
}
