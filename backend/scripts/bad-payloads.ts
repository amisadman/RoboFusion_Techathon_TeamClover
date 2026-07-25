import http from "http";

const BASE_URL = process.env.BACKEND_URL || "http://localhost:4000";

async function runBadPayloadTests() {
  console.log("🧪 Running Test Case 6b / 23f: Bad Payloads & Input Validation Test\n");

  const testCases = [
    {
      name: "Missing X-Zone-Key Header",
      header: {},
      body: { zone_id: "iot_lab", seq: 1, timestamp_ms: Date.now(), sensors: { flame_raw: 0, gas_raw: 0, water_raw: 0, motion: false }, sensor_health: { flame: "ok", gas: "ok", water: "ok", motion: "ok" } },
      expectedStatus: 401,
    },
    {
      name: "Invalid / Unregistered X-Zone-Key",
      header: { "X-Zone-Key": "invalid_key_999" },
      body: { zone_id: "iot_lab", seq: 1, timestamp_ms: Date.now(), sensors: { flame_raw: 0, gas_raw: 0, water_raw: 0, motion: false }, sensor_health: { flame: "ok", gas: "ok", water: "ok", motion: "ok" } },
      expectedStatus: 401,
    },
    {
      name: "Negative Sensor Value (water_raw < 0)",
      header: { "X-Zone-Key": "key_iot_lab_123" },
      body: { zone_id: "iot_lab", seq: 1, timestamp_ms: Date.now(), sensors: { flame_raw: 0, gas_raw: 0, water_raw: -50, motion: false }, sensor_health: { flame: "ok", gas: "ok", water: "ok", motion: "ok" } },
      expectedStatus: 400,
    },
    {
      name: "Missing Sensor Payload Object",
      header: { "X-Zone-Key": "key_iot_lab_123" },
      body: { zone_id: "iot_lab", seq: 1, timestamp_ms: Date.now() },
      expectedStatus: 400,
    },
  ];

  for (const tc of testCases) {
    try {
      const response = await fetch(`${BASE_URL}/api/readings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...tc.header,
        },
        body: JSON.stringify(tc.body),
      });

      const data = await response.json();
      const status = response.status;

      if (status === tc.expectedStatus) {
        console.log(`✅ [PASSED] ${tc.name} -> HTTP ${status} (Rejected as expected)`);
      } else {
        console.log(`❌ [FAILED] ${tc.name} -> Got HTTP ${status}, Expected ${tc.expectedStatus}`);
      }
    } catch (err: any) {
      console.log(`⚠️ Server error / un-reachable for ${tc.name}: ${err.message}`);
    }
  }
}

runBadPayloadTests();
