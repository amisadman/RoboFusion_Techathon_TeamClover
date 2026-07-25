// Resets the shared database (and, if BACKEND_URL is reachable, the live
// running backend's in-memory zone state) to a clean, demo-ready
// baseline. Run this before recording any demo material -- verification
// passes like backend/scripts/verify-fixes.ts write real synthetic
// Reading/Incident rows and can leave a zone's live displayed state
// (e.g. OFFLINE, CRITICAL) in a non-baseline condition.
//
// What this does:
//   1. Deletes all Incident rows (IncidentTransition rows cascade-delete
//      with them -- see prisma/schema.prisma's onDelete: Cascade).
//   2. Deletes all Reading rows.
//   3. Clears Zone.lastSeenAt for every zone.
//   4. POSTs one clean, idle/SAFE reading to each real zone via the
//      running backend's public API, using each zone's real key straight
//      from the DB. This is the part that actually fixes what a human
//      would SEE on the live dashboard immediately after this script
//      runs -- steps 1-3 alone only clean the database; the backend
//      process's in-memory zoneCache is a separate memory space that a
//      DB-only reset can't touch, and won't self-correct until either a
//      fresh reading arrives (this step) or the backend process restarts.
//
// This is a FULL wipe of Reading/Incident history, not a selective
// undo of what any one script wrote -- there is no reliable way to tell
// "synthetic test data" apart from real historical data after the fact,
// so if you need to keep real incident history, do not run this.
//
// Usage: npm run reset:demo
//        BACKEND_URL=https://... npm run reset:demo   (to also live-reset a specific backend)

import { prisma } from "../src/app/config/prisma.js";

const BACKEND_URL = process.env.BACKEND_URL || "https://robofusion-techathon-teamclover.onrender.com";

async function resetDatabase() {
  console.log("Resetting database to a clean demo baseline...\n");

  const incidentCount = await prisma.incident.count();
  const readingCount = await prisma.reading.count();
  console.log(`Found ${incidentCount} Incident rows and ${readingCount} Reading rows to remove.`);

  const deletedIncidents = await prisma.incident.deleteMany({});
  console.log(`Deleted ${deletedIncidents.count} Incident rows (IncidentTransition rows cascaded automatically).`);

  const deletedReadings = await prisma.reading.deleteMany({});
  console.log(`Deleted ${deletedReadings.count} Reading rows.`);

  const zones = await prisma.zone.findMany({ where: { archived: false } });
  await prisma.zone.updateMany({ data: { lastSeenAt: null } });
  console.log(`Cleared lastSeenAt on ${zones.length} zones.`);

  return zones;
}

async function resetLiveBackend(zones: Array<{ id: string; apiKey: string }>) {
  console.log(`\nAttempting to reset live in-memory state on ${BACKEND_URL} ...`);

  const health = await fetch(`${BACKEND_URL}/api/health`).catch(() => null);
  if (!health || !health.ok) {
    console.log(
      `  Backend at ${BACKEND_URL} is not reachable right now -- skipping the live reset step. ` +
        `The database is clean, but that backend's in-memory zone state (if it's a different, ` +
        `currently-running process) will only catch up once real sensor readings arrive or the ` +
        `process restarts.`
    );
    return;
  }

  for (const zone of zones) {
    const res = await fetch(`${BACKEND_URL}/api/readings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Zone-Key": zone.apiKey },
      body: JSON.stringify({
        zone_id: zone.id,
        seq: Math.floor(Date.now() / 1000),
        timestamp_ms: Date.now(),
        sensors: { flame_raw: 0, gas_raw: 0, water_raw: 0, motion: false },
        sensor_health: { flame: "ok", gas: "ok", water: "ok", motion: "ok" },
      }),
    });
    const body = await res.json().catch(() => ({}));
    console.log(`  ${zone.id}: HTTP ${res.status} -> state=${(body as any)?.data?.state ?? "?"}`);
  }

  console.log(
    "\nNote: this only resets whatever backend BACKEND_URL points at. If your Wokwi sims are " +
      "also running and posting real readings, their next reading will overwrite this baseline " +
      "within one reporting cycle, which is expected."
  );
}

async function main() {
  const zones = await resetDatabase();
  await resetLiveBackend(zones.map((z) => ({ id: z.id, apiKey: z.apiKey })));
  console.log("\nDone. Database and (if reachable) live backend state are at a clean baseline.");
}

main()
  .catch((err) => {
    console.error("Reset failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
