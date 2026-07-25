# SCS-RG Cross-Component Audit Findings

Audit date: 2026 (see repo `git log` for exact commit). Scope: firmware/,
backend/src/, frontend/, prisma/schema.prisma, docs/, scripts/.

Authority order used when docs disagreed (per audit brief Step 0):
`api.md` > `contract.md` > `erd.md` > `risk-formula.md` > `architecture.md`
> `backup-strategy.md`, with actual code as the final tiebreaker for
"is this a live bug" questions (a doc can be stale; running code is what a
test case actually exercises).

---

## Step 1 — Symptom root-cause traces

### Symptom A: "IoT Lab" shows OFFLINE, other two zones show ONLINE

Checked in order, per the brief's checklist:

- **(b) Key mismatch?** No. `backend/prisma/seed.ts` seeds
  `iot_lab` → `key_iot_lab_123`, and
  `firmware/iot_lab/iotlab_sketch.ino` defines
  `ZONE_API_KEY "key_iot_lab_123"`. Exact match, byte for byte. Same check
  passed for `server_room`/`key_server_room_456` and
  `data_science_lab`/`key_data_science_789`. **Ruled out.**
- **(c) zone_id mismatch?** No. `ZONE_ID "iot_lab"` in firmware matches the
  seeded `Zone.id` exactly (case, underscores). **Ruled out.**
- **(a) Is the Wokwi sim actually running?** Cannot verify from code. **Ask
  the human to confirm the `iot_lab` Wokwi sim is open and connected.**
  This is the single most likely explanation given everything else below.
- **(d) Is the >10s offline timeout evaluated on a recurring timer?**
  **No — and this is a confirmed, severe bug independent of what's
  currently causing the symptom.** See **Finding F1**. There is
  currently *no* server-side mechanism that ever transitions a zone to
  `OFFLINE` due to a reporting gap. The only code path that can produce
  `state = "OFFLINE"` at all is `sensor_health.* === "disconnected"`
  arriving *inside* an authenticated reading
  (`readings.service.ts:104-107`) — and per the firmware trace below,
  none of the three sketches can organically produce that value under
  normal simulated operation (see F1 for the full trace). So:
  - If `iot_lab`'s sim is simply not running right now, the zone would
    **not** show OFFLINE from a live signal — it would either show its
    **last known DB/cache state** (if it reported before, e.g. during
    earlier testing, and the backend hasn't restarted since) or default
    to **SAFE** (if the in-memory cache has no entry at all — see
    `getAllZonesState()`, `zones.service.ts:21-26`, which defaults a
    cache-miss to `{state: "SAFE", ...}`, not `OFFLINE`).
  - The most consistent story: `iot_lab` reported `OFFLINE` at some
    point (or was simply never seeded with fresh readings this session),
    that state got persisted, and because the offline-checker is a
    disabled no-op stub, **nothing ever re-evaluates it** — it just sits
    there indefinitely regardless of the sim's actual current state.
- **(e) Does the frontend render a missing/OFFLINE zone correctly?**
  **Yes, this path is clean.** `frontend/lib/status.ts`'s
  `HAZARD_STATE_CONFIG.OFFLINE` has its own dot/icon/label/border
  classes, and every zone the frontend receives (all 3 always come back
  from `GET /api/zones`, since `seedDatabase()` always creates all three
  `Zone` rows) renders through the same `HazardStatusIndicator` — there
  is no "unstyled fallthrough" case. **The bug is entirely backend-side.**

**Conclusion:** Ask the human to confirm the `iot_lab` sim is running.
Independently of that answer, **F1 (disabled offline-checker) is a real
bug that must be fixed** — right now, a zone's displayed state can only
ever be corrected by a *new* reading arriving; a truly-dead zone will
freeze at whatever it last was, forever, which directly contradicts
Appendix A's OFFLINE definition and TC23a.

### Symptom B: two zones frozen at risk_score = 12.0

- **(a) Genuine idle baseline?** **Yes — most likely explanation, and not
  a bug.** `40 * min(1.0, flame_raw/1023) = 12.0` solves to
  `flame_raw ≈ 307`, well under the fire debounce threshold (400) and
  under 40% of max ADC (409), so it's pure ambient noise-floor
  contribution with no other sensor contributing (motion/gas/water all
  at their zeroed idle defaults for these zones — see firmware
  `HAS_GAS`/`HAS_WATER`/`HAS_MOTION` flags, F-note below). Wokwi's
  simulated potentiometer (the flame proxy, per `diagram.json`) holds
  whatever position it was last left at with **zero simulated jitter**
  unless a human drags the slider in the Wokwi UI — so a perfectly
  constant reading, cycle after cycle, is exactly what an untouched sim
  would produce. This matches option (a) from the brief almost exactly:
  **untested, not broken.**
- **(b) Stale firmware variable?** **Ruled out.** All three sketches call
  `analogRead()`/`digitalRead()` fresh inside `send_reading()`, which
  runs every `POST_INTERVAL_MS` (100ms) from `loop()`. No caching in
  firmware.
- **(b) Backend debounce/decay holding a cached value?** **Not the cause
  of this specific symptom** (a truly-constant fresh input converges to
  the same constant output either way — see the two hand-traces in
  **Finding F2**) — **but I found a real, separate, and more serious bug
  in this exact module while checking it: the decay logic can never
  actually decay a *spiked* score back down.** See F2. It doesn't explain
  today's 12.0 reading, but it will matter the moment either sim's flame
  pot gets nudged above threshold and released.
- **(b) Frontend merge race overwriting fresh socket data with stale
  REST data?** **Real bug, confirmed by code trace — see Finding F6.**
  Not the cause of a *frozen-at-12.0* symptom specifically (that would
  cause flicker/regression, not a flatline), but it is exactly the race
  the brief hypothesized, and it's real.

**Conclusion:** Symptom B is very likely genuinely untested idle
baseline, not a bug — recommend touching the flame potentiometer in the
`server_room` or `data_science_lab` Wokwi sim to confirm the number
actually moves. Separately, **F2 (decay never actually decays) is a real
and more dangerous bug** that this investigation surfaced as a side
effect and must be fixed regardless of Symptom B's own resolution.

---

## Findings

Each entry: severity, files, rubric citation, description, proposed fix,
and whether I applied the fix directly.

### F1 — Offline-checker is a disabled no-op stub — zones never time out

**Severity: BREAKS A TEST CASE** (Appendix A OFFLINE definition; TC23a;
contributes to TC9's resilience story)
**Files:** `backend/src/app/utils/offlineChecker.ts` (whole file),
`backend/src/app/server.ts:6,77`

```ts
// offlineChecker.ts — entire implementation:
export function startOfflineCheckerInterval(_intervalMs: number = 5000): NodeJS.Timeout {
  console.log("⏸️ [Offline Checker] Offline checker interval is currently DISABLED for testing.");
  return setTimeout(() => {}, 100000000);
}
```
...and it's not even called — `server.ts` has the import and the call
both commented out.

There is no other code path that periodically re-evaluates zone
liveness. `getAllZonesState()` (`zones.service.ts`) just echoes whatever
is in the in-memory cache, forever, until a new reading overwrites it.

I additionally traced whether firmware could organically trigger the
*other* OFFLINE path (`sensor_health.* === "disconnected"` in
`readings.service.ts:104-107`) and confirmed it structurally cannot
under normal sim operation: `health_str(raw, 0, 4095)` only returns
`"disconnected"` if the raw value is outside `[0,4095]`, which
`analogRead()`/`digitalRead()` can never produce, and the `motion`
health field is hardcoded `"ok"` unconditionally in all three sketches
(never computed at all). So today, **no code path can ever mark a zone
OFFLINE except a value that can't occur.**

**Proposed fix:** Implement a real sweep and re-enable it: every N
seconds, for each zone in the in-memory cache (or DB, for zones with no
cache entry at all), if `now - lastSeenAt > 10_000ms` (or no
`lastSeenAt`/cache entry exists at all past a grace period), set
`state = "OFFLINE"`, broadcast `zone:offline` and `zone:state`, and
recompute the priority queue. Also treat a *complete* cache-miss (zone
seeded but has never once reported) as OFFLINE rather than the current
default of SAFE, since a zone that's never sent a reading is not
"safe" — it's unknown/absent by Appendix A's own definition.

**Applied directly:** Yes — this is a missing implementation of
already-specified, already-typed (`ZoneOfflineEvent`,
`broadcastZoneOffline`) behavior, not a design decision. See "Fixes
applied" below.

---

### F2 — Decay logic is fed the previous (already-held) score, not the fresh one, so it can never actually decay

**Severity: BREAKS A TEST CASE** (TC1 "removal = decay to SAFE"; TC3
"wet-then-cleared = correct reset"; TC5 "recovery to SAFE resets
everything"; TC22 "both recover → system returns to idle")
**Files:** `backend/src/app/utils/debounce.ts:23-60`,
`backend/src/app/modules/readings/readings.service.ts:88-97,232-240`

`readings.service.ts` calls:
```ts
const { debouncedFlame, isWarmUp, finalScore } = processDebounce(
  zone_id, sensors.flame_raw, cache.riskScore   // <-- previous cycle's score, not this cycle's
);
const fusion = calculateRiskFusion(sensors, debouncedFlame, isWarmUp);
const activeScore = Math.max(fusion.riskScore, finalScore);
...
zoneCache[zone_id] = { ..., riskScore: activeScore, ... };  // stored back as next cycle's "cache.riskScore"
```

`processDebounce`'s decay branch:
```ts
if (calculatedScore < state.decayingScore) {
  state.decayingScore = Math.max(calculatedScore, state.decayingScore - 5.0);
  finalScore = state.decayingScore;
} else {
  state.decayingScore = calculatedScore;   // ratchets UP to whatever was just passed in
}
```

Hand-traced with flame present (fresh fusion score 90) for two cycles,
then removed (fresh fusion score drops to 12):

| Cycle | `calculatedScore` passed in (= last cycle's `activeScore`) | `decayingScore` before | branch | `finalScore` | fresh `fusion.riskScore` | `activeScore` stored |
|---|---|---|---|---|---|---|
| 1 (flame high) | 0 | 0 | else | 0 | 90 | **90** |
| 2 (flame high) | 90 | 0 | else | 90 | 90 | **90** |
| 3 (flame removed) | 90 | 90 | else (`90<90` false) | 90 | 12 | **90** |
| 4 (flame removed) | 90 | 90 | else (`90<90` false) | 90 | 12 | **90** |
| ...forever | 90 | 90 | else | 90 | 12 | **90 — never moves** |

Because the value fed into the comparison is always exactly what
`decayingScore` was just set to on the previous call, `calculatedScore <
state.decayingScore` can essentially never be true once the score
plateaus — the decay branch is live code that is practically
unreachable in normal operation. `Math.max(fusion.riskScore, finalScore)`
then always picks the frozen `finalScore`. **A zone that ever spikes to
CRITICAL (or WARNING) will never recover in the UI, even after the
hazard is completely gone**, until/unless the process restarts (which
resets the in-memory `zoneDebounceStore`). `resetDebounceState()` exists
but is never called from anywhere (confirmed via repo-wide grep), so
there is no other escape hatch either.

I re-ran the trace with the fix described below and confirmed it decays
correctly (90 → 85 → 80 → ... → 12, holding once it reaches the fresh
value), matching risk-formula.md's "3–5s linear decay... ~5 points per
reading."

**Proposed fix:** Split `processDebounce` into (1) flame-debounce +
warm-up detection (unchanged, doesn't need a score) and (2) a decay step
that runs *after* `calculateRiskFusion`, fed the **fresh**
`fusion.riskScore` instead of the stale `cache.riskScore`.

**Applied directly:** Yes — this is a data-flow bug (wrong variable fed
into a comparison), not a design decision. See "Fixes applied" below.

---

### F3 — X-Zone-Key is validated against "some zone" but never checked against the zone_id in the request body

**Severity: BREAKS A TEST CASE (security/integrity)** (TC10 "reading from
an unregistered source rejected" — the spirit of this extends to "reading
under a spoofed identity"; also the audit brief's own Step 2 checklist:
"wrong zone's key pasted into another zone's firmware")
**Files:** `backend/src/app/middlewares/zoneAuth.middleware.ts:7-39`,
`backend/src/app/modules/readings/readings.service.ts:60-61`

`validateZoneKey` confirms the header key exists in the `Zone` table and
is not archived, then calls `next()` — it never attaches which zone the
key actually belongs to, and never compares it against
`req.body.zone_id`. `processReading()` then trusts `payload.zone_id`
completely. Concretely: if `server_room`'s key were accidentally flashed
onto the `iot_lab` device (a literal one-line copy-paste error, and
exactly the failure mode the audit brief calls out), the backend would
happily authenticate the request and write/broadcast state under
whichever `zone_id` string the body claims — there's no enforcement that
the two agree.

**Proposed fix:** In `validateZoneKey`, attach the resolved zone id
(`req.zoneId = zone.id`, or similar) after a successful key lookup, and
add a check in `handlePostReading`/`processReading` that
`req.body.zone_id === req.zoneId`, rejecting with 401
`{accepted:false, error:"unauthorized", field:"zone_id", detail:"X-Zone-Key does not match zone_id"}` on mismatch.

**Applied directly:** Yes — this is closing an auth gap, not changing any
documented shape (the 401 rejection shape already exists and is reused
as-is).

---

### F4 — `/api/readings` response envelope: checked and ruled out as a live bug (doc drift only)

**Severity: COSMETIC DOC DRIFT**
**Files:** `docs/contract.md` §4.2 vs.
`backend/src/app/utils/sendResponse.ts` +
`backend/src/app/modules/readings/readings.controller.ts:9` +
all three `firmware/*/*.ino` (identical `send_reading()` parsing)

This was flagged by the audit brief as "a strong candidate root cause,"
so I checked it carefully. `contract.md` §4.2 documents a **flat**
response (`{accepted, state, risk_score, commands, server_seq_ack}` at
the root). The backend's `sendResponse()` is applied to *every* route
including `/api/readings`, so the actual wire response is **wrapped**:
`{success, message, data: {accepted, state, ...}}`.

However, firmware was written against the wrapped shape all along:
```cpp
if (!err && r["success"] == true) {
  JsonObject d = r["data"];
  if (d["accepted"] == true) {
    cmd.led = d["commands"]["led"].as<String>();
    cmd.buzzer = d["commands"]["buzzer"];
    cmd.relay_cutoff = d["commands"]["relay_cutoff"];
```
identically in `iotlab_sketch.ino`, `serverroom_sketch.ino`, and
`sketch.ino`. Backend and firmware agree with each other; only the
**documentation** is stale. I verified the WARNING/CRITICAL actuation
rule end-to-end through this wrapped shape (backend sets
`led/buzzer/relay_cutoff` correctly per state; firmware's
`apply_commands()` correctly gates buzzer+relay to CRITICAL only,
LED-only for WARNING) — **actuation logic itself is correct.**

**Proposed fix:** Update `docs/contract.md` §4.2 to show the wrapped
`{success, message, data}` shape, and note explicitly that this is one of
the few endpoints firmware (not just the dashboard) consumes.

**Applied directly:** Doc-only fix, applied.

---

### F5 — 90-day retention job exists and is correct but is never scheduled

**Severity: BREAKS A TEST CASE** (TC21 — a stated retention policy that
doesn't actually run isn't a retention policy)
**Files:** `backend/src/app/utils/retentionJob.ts` (whole file),
no call site anywhere in `backend/src` or `backend/scripts`
(confirmed via repo-wide grep)

`runDataRetentionPruning()` is correctly implemented (deletes `Reading`
rows older than 90 days, leaves `Incident`/`IncidentTransition` alone,
matching `docs/backup-strategy.md` §3 exactly) but is dead code — no
cron, no `setInterval`, no npm script, no Render cron job config
anywhere in the repo references it.

**Proposed fix:** Schedule it, e.g. a daily `setInterval` started
alongside boot recovery in `server.ts` (mirrors how the offline-checker
is/should be wired), or a dedicated `backend/scripts/run-retention.ts`
invoked by a platform-level cron (Render Cron Job / GitHub Action) if an
in-process interval isn't the intended mechanism for a
possibly-multi-instance deployment.

**Applied directly:** Yes, via a daily in-process interval (simplest fix
consistent with the existing boot-recovery pattern) — **but flagged
below under NEEDS A HUMAN CALL** too, since a single-instance in-process
interval is not correct for a horizontally-scaled deployment, and I
don't know if this backend is expected to ever run more than one
instance.

---

### F6 — Frontend realtime provider: initial REST snapshot can clobber a fresher socket update

**Severity: BREAKS A TEST CASE** (TC12a "colors update live without
manual refresh" — this is a reliability gap in that guarantee, most
visible right after page load against a busy/cold-started backend)
**Files:** `frontend/providers/realtime-provider.tsx:44-55` (initial
fetch) vs. `:63-75` (socket `zone:state` handler)

```ts
api.getZones().then((list) => {
  const byId: Record<string, ZoneSummary> = {};
  for (const z of list) byId[z.zone_id] = z;
  setZones(byId);              // <-- full replace
}).catch(...)

const socket = io(BACKEND_URL, { withCredentials: true });
...
socket.on("zone:state", (evt) => {
  setZones((prev) => ({ ...prev, [evt.zone_id]: {...} })); // <-- functional merge
});
```

Both the REST call and the socket connection start in the same effect
with no ordering between them. The backend does **not** replay any
snapshot to a newly-connected socket (`config/socket.ts`'s `connection`
handler only logs and wires `disconnect` — no initial state push), so
this specifically requires a *new* `zone:state` event to arrive from a
live sensor during the fetch window to manifest — plausible given 10Hz
firmware sampling from 3 zones and a Render free-tier cold start on the
REST call. If that happens, the socket handler's merge writes fresh data
into `zones`, and then the REST `.then()` resolves and **fully replaces**
`zones` with its own (now stale-by-comparison) snapshot, silently
reverting the zone the socket had just updated.

**Proposed fix:** Merge the REST snapshot instead of replacing it,
letting any already-present (i.e., socket-derived) fields win over the
REST snapshot's fields for the same zone, while still using REST to
supply fields sockets never carry (`name`, `hazard_profile`) and to seed
zones with no socket activity yet:
```ts
setZones((prev) => {
  const merged = { ...prev };
  for (const z of list) merged[z.zone_id] = { ...z, ...merged[z.zone_id] };
  return merged;
});
```

**Applied directly:** Yes — this doesn't change the hook's exported
shape (`useRealtime()` still returns the same
`{connected, zones, priorityQueue, incidentEvents}`), only fixes internal
merge ordering.

---

### F7 — `Incident.acknowledged_by_user` typed as `string | null`, actually `{id,name,email} | null`

**Severity: COSMETIC (already patched defensively) / contract.ts
accuracy**
**Files:** `frontend/types/contract.ts`,
`backend/src/app/modules/incidents/incidents.service.ts:37,52,86`

Backend returns `acknowledged_by_user: inc.ackUser` where `ackUser` is a
Prisma `include` of `{id, name, email}` — a full user object, not a
string. (This was already hit as a runtime crash — "Objects are not
valid as a React child" — earlier in the frontend build and patched
defensively in `app/incidents/page.tsx` with an `acknowledgedByLabel()`
helper. That patch is fine and stays. This finding is about correcting
the *type declaration itself* so future consumers of `contract.ts` don't
hit the same surprise.)

**Proposed fix:**
```ts
acknowledged_by_user: { id: string; name: string; email: string } | null;
```

**Applied directly:** Yes.

---

### F8 — `ZoneSummary.last_seen_at` typed as non-nullable `string`, actually `string | null`

**Severity: COSMETIC / contract.ts accuracy**
**Files:** `frontend/types/contract.ts`,
`backend/src/app/modules/zones/zones.service.ts:35`

```ts
last_seen_at: z.lastSeenAt ? z.lastSeenAt.toISOString() : null,
```
A zone that has never reported has `lastSeenAt: null` in the DB, and the
backend correctly passes that through as `null` — but the frontend type
says `last_seen_at: string`, which underclaims nullability. Not currently
crashing anything (nothing in the frontend renders `last_seen_at`
directly yet), but exactly the kind of gap that produced F7's runtime
crash if something starts consuming this field.

**Proposed fix:** `last_seen_at: string | null;`

**Applied directly:** Yes.

---

### F9 — architecture.md says "N=5 debouncing"; risk-formula.md and code both say N=3

**Severity: DOC-VS-DOC CONFLICT** (per Step 0 authority order,
`risk-formula.md` outranks `architecture.md`)
**Files:** `docs/architecture.md` §2 step 2 ("Applies N=5 debouncing...")
vs. `docs/risk-formula.md` §4 ("N=3 Debounce Window") vs.
`backend/src/app/utils/debounce.ts:9`
(`const DEBOUNCE_THRESHOLD = 3;`)

Code matches `risk-formula.md` (N=3) exactly. `architecture.md` is
stale.

**Proposed fix:** Update `architecture.md` to say N=3.
**Applied directly:** Doc-only fix, applied.

**Note for the record:** the audit brief's own Step 3 checklist quotes
"weights 40/25/20/15... N=5 debounce" — this matches neither
`risk-formula.md` (40/40/30/25, N=3) nor the code (same as the doc). I
audited against `docs/risk-formula.md` and the code, per the authority
order in Step 0 of the brief itself, and both agree with each other on
40/40/30/25 and N=3. Flagging this per the brief's own instruction to
surface conflicts explicitly rather than silently pick a side — the
brief's checklist numbers appear to be from an older draft of the
formula.

---

### F10 — contract.md says `/api/health` is admin-only; api.md and code both say public

**Severity: DOC-VS-DOC CONFLICT** (per Step 0 authority order, `api.md`
outranks `contract.md`) — already flagged as a known item by the audit
brief; confirmed against code.
**Files:** `docs/contract.md` §4.4 vs. `docs/api.md` §1 vs.
`backend/src/app/modules/health/health.router.ts:6`
(`router.get("/health", getHealth);` — no auth middleware at all)

Code matches `api.md` (public, no session/admin check). `contract.md` is
stale.

**Proposed fix:** Update `contract.md` §4.4's health row to `session: —
(public)`.
**Applied directly:** Doc-only fix, applied.

---

## NEEDS A HUMAN CALL

These are either genuine product/design decisions, or things I can't
verify from static code alone. I did not silently pick a side on any of
these.

1. **F5's scheduling mechanism.** I wired the retention job to an
   in-process daily `setInterval` for now (simplest fix, consistent with
   how boot recovery already works), but if this backend is ever run as
   more than one instance, that will prune N times redundantly (harmless
   but wasteful) or fight over timing. If horizontal scaling is planned,
   move this to a platform-level cron (Render Cron Job) instead and
   remove the in-process interval.

2. ~~**F13 — `nl_report` as an `Incident.source` value is declared but
   never produced.**~~ **RESOLVED, see Part 2 below.** Decision was (a):
   wire it through to real incident creation.

3. **F14 — Can't verify `FRONTEND_URL` matches the deployed frontend
   from code alone.** Better Auth `trustedOrigins`, Express CORS, and
   Socket.io CORS all consistently derive from the same `FRONTEND_URL`
   env var (`backend/src/app/config/auth.ts`, `app.ts`, `server.ts`) —
   internally consistent, no code bug. I confirmed during earlier
   frontend testing that `http://localhost:3000` is correctly *rejected*
   by the deployed backend's CORS (expected — it isn't the deployed
   frontend origin), which at least proves the setting isn't
   accidentally wide-open. Please confirm the Render backend's
   `FRONTEND_URL` env var is set to the deployed frontend's exact origin
   (scheme + host, no trailing slash).

4. **F15 — Doc-to-PDF rendering pipeline unverified.**
   `architecture.md`/`erd.md` use ` ```mermaid ` fenced blocks;
   `risk-formula.md` uses `$$...$$` / `$...$` LaTeX. Both need specific
   tooling (a Mermaid renderer; a math filter such as MathJax/KaTeX via
   Pandoc) to render as diagrams/formatted math rather than raw source
   text in a final PDF. No build script for a submission PDF exists
   anywhere in this repo, so I can't confirm the pipeline handles either.
   Please verify with whatever tool actually produces the submitted PDF.

5. ~~**F16 — `riskFusion.ts`'s fire contribution has an undocumented extra
   branch.**~~ **RESOLVED, see Part 2 below.** Decision was to remove the
   branch and match `docs/risk-formula.md` exactly.

---

## Other things checked and found correct (no action needed)

Listed briefly so it's clear these were checked, not skipped:

- Firmware `seq` is genuinely monotonic (`++seq` before every send), and
  the backend correctly handles device-reboot resets
  (`readings.service.ts:75-78`).
- `sensor_health`/dedup validation: negative sensor values correctly
  rejected with 400 via Zod (`readings.validation.ts`), matching
  `contract.md`'s example exactly; duplicate `seq` correctly ignored via
  both the in-memory cache check and the DB-level
  `@@unique([zoneId, seq])` backstop (P2002 swallowed gracefully).
- `acknowledgeIncident` uses an atomic `updateMany` with
  `acknowledgedBy: null` in the `WHERE` clause — genuinely first-write-wins,
  not read-then-write (TC7b). Verified against `backend/scripts/ack-race-test.ts`'s
  own expectations.
- `requireAdmin` is enforced server-side on all three admin routes
  (`POST /zones`, `GET /zones/:id/key`, `POST /zones/:id/override`) —
  not just assumed from frontend routing (TC13b).
- `performBootRecovery()` is `await`-ed before `server.listen()` (TC9a).
  One minor edge-case noted inline in F-list above (not a separate
  finding): it forces `state="CRITICAL"` for any zone with an
  OPEN/ACKED incident even if the latest `Reading` row already shows a
  lower state, which could cause a one-cycle false-CRITICAL flash right
  after a restart in the rare case where the hazard cleared just before
  the crash. Low severity, not tied to a specific numbered TC beyond
  general TC9a robustness — noting only.
- `prisma/schema.prisma` matches `erd.md` field-for-field, including
  `@@unique([zoneId, seq])`, `@@index([status, openedAt])`,
  `@@index([zoneId, receivedAt])`, and `onDelete: Restrict` on all three
  `Zone →` relations (TC17, TC18, TC19).
- WARNING-vs-CRITICAL actuation split (buzzer+relay only on CRITICAL,
  LED-only on WARNING) verified correct end-to-end through the wrapped
  envelope from F4 — both backend computation and firmware application
  are correct (TC5b).
- `GET /api/zones` returns all zones in one call (TC8a); `GET
  /api/incidents` filters by `from`/`to`/`zone_id`/`status` (TC8b);
  `POST /api/incidents/:id/ack` 404s on an unknown id (TC8c).
- Bonus ML predictor (`predictRiskProbability`) is correctly isolated
  from the actuation path — not imported anywhere in
  `readings.service.ts`/`riskFusion.ts` — and carries an explicit
  `safety_guarantee` string (Bonus TC 3e).
- Low-severity, noted only, no fix applied: `parseNaturalLanguageReport()`
  can return `zone_id: "robotics_lab"` for text mentioning "robotics," but
  no such zone is ever seeded. Currently harmless (the endpoint never
  writes to the DB), but a latent trap if NL-report → incident-creation
  is wired up later (see NEEDS A HUMAN CALL #2).

---

## Fixes applied in this pass

See per-finding "Applied directly" notes above. Summary:

- **F1**: implemented and re-enabled a real offline-checker sweep.
- **F2**: reordered debounce/decay so decay compares against the fresh
  per-cycle fusion score instead of the previous cycle's already-held
  score.
- **F3**: `validateZoneKey` now attaches the resolved zone id to the
  request and `processReading` rejects a body `zone_id` that doesn't
  match the authenticated key's zone.
- **F4, F9, F10**: doc corrections in `contract.md` and `architecture.md`.
- **F5**: retention job wired to a daily in-process interval (see NEEDS A
  HUMAN CALL #1 for the scaling caveat).
- **F6**: realtime provider's initial REST fetch now merges instead of
  replacing.
- **F7, F8**: `frontend/types/contract.ts` type corrections.

Not touched: F13, F14, F15, F16 (all under NEEDS A HUMAN CALL), and the
two low-severity noted-only items (boot-recovery CRITICAL-forcing edge
case; `robotics_lab` latent trap).

---

## Part 2 — Deferred decisions resolved + automated verification pass

Follow-up pass: F16 and F13 were decided (see below) and implemented;
then an automated verification suite
(`backend/scripts/verify-fixes.ts`) was built and run against the
**deployed** backend to confirm F1-F16 actually hold up over HTTP, not
just in code review. Full pass-by-pass results:
[docs/verification-results.md](verification-results.md).

### F16 — RESOLVED: removed the undocumented flat-0.5 fire branch

**Decision:** remove the branch; if a zone needs to reach CRITICAL
faster for demo purposes, tune `DEBOUNCE_THRESHOLD` in `debounce.ts`
instead (a documented, tunable parameter) rather than deviating from the
formula itself.

**Files changed:** `backend/src/app/utils/riskFusion.ts`. The fire
contribution is now exactly:
```ts
const fire_norm = debouncedFireSignal ? 1.0 : Math.min(1.0, sensors.flame_raw / flameMaxAdc);
```
matching `docs/risk-formula.md` with no intermediate case. `N` (the
debounce window) was left untouched at 3, per the instruction not to
change the documented value as part of this fix.

**Verified live:** confirmed via `verify-fixes.ts`'s F2 check after
deployment — a single reading at `flame_raw:900` (proportional case, not
yet debounced) now produces `fire_contrib ≈ 35.2` (`40 × 900/1023`), not
the old branch's flat `20` (`40 × 0.5`). See
`verification-results.md` for the exact before/after numbers that
proved the old code was still live until redeployed.

### F13 — RESOLVED: `nl_report` now creates real Incidents

**Decision:** wire it through to real incident creation, under the hard
constraint that it must never touch a zone's live `risk_score` or
SAFE/WARNING/CRITICAL classification — see the constraint list in the
follow-up brief, reproduced in code as a comment at the top of the
BONUS 4 section.

**Files changed:**
- `backend/src/app/utils/hazardTypes.ts` (new) — single source of truth
  for the hazard-type vocabulary (`"fire" | "gas" | "water"`), now
  shared between sensor-triggered incidents (`readings.service.ts`) and
  the NL-report path instead of being duplicated.
- `backend/src/app/modules/bonus/bonus.service.ts` — `parseNaturalLanguageReport()`
  is now a pure extraction function that returns `null` for `zone_id`/
  `hazard_type` when it can't confidently resolve one (previously
  silently defaulted unmatched text to `"iot_lab"`, and had an
  unreachable `"robotics_lab"` branch for a zone that was never seeded —
  see the "Other things checked" note above, now fixed rather than just
  noted). A new `submitNaturalLanguageReport()` orchestrates: extract →
  validate `zone_id` against a real non-archived `Zone` row → validate
  `hazard_type` against `KNOWN_HAZARD_TYPES` → if either fails,
  `validation_gate:"failed"`, no incident → if `estimated_severity` is
  `"SAFE"`, no incident (nothing to act on) → otherwise reuse an existing
  OPEN/ACKED incident for that zone if one exists (append hazard type,
  bump `peakRiskScore` if higher — same flapping-prevention pattern
  sensor-triggered incidents use) or open a new one, `source:"nl_report"`.
- `backend/src/app/modules/bonus/bonus.controller.ts` — calls
  `submitNaturalLanguageReport()` instead of the raw parser.
- `frontend/types/contract.ts` — `NlReportResponse` updated to match:
  `extracted_signal.zone_id`/`hazard_type` are now `string | null`, and
  a new `incident_id: string | null` field was added (set when an
  incident was created/updated, `null` for a failed gate or a SAFE
  report). Nothing in the frontend UI consumes this endpoint yet, so
  this is a safe, non-breaking type correction, not a shape change to
  something already wired up.

**Hard constraint verification:** confirmed by code review (the new
code never imports/calls `updateZoneCacheItem`, `broadcastZoneState`, or
writes to the `Zone` table) *and* by a live check: three real
`POST /api/bonus/nl-report` calls were made against the deployed
backend (one CRITICAL "fire" report for `server_room`, one unresolvable
"robotics lab" report, one WARNING "gas" report for `data_science_lab`),
then `GET /api/zones` was checked immediately after — both real zones'
`state`/`risk_score` were byte-for-byte unchanged from before the
reports, confirming the NL-report path cannot move a zone's live
classification even for a CRITICAL-severity report. Full transcript in
`verification-results.md`.

**Priority queue tension, resolved:** the follow-up brief's constraint
text says nl_report incidents should be "surfaced in the incident list
and priority queue for staff attention," but the priority queue
(`readings.service.ts`'s `getPriorityQueue()`) is deliberately driven
only by `zoneCache` (sensor/risk-fusion state), which the hard
constraint forbids this path from touching. I resolved this in favor of
the hard constraint (it explicitly outranks "doing the feature at all"):
nl_report incidents appear in the incident list
(`GET /api/incidents`) and get a real-time `incident:opened` Socket.io
broadcast (so connected dashboards see them immediately), but they do
**not** appear in the risk-based priority *ranking* itself, since that
would require deriving ranking from something other than live sensor
state. Flagging this explicitly rather than silently picking a side.

**Verified live:** `parseNaturalLanguageReport()`'s zone-resolution
change also fixes the `robotics_lab` latent bug noted earlier in this
document — confirmed live: a report mentioning "robotics" now returns
`extracted_signal.zone_id: null` and `validation_gate:"failed"` instead
of fabricating a non-existent zone.

### Automated verification suite

Built `backend/scripts/verify-fixes.ts` (`npm run verify:fixes`) and
`backend/scripts/reset-demo.ts` (`npm run reset:demo`, new — see the
final report for why this needed to be created). Full results,
including one real bug this pass found and fixed
(`backend/scripts/phantom-zones.ts`'s missing admin auth) and one
significant live discovery (the deployed backend's actual
`FRONTEND_URL` is a pre-existing Vercel deployment,
`https://clover-scs-rg.vercel.app`, not the one separately deployed to
`shah-samin-yasars-projects/frontend` earlier), are in
[docs/verification-results.md](verification-results.md).
