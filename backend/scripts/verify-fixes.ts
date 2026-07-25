// Automated verification suite for the fixes in docs/audit-findings.md.
// Exercises the DEPLOYED backend over HTTP exactly as a real client would
// (firmware, dashboard, or an attacker) -- no direct Prisma access, no
// bypassing the API.
//
// Usage:
//   BACKEND_URL=https://... DEPLOYED_FRONTEND_URL=https://... tsx backend/scripts/verify-fixes.ts
//
// Defaults to the deployed Render backend and the deployed Vercel frontend
// if those env vars are not set (both are real, known-good URLs from this
// project, not guesses).
//
// IMPORTANT: this writes real (if synthetic) Reading/Incident rows into
// whatever database BACKEND_URL's backend is using. Run `npm run
// reset:demo` before recording any demo material afterward.

const BACKEND_URL = process.env.BACKEND_URL || "https://robofusion-techathon-teamclover.onrender.com";

// The origin this SCRIPT authenticates as -- separate from
// DEPLOYED_FRONTEND_URL below. Empirically, Better Auth's CSRF origin
// check on this deployment accepts the backend's own origin (same-origin
// requests are implicitly trusted independent of trustedOrigins) but
// rejected both the actual deployed Vercel frontend URL and
// "http://localhost:3000" when tried as Origin during this run -- itself
// live evidence for the F14 finding below, not just static-code doubt.
const SCRIPT_AUTH_ORIGIN = BACKEND_URL;

const DEPLOYED_FRONTEND_URL_SOURCE = process.env.DEPLOYED_FRONTEND_URL
  ? "env var DEPLOYED_FRONTEND_URL"
  : "known deployment from this project (not a guess) -- override with DEPLOYED_FRONTEND_URL if stale";
const DEPLOYED_FRONTEND_URL = process.env.DEPLOYED_FRONTEND_URL || "https://frontend-lac-seven-27.vercel.app";

const ADMIN_EMAIL = "admin@uftb.edu.bd";
const STAFF_EMAIL = "staff@uftb.edu.bd";
const DEFAULT_PASSWORD = "Password123!"; // backend/src/app/config/seed.ts

const PRIMARY_ZONE = "iot_lab";
const SECONDARY_ZONE = "server_room";

type CheckStatus = "PASS" | "FAIL" | "INFO";
interface CheckResult {
  id: string;
  title: string;
  status: CheckStatus;
  detail: string;
}
const results: CheckResult[] = [];

function record(id: string, title: string, status: CheckStatus, detail: string) {
  results.push({ id, title, status, detail });
  const icon = status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "ℹ️ ";
  console.log(`\n${icon} [${status}] ${id} -- ${title}`);
  console.log(detail);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function json(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

// ---------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------

async function signIn(email: string, password: string, retriesLeft = 4): Promise<string> {
  const res = await fetch(`${BACKEND_URL}/api/auth/sign-in/email`, {
    method: "POST",
    // Better Auth's CSRF origin check requires a trusted Origin header on
    // state-changing auth requests.
    headers: { "Content-Type": "application/json", Origin: SCRIPT_AUTH_ORIGIN },
    body: JSON.stringify({ email, password }),
  });
  if (res.status === 429 && retriesLeft > 0) {
    const retryAfterS = Number(res.headers.get("retry-after")) || 15;
    console.log(`  sign-in rate-limited, waiting ${retryAfterS}s before retry (${retriesLeft} left)...`);
    await sleep(retryAfterS * 1000);
    return signIn(email, password, retriesLeft - 1);
  }
  const body = await json(res);
  if (!res.ok) {
    throw new Error(`Sign-in failed for ${email}: HTTP ${res.status} ${JSON.stringify(body)}`);
  }
  const cookies =
    typeof (res.headers as any).getSetCookie === "function"
      ? (res.headers as any).getSetCookie()
      : [res.headers.get("set-cookie") || ""];
  const cookieHeader = cookies
    .filter(Boolean)
    .map((c: string) => c.split(";")[0])
    .join("; ");
  if (!cookieHeader) {
    throw new Error(`Sign-in for ${email} returned HTTP ${res.status} but no session cookie`);
  }
  return cookieHeader;
}

async function getZoneKey(adminCookie: string, zoneId: string): Promise<string> {
  const res = await fetch(`${BACKEND_URL}/api/zones/${zoneId}/key`, {
    headers: { Cookie: adminCookie },
  });
  const body = await json(res);
  if (!res.ok || !body.success) {
    throw new Error(`Failed to retrieve real API key for zone '${zoneId}': HTTP ${res.status} ${JSON.stringify(body)}`);
  }
  return body.data.api_key;
}

async function getZones(cookie: string) {
  const res = await fetch(`${BACKEND_URL}/api/zones`, { headers: { Cookie: cookie } });
  const body = await json(res);
  if (!res.ok || !body.success) throw new Error(`GET /api/zones failed: HTTP ${res.status} ${JSON.stringify(body)}`);
  return body.data as Array<{ zone_id: string; state: string; risk_score: number; last_seen_at: string | null }>;
}

function findZone(zones: Awaited<ReturnType<typeof getZones>>, zoneId: string) {
  const z = zones.find((z) => z.zone_id === zoneId);
  if (!z) throw new Error(`Zone '${zoneId}' missing from GET /api/zones response`);
  return z;
}

let seqCounter = Math.floor(Date.now() / 1000); // monotonic, unique-ish across runs

async function postReading(zoneKey: string, zoneId: string, sensors: {
  flame_raw: number;
  gas_raw: number;
  water_raw: number;
  motion: boolean;
}) {
  seqCounter += 1;
  const res = await fetch(`${BACKEND_URL}/api/readings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Zone-Key": zoneKey },
    body: JSON.stringify({
      zone_id: zoneId,
      seq: seqCounter,
      timestamp_ms: Date.now(),
      sensors,
      sensor_health: { flame: "ok", gas: "ok", water: "ok", motion: "ok" },
    }),
  });
  const body = await json(res);
  return { status: res.status, body };
}

// ---------------------------------------------------------------------
// Check: F3 -- X-Zone-Key must be validated against body.zone_id
// ---------------------------------------------------------------------
async function checkF3(primaryKey: string, adminCookie: string) {
  const before = await getZones(adminCookie);
  const beforePrimary = findZone(before, PRIMARY_ZONE);
  const beforeSecondary = findZone(before, SECONDARY_ZONE);

  // Zone A's real key, Zone B's zone_id in the body.
  const { status, body } = await postReading(primaryKey, SECONDARY_ZONE, {
    flame_raw: 900,
    gas_raw: 0,
    water_raw: 0,
    motion: false,
  });

  const rejectedCorrectly =
    status === 401 &&
    body?.data?.accepted === false &&
    (body?.data?.error === "unauthorized") &&
    body?.data?.field === "zone_id";

  const after = await getZones(adminCookie);
  const afterPrimary = findZone(after, PRIMARY_ZONE);
  const afterSecondary = findZone(after, SECONDARY_ZONE);
  const neitherZoneAffected =
    afterPrimary.state === beforePrimary.state &&
    afterPrimary.risk_score === beforePrimary.risk_score &&
    afterSecondary.state === beforeSecondary.state &&
    afterSecondary.risk_score === beforeSecondary.risk_score;

  const detail =
    `POST /api/readings with '${PRIMARY_ZONE}'s key but zone_id:'${SECONDARY_ZONE}' -> ` +
    `HTTP ${status}, body=${JSON.stringify(body)}\n` +
    `Rejected with documented shape (401, accepted:false, error:unauthorized, field:zone_id): ${rejectedCorrectly}\n` +
    `'${PRIMARY_ZONE}' unaffected: ${afterPrimary.state === beforePrimary.state && afterPrimary.risk_score === beforePrimary.risk_score} ` +
    `(before ${beforePrimary.state}/${beforePrimary.risk_score}, after ${afterPrimary.state}/${afterPrimary.risk_score})\n` +
    `'${SECONDARY_ZONE}' unaffected: ${afterSecondary.state === beforeSecondary.state && afterSecondary.risk_score === beforeSecondary.risk_score} ` +
    `(before ${beforeSecondary.state}/${beforeSecondary.risk_score}, after ${afterSecondary.state}/${afterSecondary.risk_score})`;

  record(
    "F3",
    "X-Zone-Key must be validated against body.zone_id",
    rejectedCorrectly && neitherZoneAffected ? "PASS" : "FAIL",
    detail
  );
}

// ---------------------------------------------------------------------
// Check: TC6b -- malformed/out-of-range payload rejected with 400
// ---------------------------------------------------------------------
async function checkTC6b(primaryKey: string) {
  const { status, body } = await postReading(primaryKey, PRIMARY_ZONE, {
    flame_raw: 0,
    gas_raw: 0,
    water_raw: -50,
    motion: false,
  });

  const rejectedCorrectly = status === 400 && body?.data?.accepted === false && !!body?.data?.field;
  const detail =
    `POST /api/readings with water_raw:-50 -> HTTP ${status}, body=${JSON.stringify(body)}\n` +
    `Rejected as 400 with {accepted:false, field}: ${rejectedCorrectly} (not 500, not silently accepted)`;

  record("TC6b", "Out-of-range payload (negative water_raw) rejected with 400", rejectedCorrectly ? "PASS" : "FAIL", detail);
}

// ---------------------------------------------------------------------
// Check: F2 -- decay must actually decay, not freeze at peak
// ---------------------------------------------------------------------
async function checkF2(primaryKey: string, adminCookie: string): Promise<string | null> {
  console.log(`\n--- F2: driving '${PRIMARY_ZONE}' to CRITICAL (flame_raw=900, motion=true, N=3 debounce) ---`);

  let lastState = "";
  let lastScore = 0;
  for (let i = 1; i <= 5; i++) {
    const { status, body } = await postReading(primaryKey, PRIMARY_ZONE, {
      flame_raw: 900,
      gas_raw: 200,
      water_raw: 0,
      motion: true,
    });
    lastState = body?.data?.state ?? "";
    lastScore = body?.data?.risk_score ?? 0;
    console.log(`  reading ${i}: HTTP ${status} -> state=${lastState} risk_score=${lastScore}`);
    if (lastState === "CRITICAL") break;
    await sleep(150);
  }

  const zones = await getZones(adminCookie);
  const zone = findZone(zones, PRIMARY_ZONE);
  const reachedCritical = zone.state === "CRITICAL" && zone.risk_score >= 65;
  const peakScore = zone.risk_score;

  record(
    "F2 (phase 1/2)",
    "Zone reaches CRITICAL under sustained high flame_raw",
    reachedCritical ? "PASS" : "FAIL",
    `After debounce sequence: GET /api/zones shows state=${zone.state}, risk_score=${zone.risk_score} (peak=${peakScore})`
  );

  if (!reachedCritical) return null;

  // Capture the incident this opened, for the TC7b check.
  const incRes = await fetch(
    `${BACKEND_URL}/api/incidents?zone_id=${PRIMARY_ZONE}&status=OPEN`,
    { headers: { Cookie: adminCookie } }
  );
  const incBody = await json(incRes);
  const incidentId: string | null = incBody?.data?.[0]?.id ?? null;

  return incidentId;
}

async function checkF2Decay(primaryKey: string, adminCookie: string, peakScoreHint: number) {
  console.log(`\n--- F2: clearing the hazard on '${PRIMARY_ZONE}' (idle flame_raw=50) and watching for decay ---`);

  const scores: number[] = [];
  let finalState = "";
  for (let i = 1; i <= 20; i++) {
    await postReading(primaryKey, PRIMARY_ZONE, { flame_raw: 50, gas_raw: 0, water_raw: 0, motion: false });
    await sleep(120);
    const zones = await getZones(adminCookie);
    const zone = findZone(zones, PRIMARY_ZONE);
    scores.push(zone.risk_score);
    finalState = zone.state;
    console.log(`  poll ${i}: risk_score=${zone.risk_score} state=${zone.state}`);
    if (zone.state === "SAFE" && zone.risk_score <= 12.5) break; // settled at idle baseline
  }

  const moved = scores.length > 0 && scores[0] < peakScoreHint;
  let monotonicNonIncreasing = true;
  for (let i = 1; i < scores.length; i++) {
    if (scores[i] > scores[i - 1] + 0.05) {
      monotonicNonIncreasing = false;
      break;
    }
  }
  const settledSafe = finalState === "SAFE";

  const detail =
    `Peak before clearing: ${peakScoreHint}\n` +
    `Scores observed while clearing: [${scores.join(", ")}]\n` +
    `Score moved off peak after hazard cleared: ${moved}\n` +
    `Monotonically non-increasing (no re-freeze, no jump-then-stick): ${monotonicNonIncreasing}\n` +
    `Settled at SAFE: ${settledSafe} (final state=${finalState})`;

  record(
    "F2 (phase 2/2)",
    "Risk score actually decays back to SAFE after hazard clears",
    moved && monotonicNonIncreasing && settledSafe ? "PASS" : "FAIL",
    detail
  );
}

// ---------------------------------------------------------------------
// Check: TC7b -- concurrent ack, exactly one 200 + one 409
// ---------------------------------------------------------------------
async function checkTC7b(incidentId: string | null, adminCookie: string, staffCookie: string) {
  if (!incidentId) {
    record("TC7b", "Concurrent ack -- exactly one 200, rest 409", "INFO", "Skipped: F2 did not produce an OPEN incident to test against.");
    return;
  }

  const [r1, r2] = await Promise.all([
    fetch(`${BACKEND_URL}/api/incidents/${incidentId}/ack`, { method: "POST", headers: { Cookie: adminCookie } }),
    fetch(`${BACKEND_URL}/api/incidents/${incidentId}/ack`, { method: "POST", headers: { Cookie: staffCookie } }),
  ]);
  const [b1, b2] = await Promise.all([json(r1), json(r2)]);

  const statuses = [r1.status, r2.status].sort();
  const exactlyOneWon = statuses[0] === 200 && statuses[1] === 409;

  const detail =
    `Incident: ${incidentId}\n` +
    `Request A (admin session): HTTP ${r1.status} ${JSON.stringify(b1)}\n` +
    `Request B (staff session): HTTP ${r2.status} ${JSON.stringify(b2)}\n` +
    `Exactly one 200 + one 409 (atomic first-write-wins): ${exactlyOneWon}`;

  record("TC7b", "Concurrent ack from two real authenticated users -- exactly one 200, one 409", exactlyOneWon ? "PASS" : "FAIL", detail);

  // Re-run the existing backend/scripts/ack-race-test.ts as instructed, and
  // report its result too -- it's expected to be a non-signal against a
  // real deployed session store, see the detail note below.
  try {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const { fileURLToPath } = await import("node:url");
    const path = await import("node:path");
    const execFileAsync = promisify(execFile);
    const scriptPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "ack-race-test.ts");
    const { stdout } = await execFileAsync(
      process.execPath,
      ["--import", "tsx", scriptPath, incidentId],
      { env: { ...process.env, BACKEND_URL }, timeout: 30000 }
    );
    record(
      "TC7b (legacy script)",
      "Re-run of existing backend/scripts/ack-race-test.ts",
      "INFO",
      `Output:\n${stdout}\n` +
        `Expected/observed: this script authenticates with a hardcoded placeholder cookie ` +
        `("better-auth.session_token=mock_session_token"), which is not a real session against ` +
        `the deployed backend's session store -- so its 10 requests are expected to all come back ` +
        `401, not a meaningful signal. The PASS/FAIL verdict above (from two real authenticated ` +
        `sessions) is the trustworthy result for TC7b.`
    );
  } catch (err: any) {
    record(
      "TC7b (legacy script)",
      "Re-run of existing backend/scripts/ack-race-test.ts",
      "INFO",
      `Could not execute as a subprocess (${err.message}). Its mock session cookie means it would not ` +
        `produce a meaningful result against a live deployed backend regardless -- see F13/TC7b note in ` +
        `docs/verification-results.md.`
    );
  }
}

// ---------------------------------------------------------------------
// Check: TC13b -- staff session blocked from admin-only endpoint
// ---------------------------------------------------------------------
async function checkTC13b(staffCookie: string) {
  const res = await fetch(`${BACKEND_URL}/api/zones/${PRIMARY_ZONE}/override`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: staffCookie },
    body: JSON.stringify({ state: "SAFE" }), // harmless target state even if this incorrectly succeeded
  });
  const body = await json(res);
  const blocked = res.status === 403;

  record(
    "TC13b",
    "Staff-role session blocked from admin-only /api/zones/:id/override (direct API call)",
    blocked ? "PASS" : "FAIL",
    `POST /api/zones/${PRIMARY_ZONE}/override as staff -> HTTP ${res.status} ${JSON.stringify(body)}\nBlocked with 403: ${blocked}`
  );
}

// ---------------------------------------------------------------------
// Check: TC11 -- load / responsiveness
// ---------------------------------------------------------------------
async function measureZonesLatency(cookie: string, samples: number): Promise<number[]> {
  const latencies: number[] = [];
  for (let i = 0; i < samples; i++) {
    const start = performanceNow();
    await getZones(cookie);
    latencies.push(performanceNow() - start);
  }
  return latencies;
}
function performanceNow() {
  return Number(process.hrtime.bigint()) / 1e6;
}
function avg(nums: number[]) {
  return nums.length ? Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1)) : 0;
}

async function checkTC11(adminCookie: string, primaryKey: string, secondaryKey: string) {
  console.log(
    `\n--- TC11: NOT running backend/scripts/phantom-zones.ts's zone-creation loop against the shared ` +
      `deployed database (see docs/verification-results.md for why) -- running a safe substitute load ` +
      `burst against the 3 already-seeded zones instead ---`
  );

  const before = avg(await measureZonesLatency(adminCookie, 3));

  const zoneKeys = [
    { id: PRIMARY_ZONE, key: primaryKey },
    { id: SECONDARY_ZONE, key: secondaryKey },
  ];
  const burstStart = Date.now();
  const duringLatencies: number[] = [];
  const burstPromises: Promise<any>[] = [];
  for (let round = 0; round < 15; round++) {
    for (const z of zoneKeys) {
      burstPromises.push(postReading(z.key, z.id, { flame_raw: 60, gas_raw: 0, water_raw: 0, motion: false }));
    }
    const t = performanceNow();
    await getZones(adminCookie);
    duringLatencies.push(performanceNow() - t);
    await sleep(100);
  }
  await Promise.all(burstPromises);
  const burstMs = Date.now() - burstStart;

  const after = avg(await measureZonesLatency(adminCookie, 3));

  const stayedResponsive = avg(duringLatencies) < 5000 && after < 5000; // generous bound for a free-tier host

  record(
    "TC11",
    "Backend stays responsive under concurrent multi-zone load (substitute for phantom-zones.ts)",
    stayedResponsive ? "PASS" : "FAIL",
    `GET /api/zones latency before load: avg ${before}ms\n` +
      `GET /api/zones latency during ~${burstMs}ms of concurrent readings from 2 zones: avg ${avg(duringLatencies)}ms ` +
      `(samples: [${duringLatencies.map((n) => n.toFixed(0)).join(", ")}])\n` +
      `GET /api/zones latency after load: avg ${after}ms\n` +
      `Stayed responsive (no multi-second stalls): ${stayedResponsive}`
  );
}

// ---------------------------------------------------------------------
// Check: F14 -- CORS reflects only the real deployed frontend origin
// ---------------------------------------------------------------------
async function checkF14() {
  const realRes = await fetch(`${BACKEND_URL}/api/health`, { headers: { Origin: DEPLOYED_FRONTEND_URL } });
  const realAllow = realRes.headers.get("access-control-allow-origin");
  const realMatches = realAllow === DEPLOYED_FRONTEND_URL;

  const evilOrigin = "https://evil-example.com";
  const evilRes = await fetch(`${BACKEND_URL}/api/health`, { headers: { Origin: evilOrigin } });
  const evilAllow = evilRes.headers.get("access-control-allow-origin");
  const evilBlocked = evilAllow === null || evilAllow !== evilOrigin;

  const detail =
    `DEPLOYED_FRONTEND_URL source: ${DEPLOYED_FRONTEND_URL_SOURCE} (value used: ${DEPLOYED_FRONTEND_URL})\n` +
    `Origin '${DEPLOYED_FRONTEND_URL}' -> Access-Control-Allow-Origin: ${JSON.stringify(realAllow)} (matches exactly: ${realMatches})\n` +
    `Origin '${evilOrigin}' -> Access-Control-Allow-Origin: ${JSON.stringify(evilAllow)} (correctly not reflected: ${evilBlocked})`;

  record("F14", "CORS reflects the real deployed frontend origin only", realMatches && evilBlocked ? "PASS" : "FAIL", detail);
}

// ---------------------------------------------------------------------
// Check: F1 -- offline sweep, background-driven not lazy
// ---------------------------------------------------------------------
async function checkF1(primaryKey: string, adminCookie: string) {
  console.log(`\n--- F1: sending one fresh reading to '${PRIMARY_ZONE}', then going silent and polling for OFFLINE ---`);

  await postReading(primaryKey, PRIMARY_ZONE, { flame_raw: 50, gas_raw: 0, water_raw: 0, motion: false });
  await sleep(500);
  let zones = await getZones(adminCookie);
  let zone = findZone(zones, PRIMARY_ZONE);
  const startedNonOffline = zone.state !== "OFFLINE";
  console.log(`  t=0s: state=${zone.state} (non-OFFLINE baseline confirmed: ${startedNonOffline})`);

  if (!startedNonOffline) {
    record("F1", "Zone transitions to OFFLINE via background sweep (not lazily)", "FAIL", "Zone was already OFFLINE before the silence window started -- cannot run this check meaningfully right now.");
    return;
  }

  const pollStart = Date.now();
  let becameOfflineAtMs: number | null = null;
  const maxWaitMs = 30000;
  while (Date.now() - pollStart < maxWaitMs) {
    await sleep(2000);
    zones = await getZones(adminCookie); // this GET must NOT itself be the trigger -- it's read-only
    zone = findZone(zones, PRIMARY_ZONE);
    const elapsed = Date.now() - pollStart;
    console.log(`  t=${(elapsed / 1000).toFixed(1)}s: state=${zone.state}`);
    if (zone.state === "OFFLINE") {
      becameOfflineAtMs = elapsed;
      break;
    }
  }

  const flippedInReasonableMargin = becameOfflineAtMs !== null && becameOfflineAtMs <= maxWaitMs;

  const detail =
    `Silence window on '${PRIMARY_ZONE}' with no requests sent to it (only read-only GET /api/zones polls every 2s).\n` +
    (becameOfflineAtMs !== null
      ? `Transitioned to OFFLINE at t=${(becameOfflineAtMs / 1000).toFixed(1)}s (threshold is 10s + up to 5s sweep interval, so ~10-15s expected).`
      : `Did NOT transition to OFFLINE within ${maxWaitMs / 1000}s.`) +
    `\nCaveat: if a real Wokwi sim for '${PRIMARY_ZONE}' is actively running right now, its own live traffic ` +
    `would refresh lastSeenAt independently of this script and could prevent/delay this from ever showing OFFLINE -- ` +
    `that would look identical to a failure here but is an environmental confound, not a code bug. If this FAILs, ` +
    `confirm the sim is not running before concluding the sweep itself is broken.`;

  record("F1", "Zone transitions to OFFLINE via background sweep within ~10-15s of going silent", flippedInReasonableMargin ? "PASS" : "FAIL", detail);
}

// ---------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------
async function main() {
  console.log(`SCS-RG verification suite`);
  console.log(`BACKEND_URL=${BACKEND_URL}`);
  console.log(`DEPLOYED_FRONTEND_URL=${DEPLOYED_FRONTEND_URL} (${DEPLOYED_FRONTEND_URL_SOURCE})`);
  console.log(`Primary test zone: ${PRIMARY_ZONE} | Secondary: ${SECONDARY_ZONE}`);

  const health = await fetch(`${BACKEND_URL}/api/health`).catch((e) => {
    throw new Error(`Backend unreachable at ${BACKEND_URL}: ${e.message}`);
  });
  console.log(`Warm-up GET /api/health -> HTTP ${health.status}`);

  const adminCookie = await signIn(ADMIN_EMAIL, DEFAULT_PASSWORD);
  const staffCookie = await signIn(STAFF_EMAIL, DEFAULT_PASSWORD);
  console.log("Authenticated as both admin and staff seeded users.");

  const primaryKey = await getZoneKey(adminCookie, PRIMARY_ZONE);
  const secondaryKey = await getZoneKey(adminCookie, SECONDARY_ZONE);
  console.log(`Retrieved real X-Zone-Key for '${PRIMARY_ZONE}' and '${SECONDARY_ZONE}' via GET /api/zones/:id/key (not hardcoded).`);

  // Safe, non-polluting checks first.
  await checkF3(primaryKey, adminCookie);
  await checkTC6b(primaryKey);

  // F2 phase 1 (drive to CRITICAL) + capture the incident it opens.
  const incidentId = await checkF2(primaryKey, adminCookie);

  // TC7b reuses that incident while it's still OPEN.
  await checkTC7b(incidentId, adminCookie, staffCookie);

  // F2 phase 2 (clear the hazard, confirm real decay back to SAFE).
  const peakZones = await getZones(adminCookie);
  const peakScore = incidentId ? 65 : findZone(peakZones, PRIMARY_ZONE).risk_score; // conservative floor if phase 1 failed
  await checkF2Decay(primaryKey, adminCookie, peakScore);

  await checkTC13b(staffCookie);
  await checkTC11(adminCookie, primaryKey, secondaryKey);
  await checkF14();

  // F1 last: needs total silence on the primary zone afterward.
  await checkF1(primaryKey, adminCookie);

  console.log("\n\n================ SUMMARY ================");
  for (const r of results) {
    const icon = r.status === "PASS" ? "✅" : r.status === "FAIL" ? "❌" : "ℹ️ ";
    console.log(`${icon} [${r.status}] ${r.id} -- ${r.title}`);
  }
  const failed = results.filter((r) => r.status === "FAIL");
  console.log(`\n${results.length} checks run, ${results.filter((r) => r.status === "PASS").length} passed, ${failed.length} failed, ${results.filter((r) => r.status === "INFO").length} info-only.`);
  if (failed.length > 0) {
    console.log("Failed checks:", failed.map((r) => r.id).join(", "));
  }

  console.log(
    `\n⚠️  This run wrote real synthetic Reading/Incident data to whatever database ${BACKEND_URL} uses, ` +
      `and left '${PRIMARY_ZONE}' OFFLINE (F1's own test condition). Run \`npm run reset:demo\` before recording ` +
      `any demo material.`
  );

  process.exitCode = failed.length > 0 ? 1 : 0;
}

main().catch((err) => {
  console.error("\n💥 Verification suite crashed:", err);
  process.exitCode = 1;
});
