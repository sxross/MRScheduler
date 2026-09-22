# Project status and decisions

Last updated 2026-09-22.

## 1. Current phase: UI prototyping

The project is deliberately in UI/model validation, not infrastructure
implementation.

Current priorities:

1. validate the noon-to-noon timeline UX on-device
2. validate schedule editing interactions
3. validate how astronomical fences, clamping, and adjustments are presented
4. validate the user-facing distinction between governed and ad-hoc schedules

Deferred until the interaction model stabilizes:

- Firebase integration
- Mac daemon
- production persistence
- Matter commissioning/control
- HTTP/RPC device control
- production device discovery

The in-memory sample configuration is intentional during this phase.

## 2. What is built

On branch `claude/meross-scheduler-prd-edycrr`:

- `packages/domain` — pure TypeScript scheduling engine with no React,
  Firebase, vendor, transport, or platform dependency
- `packages/timeline` — pure timeline geometry, independent of rendering
- `apps/mobile` — Expo iOS prototype with timeline, upcoming events, and
  schedule enable/disable against an in-memory sample configuration

The scheduling and timeline packages are intentionally stable seams beneath an
experimental UI.

## 3. Reference hardware and transport direction

The current reference devices are **Shelly smart plugs**.

The application is **not a Matter scheduler** and is not coupled to Shelly.
Device communication must be abstracted behind an application-owned,
capability-oriented interface.

Conceptually:

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

The scheduler deals in application capabilities such as power state, not
protocol concepts.

A minimal transport contract is expected to support operations equivalent to:

```ts
interface SmartDeviceTransport {
  getState(device: Device): Promise<DeviceState>;
  setPower(device: Device, state: PowerState): Promise<CommandResult>;
  isReachable(device: Device): Promise<boolean>;
}
```

Persisted device configuration selects a transport. Moving a Shelly device from
Matter to local HTTP/RPC should require changing its connection configuration
and adapter, not the scheduling engine, timeline, Firebase schema semantics, or
UI.

Protocol-specific details such as Matter clusters and Shelly RPC methods must
remain inside their adapters.

Shelly is reference/test hardware, not a domain concept.

## 4. Scheduling decisions settled so far

### Constraints are windows, not single bounds

A guardrail such as "nothing turns on after sunrise" cannot be represented by a
single upper bound. Each fence is a permitted window anchored at two
astronomical events.

### Evaluation happens on a noon-origin axis

The engine works on a solar day running local noon to local noon. Dusk,
midnight, and the following sunrise therefore increase monotonically. Day of
week keys off the ON edge.

The timeline currently mirrors this noon-to-noon representation. Whether that is
the best *user-facing* representation is explicitly part of the current UI
prototype work.

### Two schedule behaviors

- **governed** — endpoints are clamped into astronomical permitted windows
- **adhoc** — runs exactly as drawn without astronomical governance

These are domain terms. The UI does not need to expose those words. User-facing
language should be determined through prototyping.

### Clamping is visible

Governed schedules clamp rather than reject when requested times cross a fence.
Every adjusted edge retains requested and effective times so the UI can explain
the adjustment. A cycle that collapses entirely is blocked.

### Civil and nautical twilight are supported

The astronomical engine supports sunrise/sunset plus civil and nautical
twilight, allowing fences to be anchored to the light condition that best
matches the use case.

## 5. Runtime architecture after prototyping

The intended execution model remains:

```
iOS configuration UI
        |
        v
Firebase RTDB
        |
        v
Mac launchd daemon
        |
        v
DeviceController
        |
        v
selected transport
        |
        v
local smart device
```

Firebase synchronizes configuration; it does not execute automation.

The Mac daemon owns:

- scheduling
- local configuration snapshot
- event queue
- device-state reconciliation
- transport selection and execution

The daemon must boot from its local snapshot so an Internet/Firebase outage does
not prevent execution of an already-synchronized schedule.

## 6. UI questions currently worth testing

### Noon-to-noon timeline

It is mathematically clean because a dusk-to-dawn cycle is continuous. The open
question is whether it is immediately understandable to a user. Judge this
visually/on-device rather than treating the engine representation as a UI
requirement.

### Governed vs. ad-hoc

The engine distinction is useful. The UI should test behavioral language such as
"Follow daylight limits" rather than prematurely exposing domain terminology.

### Requested vs. effective times

Clamping must be understandable without making the timeline noisy. The
prototype should make it possible to see both what the user requested and what
will actually happen.

## 7. Infrastructure work intentionally deferred

Do not let these tasks drive the current UI prototype:

- Firebase authentication/schema
- Matter controller implementation
- Shelly HTTP/RPC implementation
- Mac IPC/API
- launchd packaging
- device commissioning
- production diagnostics

The transport abstraction itself is a settled architectural seam, but its
production implementations can wait.

## 8. Historical Meross investigation

Meross MSS110 was the original reference hardware. Investigation found that
local control depended on reverse-engineered, firmware-sensitive behavior and
could not be treated as a durable product boundary.

The project therefore moved to programmable/local-first hardware and an
application-owned transport abstraction.

The detailed investigation is retained in
[docs/history/MEROSS.md](history/MEROSS.md) as design history; it is no longer a
project blocker or next step.

## 9. Next steps

1. Continue UI prototyping against `sampleConfig.ts`.
2. Run the prototype on-device and judge the noon-to-noon timeline.
3. Prototype schedule editing.
4. Prototype astronomical fence/clamp presentation.
5. Decide user-facing language for governed vs. ad-hoc behavior.
6. Only after the interaction model stabilizes, begin infrastructure integration.
