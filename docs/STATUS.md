# Project status and decisions

Last updated 2026-09-21. This is the pick-up-where-we-left-off document: what is
built, what was decided and why, what is still unknown, and the one open risk
that could reshape the product.

---

## 1. Where things stand

**Built and pushed** (branch `claude/meross-scheduler-prd-edycrr`):

- `packages/domain` — the pure TypeScript scheduling engine. PRD phases 1 and 2.
  42 tests, no dependency on React, Firebase, Meross or any platform API.
- `packages/timeline` — pure timeline geometry, 13 tests. Depends on the domain,
  knows nothing about rendering, so the arithmetic behind the chart is testable
  without a simulator.
- `apps/mobile` — Expo iOS client: timeline, upcoming events, schedule list with
  enable/disable. Runs against an in-memory sample configuration. Typecheck
  clean; **not yet run on a device**, so it is unverified visually.

**Not started:** Firebase (phase 3), Meross transport (phase 4), Mac daemon
(phase 5). The iOS schedule and constraint editors (phase 6) are still to come.

**Blocked on hardware:** the Meross transport. See section 5 — this is the one
thing that could change the shape of the product, and it is unresolved.

---

## 2. Decisions settled so far

### Constraints are windows, not single bounds

A guardrail like "nothing turns on after sunrise" cannot be expressed as an
upper bound alone: 2pm precedes the next sunrise, so a lone bound would permit a
daytime ON. Every fence is therefore a permitted *window* anchored at two
astronomical events — which is also exactly what the timeline in PRD §17 draws.

```ts
constraints: {
  on:  { from: { event: 'dusk', offsetMinutes: 0  },
         to:   { event: 'sunrise', offsetMinutes: -15 } },
  off: { from: { event: 'dusk', offsetMinutes: 20 },
         to:   { event: 'sunrise', offsetMinutes: 60 } },
}
```

### Evaluation happens on a noon-origin axis

Cycles routinely straddle midnight — "on at dusk, off at sunrise + 30m" is one
continuous cycle, yet on a midnight-origin clock its OFF edge sorts *before* its
ON edge. The engine therefore works on a solar day running local noon to local
noon. Dusk, midnight and the following sunrise increase monotonically, and every
constraint check becomes a plain interval comparison with no wraparound logic.

Consequences worth remembering:

- Absolute endpoints are unambiguous: 18:30 belongs to the afternoon that opened
  the day, 06:00 to the morning that closes it.
- Day-of-week keys off the **ON edge**, so "Friday" means the cycle that starts
  Friday evening even though it ends Saturday morning.
- A solar day is identified by the calendar date of its opening noon.

### Two buckets of schedule

- **`governed`** — lives inside the fences. Endpoints are *clamped* into the
  permitted window, so lights never come on in daylight or stay on past the
  morning bound, and effective times drift with the seasons.
- **`adhoc`** — astronomically unaware. Runs exactly as drawn. This is the
  "magic override" for things like morning kitchen lighting.

This replaced an earlier per-transition exemption flag (`exemptFrom: ['on']`),
which expressed the same intent less directly.

### Clamping rather than rejection — a deliberate deviation from the PRD

PRD §18 and §44.6 say never silently modify user intent; reject instead. We
clamp. That is the better product decision — a governed schedule should track
the astronomical clock through the year rather than break every solstice — and
the contradiction is resolved by making the clamp **visible** rather than
silent:

- every edge keeps both its requested and effective time
- the event queue returns an `adjustments` list of every move it made
- `ScheduledEvent.adjustedFrom` carries the original time for the UI

The one case clamping cannot handle is fences that would invert a cycle, leaving
no time to run. That is reported as `blocked` with `collapsed: true` rather than
wrapping into a near-24-hour ON.

### The timeline is drawn noon to noon, not midnight to midnight

PRD §15 sketches a 00–24 axis. The engine's day already runs noon to noon, and
drawing it the same way means a dusk-to-sunrise cycle is one continuous bar with
midnight in the centre, rather than two stumps clinging to opposite edges. It
also puts the region that matters — dusk through dawn — in the middle of the
screen. Worth a look on a device before it is settled.

### React Native 0.87.1 needs the legacy type tree

`apps/mobile/tsconfig.json` sets
`customConditions: ["react-native-legacy-deep-imports", "react-native"]`. Without
it, React Native resolves to its generated types, where the exported `ViewStyle`
and `TextStyle` aliases collapse to empty types — `keyof TextStyle` contains
neither `color` nor `fontSize` — and every `style={[styles.x, { color }]}` fails
to compile. Revisit on the next React Native upgrade.

### Civil and nautical twilight are in V1

PRD §12 lists them as future work. They moved into V1 because the fences are
naturally anchored at dusk and dawn rather than sunset and sunrise. suncalc
provides them at no extra cost; the only expense is picker UI.

### The Mac is a launchd daemon with a GUI layered on top

Not `react-native-macos` — that is a Microsoft fork which lags upstream and
would put the reliability-critical half of the product on a thinly maintained
dependency. PRD §9 already concedes the scheduler probably needs to be a
separate process.

The daemon owns the scheduler, the local configuration cache and the Meross
transport. A GUI sits on top of it over a local API rather than embedding it, so
the house keeps running whether or not anything is on screen. Firebase
synchronises configuration between the daemon and iOS; it never executes
anything.

### Firebase offline persistence does not exist in Node

PRD §24 assumes the Firebase client's offline cache covers the Mac. Disk
persistence is an iOS/Android-only feature — the Node SDK is memory-only, so a
daemon restart with the Internet down would come up with no configuration, which
breaks the central architectural test in §57.

**The daemon must write every received config snapshot to a local JSON file and
boot from that file**, treating Firebase purely as an update stream. This also
yields the staleness indicator §24 asks for, for free.

---

## 3. Deployment facts

| Thing | Value |
|---|---|
| Location | Los Angeles, ~34.05 N, -118.24 |
| Timezone | America/Los_Angeles |
| Devices | Meross MSS110, **hardware 8.0.0**, firmware 6.2.5 |
| Wi-Fi | 2.4 GHz (SSID `cottons2`) |

The plug's MAC address is on the Meross app's device info screen. It is needed
later: the AES key for encrypted local control derives from
`MD5(uuid + key + mac)`.

Reference astronomical times used in tests (Los Angeles):

| Date | Sunset | Dusk | Sunrise (next morning) |
|---|---|---|---|
| 2026-01-15 | 17:07 | 17:34 | 06:59 |
| 2026-06-15 | 20:07 | 20:36 | 05:42 |

---

## 4. Known conflicts in the example configuration

Two things surfaced while writing tests, both still open for tuning:

1. **The PRD's porch example conflicts with a dusk-anchored ON fence.** In LA in
   mid-January, sunset is 17:07 and dusk is 17:34, so `sunset - 20m` (16:47) is
   47 minutes before the fence opens and gets clamped to 17:34. Either anchor the
   ON fence at `sunset - 30m` or accept the clamp. Best judged on the timeline.
2. **A morning kitchen schedule is seasonally sensitive.** A governed 6:00 AM ON
   stands in January (sunrise 06:59) and is pulled back to 05:27 in June (sunrise
   05:42). That is a good argument for the timeline defaulting to a solstice date
   when checking a schedule — or for making it `adhoc`.

---

## 5. THE OPEN RISK: can these plugs be controlled locally at all?

This is unresolved and it is the question that decides whether PRD §57's central
architectural test is achievable with this hardware.

### What is known

- The Meross local protocol is reverse-engineered, not documented. Local control
  is an HTTP POST to `http://<ip>/config` with
  `sign = MD5(messageId + key + timestamp)`. The device key normally comes from a
  one-time Meross cloud login, so operation is cloud-free but *pairing* is not.
- Encryption on newer devices has been reverse-engineered: AES-256 with a key
  derived from `MD5(uuid + key + mac)` and an IV hardcoded by Meross.
- **MSS110 hw 4.0.0 / fw 4.2.14**: local control works.
- **MSS110 hw 7.0.0**: a firmware update whose notes read *"improve security of
  local control"* broke `meross_lan` entirely. Devices ack messages then throw
  `ServerDisconnectedError`. [Issue #456](https://github.com/krahabb/meross_lan/issues/456),
  [issue #472](https://github.com/krahabb/meross_lan/issues/472) — still open, no
  root cause found, reporter moved to cloud control.
- **hw 7.0.0 also could not be repointed at a local MQTT broker**
  ([bytespider/Meross #88](https://github.com/bytespider/Meross/issues/88)), so
  that escape hatch failed on that generation too. HomeKit-variant firmware pins
  TLS strictly enough to reject a self-signed local broker outright.
- **MSS110 hw 8.0.0 — ours — has no public reports at all.** It is newer than
  anything documented in either project.

Note a trap: firmware major version does **not** track hardware revision. Ours is
fw 6.2.5 on hw 8.0.0.

### The decisive test, not yet run

Get a plug's IP from the router's DHCP client list (match the MAC), then:

```
curl -s -m 3 -X POST http://<ip>/config \
  -H 'Content-Type: application/json' \
  -d '{"header":{"messageId":"0","namespace":"Appliance.System.All","method":"GET","payloadVersion":1,"sign":"0","timestamp":0},"payload":{}}' \
  -w '\nHTTP %{http_code}\n'
```

The signature is deliberately junk. This tests only whether the door exists:

- **any JSON response, even an error** → local HTTP is alive, signing is the only
  obstacle. Proceed to the full spike.
- **connection refused or immediate failure** → the endpoint is closed. That is
  the hw 7.0.0 failure mode.
- **long hang then timeout** → filtered; treat as closed.

From an iPhone on the same network, three ways:

- **Shortcuts** (nothing to install, and not subject to CORS): a **Text** action
  holding the JSON body, then **Get Contents of URL** with Method POST, header
  `Content-Type: application/json`, and Request Body set to **File** pointing at
  that Text variable — this bypasses the fiddly JSON builder. Finish with **Quick
  Look**. Allow the Local Network permission prompt on first run, and disable any
  VPN first. On iOS 27 you can instead describe the request in natural language,
  but verify three things afterwards: method is POST (it may latch onto the
  `"method":"GET"` inside the body), the Content-Type header survived, and the
  body nesting is intact.
- **a-Shell** (free, App Store): real curl, run the line above verbatim. Best if
  the result is ambiguous and we need exact status codes.
- **iSH**: works, but a whole Alpine userland for one request.

Do **not** try this from a web page — anything served over HTTPS blocks the
mixed-content call to `http://192.168.x.x`, and the device sends no CORS headers,
so a failure would be indistinguishable from the plug being closed.

### Fallback ladder if local HTTP is closed

1. **Local MQTT broker** via DNS redirect of the Meross broker hostname. Reported
   to fail on hw 7.0.0; HomeKit firmware rejects self-signed brokers. Worth one
   attempt, do not count on it.
2. **Meross cloud MQTT, daemon as a cloud client.** Works today and costs §57 —
   no Internet, no lights. But the scheduler stays local and the astronomical
   logic is untouched, so it is a degraded transport rather than a redesign, and
   still does something Meross routines cannot.
3. **Different hardware.** ESPHome/Tasmota-flashable plugs, or
   Matter/Zigbee/Z-Wave, all with documented local protocols and no vendor kill
   switch. The only option that satisfies offline operation unconditionally.

The architecture absorbs any of these without change: `MerossTransport` (PRD §10)
is exactly this seam, and the domain package does not know Meross exists.

### Act on this regardless of the result

**Turn off automatic firmware updates on those plugs.** The hw 7.0.0 failure
arrived as an unsolicited update that removed a capability. Whatever the probe
says, the current state may be worth preserving.

---

## 6. Practical notes for the transport, when we get there

- MSS110 is single-channel. Older firmware uses `Appliance.Control.Toggle`
  (`{toggle:{onoff:1}}`); newer uses `Appliance.Control.ToggleX`
  (`{togglex:{channel:0,onoff:1}}`). Hardware revisions disagree, so the transport
  must query `Appliance.System.Ability` at configuration time and record which
  dialect each device speaks rather than assuming.
- **Polling is the only state channel, not a safety net.** These plugs push state
  changes over MQTT to the Meross cloud broker, not to us. A physical button press
  is invisible until we ask. PRD §22's reconciliation loop is load-bearing —
  poll `Appliance.System.All` every 30–60s per device.
- **No reliable mDNS.** Discovery is realistically: cloud-enumerate once to get
  uuid/mac/key, subnet-probe `/config` to map uuid → IP, then pin with DHCP
  reservations.
- Library options: `node-meross-sdk` is only a placeholder on npm (0.0.0) and
  would have to come from source. `meross-cloud` (3.1.2) is real and maintained if
  we end up on the cloud path. The mature implementations are Python
  (`meross_iot`, Home Assistant's `meross_lan`).
- MSS110 has no energy monitoring — that is the MSS310. PRD excludes it anyway.

---

## 7. Next steps

1. **Run the probe in section 5.** It gates everything about the transport.
2. **Phase 3, Firebase** — fully independent of the hardware question and can
   start at any time: auth, schema under `/users/{uid}/…`, security rules,
   realtime subscription, and the local JSON snapshot cache the daemon boots from.
3. **Write the LAN spike** once the probe says the door is open: cloud login, key
   extraction, `Appliance.System.Ability` probe, toggle, then the same toggle with
   the WAN unplugged. That script answers both the firmware question and §57.
