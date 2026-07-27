// Test Case 11: Scalability & Load Handling
// Creates N phantom zones with real DB-backed API keys, fires concurrent
// readings from them (plus your real zones) for a set duration, measures
// GET /api/zones latency before/during/after, then deletes everything it
// created. Safe to run against the shared DB -- cleans up after itself
// even if the test fails partway through.
//
// Usage:
//   BACKEND_URL=https://robofusion-techathon-teamclover.onrender.com \
//   SESSION_COOKIE="better-auth.session_token=..." \
//   PHANTOM_COUNT=20 DURATION_SECONDS=30 \
//   npx tsx scripts/load-test.ts
//
// SESSION_COOKIE is optional -- without it, GET /api/zones latency checks
// are skipped and only /api/health (public) is measured instead. To get
// a session cookie: log in via POST /api/auth/sign-in/email in Thunder
// Client, then copy the cookie value from Thunder Client's Cookies tab.

import "dotenv/config";
import { prisma } from "../src/app/config/prisma.js";
import { randomBytes } from "node:crypto";

const BACKEND_URL =
  process.env.BACKEND_URL ||
  "https://robofusion-techathon-teamclover.onrender.com";
const PHANTOM_COUNT = Number(process.env.PHANTOM_COUNT) || 20;
const DURATION_SECONDS = Number(process.env.DURATION_SECONDS) || 30;
const INTERVAL_MS = 1000;
const SESSION_COOKIE = process.env.SESSION_COOKIE || "";

type ZoneCred = { zoneId: string; apiKey: string; seq: number };

async function createPhantomZones(count: number): Promise<ZoneCred[]> {
  const zones: ZoneCred[] = [];
  for (let i = 1; i <= count; i++) {
    const zoneId = `phantom-${String(i).padStart(3, "0")}`;
    const apiKey = randomBytes(16).toString("hex");
    await prisma.zone.create({
      data: {
        id: zoneId,
        name: `Phantom zone ${i}`,
        apiKey,
        hazardProfile: "load-test-synthetic",
        archived: false,
      },
    });
    zones.push({ zoneId, apiKey, seq: 0 });
  }
  return zones;
}

async function loadRealZones(): Promise<ZoneCred[]> {
  const real = await prisma.zone.findMany({
    where: { archived: false, id: { not: { startsWith: "phantom-" } } },
  });
  // High starting seq so this never collides with a live sim's own
  // counter for the same zone.
  return real.map((z) => ({ zoneId: z.id, apiKey: z.apiKey, seq: 500000 }));
}

async function sendReading(z: ZoneCred): Promise<number> {
  const start = Date.now();
  z.seq += 1;
  await fetch(`${BACKEND_URL}/api/readings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Zone-Key": z.apiKey },
    body: JSON.stringify({
      zone_id: z.zoneId,
      seq: z.seq,
      timestamp_ms: Date.now(),
      // Deliberately safe/idle values -- this test is about throughput
      // and responsiveness, not about triggering incidents. Keeping
      // every phantom zone SAFE means no Incident rows get created,
      // which keeps cleanup simple (readings only, no FK chain through
      // incidents).
      sensors: { flame_raw: 50, gas_raw: 50, water_raw: 20, motion: false },
      sensor_health: { flame: "ok", gas: "ok", water: "ok", motion: "ok" },
    }),
  });
  return Date.now() - start;
}

async function measureResponsiveness(): Promise<number> {
  const start = Date.now();
  if (SESSION_COOKIE) {
    await fetch(`${BACKEND_URL}/api/zones`, {
      headers: { Cookie: SESSION_COOKIE },
    });
  } else {
    await fetch(`${BACKEND_URL}/api/health`);
  }
  return Date.now() - start;
}

function avg(arr: number[]) {
  return arr.length
    ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
    : 0;
}
function max(arr: number[]) {
  return arr.length ? Math.max(...arr) : 0;
}

async function main() {
  console.log(`Creating ${PHANTOM_COUNT} phantom zones...`);
  const phantoms = await createPhantomZones(PHANTOM_COUNT);
  const real = await loadRealZones();
  const allZones = [...real, ...phantoms];

  console.log(
    `Load test: ${allZones.length} total zones (${real.length} real + ` +
      `${phantoms.length} phantom), ${DURATION_SECONDS}s @ ${INTERVAL_MS}ms interval`,
  );
  console.log(
    SESSION_COOKIE
      ? "Measuring GET /api/zones latency (session provided)"
      : "No SESSION_COOKIE set -- measuring GET /api/health instead",
  );

  try {
    const beforeLatency = await measureResponsiveness();
    console.log(`Responsiveness BEFORE load: ${beforeLatency}ms`);

    const readingLatencies: number[] = [];
    const duringLatencies: number[] = [];
    let failures = 0;
    const ticks = Math.floor((DURATION_SECONDS * 1000) / INTERVAL_MS);

    for (let t = 0; t < ticks; t++) {
      const tickStart = Date.now();
      const results = await Promise.allSettled(allZones.map(sendReading));
      for (const r of results) {
        if (r.status === "fulfilled") readingLatencies.push(r.value);
        else failures++;
      }
      if (t % 5 === 0) duringLatencies.push(await measureResponsiveness());
      const elapsed = Date.now() - tickStart;
      if (elapsed < INTERVAL_MS)
        await new Promise((res) => setTimeout(res, INTERVAL_MS - elapsed));
    }

    const afterLatency = await measureResponsiveness();

    console.log("\n--- Results ---");
    console.log(
      `Total reading requests sent: ${readingLatencies.length + failures}`,
    );
    console.log(`Failed: ${failures}`);
    console.log(
      `Reading POST latency: avg ${avg(readingLatencies)}ms, max ${max(readingLatencies)}ms`,
    );
    console.log(
      `Responsiveness DURING load: avg ${avg(duringLatencies)}ms, max ${max(duringLatencies)}ms`,
    );
    console.log(`Responsiveness AFTER load: ${afterLatency}ms`);
    console.log(
      failures === 0
        ? "PASS: no failed requests under load"
        : `CHECK: ${failures} requests failed`,
    );
  } finally {
    console.log("\nCleaning up phantom zones...");
    const phantomIds = phantoms.map((p) => p.zoneId);
    await prisma.reading.deleteMany({ where: { zoneId: { in: phantomIds } } });
    await prisma.zone.deleteMany({ where: { id: { in: phantomIds } } });
    console.log("Done -- phantom zones and their readings removed.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
