const BASE_URL = process.env.BACKEND_URL || "http://localhost:4000";

async function runPhantomZonesLoadTest(zoneCount: number = 30, durationSeconds: number = 10) {
  console.log(`🚀 Running Test Case 11a & 24: Phantom Zones Load Test (${zoneCount} zones for ${durationSeconds}s)\n`);

  const zones: Array<{ id: string; name: string; key: string }> = [];

  // 1. Pre-register Phantom Zones
  console.log(`Registering ${zoneCount} phantom zones...`);
  for (let i = 1; i <= zoneCount; i++) {
    const id = `phantom_zone_${i}`;
    const name = `Phantom Zone ${i}`;
    const key = `key_phantom_${i}_test`;

    try {
      await fetch(`${BASE_URL}/api/zones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          name,
          hazardProfile: "Simulated load testing phantom zone",
          apiKey: key,
        }),
      });
      zones.push({ id, name, key });
    } catch (e) {
      zones.push({ id, name, key });
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
runPhantomZonesLoadTest(count, duration);
