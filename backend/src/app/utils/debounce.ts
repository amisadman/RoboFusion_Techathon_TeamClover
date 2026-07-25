interface ZoneDebounceState {
  consecutiveFlameCount: number;
  lastFlameSignal: boolean;
  decayingScore: number;
  bootTimestamp: number;
}

const zoneDebounceStore: Record<string, ZoneDebounceState> = {};
const DEBOUNCE_THRESHOLD = 5; // N=5 consecutive readings (~1s)

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

  // 2. Consecutive flame count check (flame_raw > 500 considered active flame)
  const rawFlameActive = flameRaw > 500;
  if (rawFlameActive) {
    state.consecutiveFlameCount += 1;
  } else {
    state.consecutiveFlameCount = 0;
  }
  const debouncedFlame = state.consecutiveFlameCount >= DEBOUNCE_THRESHOLD;

  // 3. Linear decay on score drop (never snap instantly to 0)
  let finalScore = calculatedScore;
  if (calculatedScore < state.decayingScore) {
    // Decay by ~5 points per reading (~1 second to decay 25 pts)
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
