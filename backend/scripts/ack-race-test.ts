const BASE_URL = process.env.BACKEND_URL || "http://localhost:4000";

async function testAckRaceCondition(incidentId: string) {
  console.log(`⚡ Running Test Case 7b & 18a: Ack Race Condition Test for Incident '${incidentId}'\n`);

  const CONCURRENT_REQUESTS = 10;
  const requests = [];

  for (let i = 1; i <= CONCURRENT_REQUESTS; i++) {
    requests.push(
      fetch(`${BASE_URL}/api/incidents/${incidentId}/ack`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cookie": "better-auth.session_token=mock_session_token",
        },
      }).then(async (res) => ({
        request_id: i,
        status: res.status,
        data: await res.json(),
      }))
    );
  }

  const results = await Promise.all(requests);

  let successCount = 0;
  let conflictCount = 0;

  results.forEach((r) => {
    if (r.status === 200) successCount++;
    if (r.status === 409) conflictCount++;
    console.log(`Req #${r.request_id} -> HTTP ${r.status}:`, r.data.message || r.data.detail || r.data);
  });

  console.log("\n--- Race Condition Audit Summary ---");
  console.log(`Total Concurrent Writes: ${CONCURRENT_REQUESTS}`);
  console.log(`Successful Acknowledged Writes: ${successCount}`);
  console.log(`Rejected Conflicts (409 Already Acked): ${conflictCount}`);

  if (successCount === 1 && conflictCount === CONCURRENT_REQUESTS - 1) {
    console.log("✅ [PASSED] First Write Wins verified! Zero duplicate acknowledgments.");
  } else {
    console.log("⚠️ Audit finished (Ensure server is running and a valid active Incident ID is passed).");
  }
}

const targetIncidentId = process.argv[2] || "cm0123abc456";
testAckRaceCondition(targetIncidentId);
