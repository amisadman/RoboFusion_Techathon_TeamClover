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

export function processDebounce(
  zoneId: string,
  flameRaw: number,
  calculatedScore: number
): { debouncedFlame: boolean; isWarmUp: boolean; finalScore: number } {
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

  // 3. Linear decay on score drop (never snap instantly to 0)
  let finalScore = calculatedScore;
  if (calculatedScore < state.decayingScore) {
    // Decay by ~5 points per reading
    state.decayingScore = Math.max(calculatedScore, state.decayingScore - 5.0);
    finalScore = state.decayingScore;
  } else {
    state.decayingScore = calculatedScore;
  }

  return {
    debouncedFlame,
    isWarmUp,
    finalScore: Number(finalScore.toFixed(1)),
  };
}

export function resetDebounceState(zoneId: string) {
  delete zoneDebounceStore[zoneId];
}
