interface ZoneDebounceState {
  consecutiveFlameCount: number;
  lastFlameSignal: boolean;
  decayingScore: number;
  bootTimestamp: number;
}

const zoneDebounceStore: Record<string, ZoneDebounceState> = {};
const DEBOUNCE_THRESHOLD = 3; // N=3 consecutive readings for fast Wokwi response

export function getOrCreateDebounceState(zoneId: string): ZoneDebounceState {
  if (!zoneDebounceStore[zoneId]) {
    zoneDebounceStore[zoneId] = {
      consecutiveFlameCount: 0,
      lastFlameSignal: false,
      decayingScore: 0,
      bootTimestamp: Date.now(),
    };
  }
  return zoneDebounceStore[zoneId];
}

// Flame debounce + gas warm-up window. Pure function of raw sensor values
// and internal per-zone counters -- does not need a risk score, so it can
// run before calculateRiskFusion().
export function getFlameDebounceAndWarmup(
  zoneId: string,
  flameRaw: number
): { debouncedFlame: boolean; isWarmUp: boolean } {
  const state = getOrCreateDebounceState(zoneId);
  const now = Date.now();

  // 1. Check 30-second gas warm-up window
  const isWarmUp = now - state.bootTimestamp < 30000;

  // 2. Dynamic threshold check: ESP32 12-bit ADC (>1500) vs Arduino 10-bit ADC (>400)
  const threshold = flameRaw > 1023 ? 1500 : 400;
  const rawFlameActive = flameRaw > threshold;

  if (rawFlameActive) {
    state.consecutiveFlameCount += 1;
  } else {
    state.consecutiveFlameCount = 0;
  }
  const debouncedFlame = state.consecutiveFlameCount >= DEBOUNCE_THRESHOLD;

  return { debouncedFlame, isWarmUp };
}

// Linear decay: smooths a DROP in the freshly-computed risk score over
// several readings (~5 points/reading) instead of snapping straight to
// the new lower value, so a momentary sensor dip doesn't flap the state.
// Must be called with the CURRENT cycle's freshly computed fusion score --
// NOT a previously-stored/held score -- or the comparison against the
// held decayingScore degenerates into comparing a value against itself
// and decay never triggers (see docs/audit-findings.md F2).
export function applyDecay(zoneId: string, freshScore: number): number {
  const state = getOrCreateDebounceState(zoneId);

  if (freshScore < state.decayingScore) {
    state.decayingScore = Math.max(freshScore, state.decayingScore - 5.0);
  } else {
    state.decayingScore = freshScore;
  }

  return Number(state.decayingScore.toFixed(1));
}

export function resetDebounceState(zoneId: string) {
  delete zoneDebounceStore[zoneId];
}
