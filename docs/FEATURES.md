# MRScheduler Feature Map and Implementation Plan

**Status:** Working product baseline  
**Scope:** V1 unless explicitly marked later  
**Companion:** `docs/adr/`

## Product contract

MRScheduler lets a person express **when a device should be on** as visual intervals rather than managing disconnected ON and OFF events.

The primary interaction is:

> Find the device. See when it is on. Grab either end and move it.

The timeline is the primary schedule editor. Schedules may use absolute clock endpoints or astronomical endpoints with offsets. The Mac executes the last synchronized configuration locally; cloud availability is not required for an already-known schedule to run.

## Feature boundaries

### F1. Scheduling domain

Owns the meaning of a schedule independent of UI, persistence, and device protocol.

**V1**
- Absolute endpoints.
- Astronomical endpoints with signed offsets.
- Enabled/disabled schedules.
- Governed and ad-hoc schedule behavior.
- Multiple authored intervals per device.
- Overlap semantics: device is ON whenever at least one enabled effective interval requires ON.
- Astronomical guardrails/constraints.
- Requested versus effective values and adjustment provenance.
- Deterministic resolution for a date, location, and timezone.

**Does not own**
- Pixels or timeline geometry.
- Firebase documents.
- Matter/Shelly commands.
- React state.

**Acceptance**
Pure TypeScript tests can describe a configuration and prove the resulting effective intervals/events without rendering UI or contacting external services.

---

### F2. Timeline projection

Projects domain results into a noon-to-noon editing surface.

**V1**
- Canonical time ↔ X transform.
- Noon-to-noon local solar-day window.
- DST/timezone correctness.
- Astronomical markers.
- Night shading.
- Boundary clipping/continuation.
- Device rows in user-defined order.
- Authored/effective provenance carried into projected bars.

**Acceptance**
Geometry tests prove ruler ticks, markers, bars, hit targets, and inverse editing use the same transform. Changing presentation insets cannot change schedule time.

---

### F3. Schedule editing

Owns direct manipulation and precise editing of authored schedules.

**V1**
- Select/deselect an authored clip.
- Trim either endpoint.
- Continuous minute-level drag feedback; no mandatory coarse snapping.
- Large forgiving hit targets independent of visible handle size.
- Browser text selection disabled by default.
- Create a new absolute interval on empty track space.
- Delete an authored interval.
- Change an endpoint between absolute and astronomical identity.
- Edit astronomical offset.
- Precise textual/time control for cases where dragging is inappropriate.
- Show when constraints alter the effective result without confusing that result with the authored schedule.

**Later**
- Optional magnetic landmarks/snapping.
- Whole-clip move if it proves useful.
- Rich keyboard editing.

**Acceptance**
Every completed edit mutates an authored domain schedule and the timeline is rebuilt from domain state. No UI-only schedule representation becomes authoritative.

---

### F4. Device management

Owns the user's set of controllable devices and their presentation order.

**V1**
- Add/remove device.
- Rename device.
- User-defined ordering.
- Enable/disable control as appropriate.
- Associate a device with runtime connection information.
- Optional user-assigned color only if needed; no inferred room/category taxonomy.

**Not V1**
- Rooms as an architectural grouping.
- Automatic semantic grouping.

**Acceptance**
Schedules reference stable device identity rather than row position, display name, or protocol address.

---

### F5. Schedule evaluation and execution

Turns synchronized configuration into reliable device state transitions.

**V1**
- Determine desired state at startup.
- Generate upcoming transitions.
- Recalculate when configuration, date, timezone/location-relevant inputs change.
- Execute ON/OFF transitions.
- Reconcile desired state with actual/reported device state.
- Coalesce overlapping schedules so one ending interval does not turn off a device still required by another.
- Recover after process restart.

**Acceptance**
A fake clock plus fake transport can run multi-day schedules deterministically, including overlaps and astronomical endpoints.

---

### F6. Device transport

Protocol-independent runtime device control.

**V1**
- `SmartDeviceTransport` boundary.
- Reachability.
- Read state.
- Set power.
- Normalized command result/error behavior.
- Fake transport for tests.
- At least one real transport sufficient to operate the initial hardware.

**Protocol candidates**
- Shelly HTTP.
- Matter.

The first production transport should be chosen on implementation/risk grounds; neither protocol becomes the scheduling architecture boundary.

**Acceptance**
Replacing the fake transport with a real transport requires no scheduling-domain changes.

---

### F7. Configuration persistence and synchronization

Makes configuration durable and available to the iPhone and Mac without putting cloud services in the execution path.

**V1**
- Firebase/Firestore as current cloud synchronization implementation.
- Durable Mac-local configuration cache.
- Initial synchronization.
- Incremental configuration updates.
- Version/schema identification.
- Atomic-enough configuration application so the executor does not run a partially synchronized logical change.
- Clear conflict policy before true simultaneous multi-writer editing is enabled.
- Drag/edit interactions commit completed semantic changes rather than streaming pointer movements to Firestore.
- Basic observability of sync state/errors.

**Acceptance**
Disconnect Internet after successful synchronization, restart the Mac service, and verify the correct schedule continues to execute.

---

### F8. Mac scheduler service

The always-on operational host.

**V1**
- Start automatically/reliably.
- Load durable local configuration before cloud availability is assumed.
- Own evaluator/executor lifecycle.
- Own runtime device transports.
- Accept synchronized configuration changes.
- Log meaningful schedule decisions and device-command failures.
- Recover from transient device/network failures without requiring the iPhone.

**Acceptance**
The iPhone can be powered off and WAN disconnected while scheduled local device transitions continue correctly.

---

### F9. iPhone application

The primary configuration/editor client.

**V1**
- Tonight/noon-to-noon timeline.
- Device and schedule editing from F3/F4.
- Upcoming transitions as a secondary explanatory view.
- Sync status sufficient to know whether a committed edit has propagated.
- Light/dark presentation.
- Portrait and landscape behavior.

**Later**
- Additional temporal views beyond Tonight.
- More advanced organizational/filtering tools.

**Acceptance**
A user can configure a device schedule without understanding ON/OFF event implementation details.

---

## Cross-cutting requirements

**Local-first execution.** Cloud failure cannot break an already-synchronized schedule.

**Determinism.** Given the same configuration, date/location/timezone, the domain resolver produces the same result.

**Separation of intent and result.** Authored schedules remain distinct from effective union/constraint output.

**Testability.** Domain, geometry, synchronization policy, and execution logic must be testable without real hardware.

**SOLID boundaries.** Dependencies point toward domain abstractions. UI, Firebase, and protocols are adapters rather than domain dependencies.

**Interaction quality.** The editor is an application surface, not a selectable web document. Touch behavior should remain continuous and forgiving.

## Vertical implementation slices

### Slice 0 — Stabilize Prototype 0

**Purpose:** Establish the current timeline as the reference interaction before adding product surface area.

- Disable application text selection on web by default.
- Preserve the corrected canonical timeline geometry.
- Preserve continuous endpoint dragging.
- Keep deployment build/date marker.
- Add regression tests for geometry already discovered during prototyping.

**Exit:** Existing prototype is stable enough to serve as a behavioral reference.

### Slice 1 — One absolute authored schedule, end to end

**Scenario:** One simulated device has one absolute schedule. Create it, edit both ends, persist it locally, restart, evaluate it, and drive a fake transport.

Build/finish:
- authored schedule CRUD,
- canonical editor mutation path,
- local persistence abstraction,
- evaluator/executor shell,
- fake transport.

**Exit:** The same schedule survives restart and causes deterministic fake ON/OFF transitions.

### Slice 2 — Astronomical identity

**Scenario:** Configure `sunset - 20m → 11:00 PM`.

Build/finish:
- endpoint-kind editor,
- astronomical offset editing,
- daily resolution,
- semantic identity retained after editing,
- astronomical display/provenance.

**Exit:** Changing date changes the resolved ON time while the authored endpoint remains `sunset - 20m`.

### Slice 3 — Multiple authored schedules and effective union

**Scenario:** A device has overlapping schedules.

Build/finish:
- multiple clips per device,
- provenance from effective interval to authored schedules,
- safe editing when an effective bar has multiple contributors,
- execution coalescing.

**Exit:** Ending one schedule cannot turn the device off while another still requires it ON.

### Slice 4 — Constraints/guardrails

**Scenario:** An authored governed schedule extends outside its allowed astronomical window.

Build/finish:
- requested/effective presentation,
- unobtrusive adjustment indication,
- precise explanation/edit path,
- executor consumes effective result.

**Exit:** User can tell what was authored and what will actually execute without either being silently rewritten.

### Slice 5 — Device lifecycle and ordering

**Scenario:** Add devices, rename them, reorder them, schedule them, remove one safely.

Build/finish:
- device CRUD,
- stable identity,
- user ordering,
- connection metadata boundary.

**Exit:** Reordering or renaming a device never changes schedule ownership.

### Slice 6 — Mac operational service

**Scenario:** Move execution out of the interactive client into the Mac service.

Build/finish:
- durable configuration cache,
- startup/restart recovery,
- scheduler lifecycle,
- logging,
- retry/reconciliation behavior.

**Exit:** Mac restart with no Internet restores the correct desired state and future transitions from local data.

### Slice 7 — Firebase configuration synchronization

**Scenario:** Edit a schedule on iPhone and have the Mac adopt it.

Build/finish:
- Firestore adapter,
- versioned configuration schema,
- initial/incremental sync,
- completed-edit writes,
- sync/error state,
- defined conflict behavior.

**Exit:** After synchronization, WAN loss does not affect execution. Normal elapsed-time scheduling causes no Firestore traffic.

### Slice 8 — First real device transport

**Scenario:** Replace fake transport with a real local device.

Build/finish:
- chosen Shelly HTTP or Matter adapter,
- connection setup needed for that adapter,
- reachability/state/setPower,
- error/retry mapping.

**Exit:** The same executor tests/contracts used by the fake transport drive a physical device.

### Slice 9 — V1 hardening

- Background/service lifecycle testing.
- DST and timezone transition cases.
- Device unreachable/recovery cases.
- Corrupt/stale local cache behavior.
- Sync conflicts and schema migration.
- Accessibility.
- Portrait/landscape interaction.
- Installation/onboarding.
- Diagnostics adequate to explain “why is this device on/off?”

**Exit:** Release checklist passes without requiring cloud connectivity for routine execution.

## Explicitly deferred

These are not prerequisites for proving V1:
- Room taxonomy.
- Automatic grouping.
- Advanced analytics.
- Additional timeline views beyond Tonight.
- Arbitrary protocol proliferation.
- Sophisticated color semantics.
- Cloud-based schedule execution.
- Fine-grained realtime telemetry history unless a concrete diagnostic need appears.

## Development rule from this point

A new feature should answer four questions before implementation:

1. **Which feature boundary owns its semantics?**
2. **What is the authored/source-of-truth representation?**
3. **What observable behavior proves it works?**
4. **Which vertical slice introduces it?**

If those answers are unclear, prototype the uncertainty deliberately rather than allowing the UI implementation to make the architectural decision accidentally.
