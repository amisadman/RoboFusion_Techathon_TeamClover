// Browser-triggerable version of the load test. Visit this URL directly
// (with the secret query param) and the response IS the final stats --
// no terminal needed.
//
// SECURITY: gated behind LOAD_TEST_SECRET because this route creates and
// deletes real database rows on every hit, and your repo (containing
// this file) is about to be public. Set LOAD_TEST_SECRET as an env var
// on Render before deploying this. After you're done recording, either
// remove this route entirely or at minimum rotate/remove the secret --
// this is a testing convenience, not part of the graded system, and it
// has no reason to stay live in the final submission.
//
// Mounted in backend/src/app/app.ts alongside the other routers, at the
// same "/api" prefix they all use -- so this resolves to /api/load-test,
// not /api/test/load-test.
//
// Then visit, once deployed:
//   https://robofusion-techathon-teamclover.onrender.com/api/load-test?secret=YOUR_SECRET
//
// Optional query params (both capped server-side so this can't be made
// to hang the free-tier instance by accident or by a stranger):
//   zones=20      (default 15, capped at 30)
//   duration=20   (seconds, default 20, capped at 60)

import { Router } from "express";
import { prisma } from "./app/config/prisma.js";
import { randomBytes } from "node:crypto";

const router = Router();

type ZoneCred = { zoneId: string; apiKey: string; seq: number };

router.get("/load-test", async (req, res) => {
  const secret = req.query.secret;
  if (!secret || secret !== process.env.LOAD_TEST_SECRET) {
    return res.status(403).json({ error: "forbidden", detail: "missing or incorrect secret" });
  }

  const phantomCount = Math.min(Number(req.query.zones) || 15, 30);
  const durationSeconds = Math.min(Number(req.query.duration) || 20, 60);
  const intervalMs = 1000;
  const baseUrl = `${req.protocol}://${req.get("host")}`;

  const phantoms: ZoneCred[] = [];

  try {
    for (let i = 1; i <= phantomCount; i++) {
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
      phantoms.push({ zoneId, apiKey, seq: 0 });
    }

    const real = await prisma.zone.findMany({
      where: { archived: false, id: { not: { startsWith: "phantom-" } } },
    });
    const realCreds: ZoneCred[] = real.map((z) => ({
      zoneId: z.id,
      apiKey: z.apiKey,
      seq: 500000,
    }));
    const allZones = [...realCreds, ...phantoms];

    async function sendReading(z: ZoneCred): Promise<number> {
      const start = Date.now();
      z.seq += 1;
      await fetch(`${baseUrl}/api/readings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Zone-Key": z.apiKey },
        body: JSON.stringify({
          zone_id: z.zoneId,
          seq: z.seq,
          timestamp_ms: Date.now(),
          sensors: { flame_raw: 50, gas_raw: 50, water_raw: 20, motion: false },
          sensor_health: { flame: "ok", gas: "ok", water: "ok", motion: "ok" },
        }),
      });
      return Date.now() - start;
    }

    const latencies: number[] = [];
    let failures = 0;
    const ticks = Math.floor((durationSeconds * 1000) / intervalMs);

    for (let t = 0; t < ticks; t++) {
      const tickStart = Date.now();
      const results = await Promise.allSettled(allZones.map(sendReading));
      for (const r of results) {
        if (r.status === "fulfilled") latencies.push(r.value);
        else failures++;
      }
      const elapsed = Date.now() - tickStart;
      if (elapsed < intervalMs) await new Promise((r) => setTimeout(r, intervalMs - elapsed));
    }

    const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);
    const max = (arr: number[]) => (arr.length ? Math.max(...arr) : 0);

    res.json({
      success: true,
      totalZones: allZones.length,
      realZones: realCreds.length,
      phantomZones: phantoms.length,
      durationSeconds,
      totalRequests: latencies.length + failures,
      failed: failures,
      avgLatencyMs: avg(latencies),
      maxLatencyMs: max(latencies),
      result: failures === 0 ? "PASS: no failed requests under load" : `CHECK: ${failures} requests failed`,
    });
  } finally {
    // Cleanup happens even if something above threw -- phantom zones and
    // their readings never persist past this single request.
    const ids = phantoms.map((p) => p.zoneId);
    if (ids.length) {
      await prisma.reading.deleteMany({ where: { zoneId: { in: ids } } });
      await prisma.zone.deleteMany({ where: { id: { in: ids } } });
    }
  }
});

export default router;
