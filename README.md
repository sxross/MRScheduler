# MRScheduler

Astronomically-aware scheduling for local smart devices. Schedules are stored as
intent (`sunset - 20m`), never as derived clock times, and are executed locally
so the house keeps working when the Internet does not.

The current reference hardware is **Shelly smart plugs**. Device communication is
deliberately protocol-independent: Matter, local HTTP/RPC, MQTT, or another
transport can be swapped without changing the scheduler or UI model.

## Current phase: UI prototyping

The current priority is validating the interaction model before attaching
production infrastructure:

1. timeline UX
2. schedule editing UX
3. astronomical constraint presentation
4. governed vs. ad-hoc schedule behavior

The mobile app intentionally runs against an in-memory sample configuration.
Firebase, the Mac daemon, production persistence, and device commissioning/control
are deferred until the UI and scheduling model stabilize.

## Layout

```
packages/domain/     pure TypeScript scheduling engine -- no React, Firebase,
                     transport, vendor, or platform APIs
packages/timeline/   pure timeline geometry: axis, bars, fences, clamp marks.
                     Depends on the domain, knows nothing about rendering
apps/mobile/         Expo iOS UI prototype; a thin painter over the two packages
```

## Device communication boundary

MRScheduler owns a capability-oriented device interface. Neither the scheduling
domain nor UI knows whether a device is reached through Matter, HTTP, MQTT, or
another protocol.

```
Scheduling Domain
       |
       v
DeviceController
       |
       v
SmartDeviceTransport
       |
       +-- MatterTransport
       +-- ShellyHttpTransport
       +-- MqttTransport
       +-- FutureTransport
```

Transports translate application-level operations such as `setPower(on)` and
`getState()` into protocol-specific commands. Protocol details such as Matter
clusters or Shelly RPC methods must not leak through this boundary.

A device's persisted connection configuration selects the transport. Changing a
device from Matter to local HTTP should be a configuration/adapter change, not a
scheduler change.

Shelly is the reference hardware, **not** an architectural dependency.

## Key design decisions

**Constraints are windows, not bounds.** A global guardrail such as "nothing
turns on after sunrise" cannot be a single upper bound: 2pm precedes the next
sunrise, so a lone bound would wave a daytime ON straight through. Each fence
is therefore a permitted window anchored at two astronomical events, which is
also what the timeline draws.

**The engine evaluates on a noon-origin axis.** Cycles routinely straddle
midnight -- "on at dusk, off at sunrise + 30m" is continuous, yet on a
midnight-origin clock its OFF edge sorts before its ON edge. The solar day runs
local noon to local noon, so dusk, midnight and the following sunrise increase
monotonically and every constraint check is a plain interval comparison. Day of
week keys off the ON edge, so "Friday" means the cycle starting Friday evening.

**There are two buckets of schedule.** A `governed` schedule lives inside the
fences: its endpoints are clamped into the permitted window, so lights never
come on in daylight or stay on past the morning bound, and the effective times
drift with the seasons. An `adhoc` schedule is astronomically unaware and runs
exactly as drawn -- morning kitchen lighting, for instance.

**Clamping is never silent.** Every adjusted edge keeps both the requested and
the effective time, and the event queue reports the adjustments it made. The one
case that cannot be clamped -- where the fences would invert a cycle, leaving no
time to run -- is reported as blocked rather than wrapped into a 24-hour ON.

## Intended runtime architecture

Once UI prototyping stabilizes, the Mac will run a `launchd` daemon holding the
scheduler, local configuration cache, and device controller. A GUI layers on top
over a local API rather than embedding the scheduler, so the house keeps running
whether or not anything is on screen.

Firebase Realtime Database will synchronize configuration between the daemon and
iOS; it will never execute device commands.

The daemon will boot from a local configuration snapshot so Firebase or Internet
availability is not required for an already-synchronized schedule.

See [docs/STATUS.md](docs/STATUS.md) for the current project state and next steps.
Historical Meross research is retained in [docs/history/MEROSS.md](docs/history/MEROSS.md).

## Development

```
npm install
npm test
npm run typecheck
```

### Running the iOS app

Requires a Mac with Xcode. The app uses a development build rather than Expo Go,
because it needs native modules Expo Go does not bundle.

```
cd apps/mobile
npx expo prebuild --platform ios
npx expo run:ios
npm start
```

The app currently runs against `src/state/sampleConfig.ts`. Infrastructure
replaces that source later without changing the scheduling model.

### Web prototype

The same React Native component tree can be run in a browser for fast UI
iteration from a phone:

```
npm run web --workspace=@mrscheduler/mobile
```

A static production build is generated with:

```
npm run export:web --workspace=@mrscheduler/mobile
```

The output is `apps/mobile/dist`. `netlify.toml` at the repository root is
configured to publish that directory. Connect the repository/branch to Netlify
once; subsequent pushes can then produce a browser-visible prototype without an
iOS rebuild.

This web target is a prototyping surface, not a separate web application. Keep
shared UI in React Native components so the browser prototype exercises the same
component hierarchy as iOS.
