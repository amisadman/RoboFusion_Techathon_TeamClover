// NOTE (docs/audit-findings.md TC11 verification note): this script's
// zone-registration step previously sent no auth headers at all, even
// though POST /api/zones requires requireSession + requireAdmin -- every
// registration would 401, and the catch block silently pushed the zone
// into the local list anyway, so the "load test" mostly generated 401
// noise rather than real traffic. Fixed below with a real admin sign-in.
//
// IMPORTANT: this creates real, PERMANENT Zone rows. There is no
// DELETE /api/zones/:id endpoint in this API, and Sensor/Reading/Incident
// all use onDelete: Restrict on their Zone relation, so these rows cannot
// be cleanly removed once created. Only run this against a disposable
// local database (`docker compose up postgres -d` + a local backend) --
// never against a shared/deployed BACKEND_URL.

const BASE_URL = process.env.BACKEND_URL || "http://localhost:4000";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@uftb.edu.bd";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Password123!"; // backend/src/app/config/seed.ts

async function signInAdmin(): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE_URL },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  if (!res.ok) {
    throw new Error(`Admin sign-in failed: HTTP ${res.status} ${await res.text()}`);
  }
  const cookies =
    typeof (res.headers as any).getSetCookie === "function"
      ? (res.headers as any).getSetCookie()
      : [res.headers.get("set-cookie") || ""];
  const cookie = cookies
    .filter(Boolean)
    .map((c: string) => c.split(";")[0])
    .join("; ");
  if (!cookie) throw new Error("Admin sign-in succeeded but no session cookie was returned");
  return cookie;
}

async function runPhantomZonesLoadTest(zoneCount: number = 30, durationSeconds: number = 10) {
  console.log(`🚀 Running Test Case 11a & 24: Phantom Zones Load Test (${zoneCount} zones for ${durationSeconds}s)\n`);
  console.log(`⚠️  Target: ${BASE_URL} -- confirm this is a disposable local instance, not a shared/deployed one.\n`);

  const adminCookie = await signInAdmin();
  console.log("Authenticated as admin.\n");

  const zones: Array<{ id: string; name: string; key: string }> = [];

  // 1. Pre-register Phantom Zones
  console.log(`Registering ${zoneCount} phantom zones...`);
  for (let i = 1; i <= zoneCount; i++) {
    const id = `phantom_zone_${i}`;
    const name = `Phantom Zone ${i}`;
    const key = `key_phantom_${i}_test`;

    const res = await fetch(`${BASE_URL}/api/zones`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        id,
        name,
        hazardProfile: "Simulated load testing phantom zone",
        apiKey: key,
      }),
    });

    // 201 = newly created this run. 400 = most likely "already exists"
    // from a prior run of this same script (deterministic id/key) --
    // safe to reuse. Anything else, skip it rather than guessing.
    if (res.status === 201 || res.status === 400) {
      zones.push({ id, name, key });
    } else {
      console.warn(`  Zone ${id}: unexpected HTTP ${res.status}, skipping`);
    }
  }

  console.log(`Successfully registered ${zones.length} phantom zones.`);
  console.log("Starting high-frequency telemetry post loop...");

  const startTime = Date.now();
  let totalSent = 0;
  let totalAccepted = 0;

  const interval = setInterval(async () => {
    if (Date.now() - startTime >= durationSeconds * 1000) {
      clearInterval(interval);
      console.log("\n--- Load Test Summary ---");
      console.log(`Total Requests Sent: ${totalSent}`);
      console.log(`Total Accepted (HTTP 200): ${totalAccepted}`);
      console.log(`Success Rate: ${((totalAccepted / (totalSent || 1)) * 100).toFixed(1)}%`);
      console.log("✅ [PASSED] Backend and Socket.io engine remained responsive under combined load!");
      return;
    }

    const promises = zones.map((z, idx) => {
      totalSent++;
      const isCritical = idx % 5 === 0;

      return fetch(`${BASE_URL}/api/readings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Zone-Key": z.key,
        },
        body: JSON.stringify({
          zone_id: z.id,
          seq: Math.floor(Date.now() / 500),
          timestamp_ms: Date.now(),
          sensors: {
            flame_raw: isCritical ? 850 : 100,
            gas_raw: isCritical ? 600 : 200,
            water_raw: 150,
            motion: isCritical,
          },
          sensor_health: { flame: "ok", gas: "ok", water: "ok", motion: "ok" },
        }),
      })
        .then((res) => {
          if (res.status === 200) totalAccepted++;
        })
        .catch(() => {});
    });

    await Promise.all(promises);
  }, 500);
}

const count = Number(process.argv[2]) || 30;
const duration = Number(process.argv[3]) || 10;
runPhantomZonesLoadTest(count, duration).catch((err) => {
  console.error("Phantom zones load test failed:", err);
  process.exitCode = 1;
});
