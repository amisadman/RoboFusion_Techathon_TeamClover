export function startOfflineCheckerInterval(_intervalMs: number = 5000): NodeJS.Timeout {
  console.log("⏸️ [Offline Checker] Offline checker interval is currently DISABLED for testing.");
  return setTimeout(() => {}, 100000000);
}
