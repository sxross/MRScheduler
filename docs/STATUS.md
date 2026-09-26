# Project status and decisions

Last updated 2026-09-25.

## Current phase

Slices 0 and 1 are complete. Slice 2 has its domain/application work implemented and is awaiting authoritative native-iOS HITL before closure.

The browser prototype remains deployed for quick visual review and CI smoke testing, but mobile web is no longer the interaction-conformance target. Repeated testing across Safari, Brave, and Chrome showed unstable mobile-web scrolling/layout behavior even after removing nested scroll surfaces, dynamic viewport subscriptions, dynamic viewport units, and after simplifying the page into independent natural-height sections.

Native iOS is therefore the authoritative surface for interaction testing.

## What is built

- `packages/domain` — pure TypeScript scheduling engine.
- `packages/timeline` — pure noon-to-noon timeline geometry.
- `packages/application` — persistence boundary, mutations, injected clock, scheduler engine, fake transport, and test fakes.
- `apps/mobile` — Expo/React Native client with local persistence, timeline, upcoming events, schedule list, and endpoint editor.

Slice 1 proves one absolute authored schedule can be created, edited, persisted, reconstructed after restart, and deterministically execute against a fake transport.

Slice 2 adds astronomical endpoint identity and signed-offset editing. Tests prove that an authored rule such as `sunset - 20m` remains semantic while its resolved wall-clock time changes by date. Astronomical occurrence identity is selected before applying the offset, including offsets that cross midnight or the noon-to-noon display boundary. These are valid operational cases, especially at high and polar latitudes.

## Interaction validation

The next authoritative HITL pass will run the same Expo/React Native client on iOS through Xcode / Expo Dev Client.

The Slice 2 native HITL should verify:

1. normal vertical scrolling,
2. schedule selection and editor presentation,
3. Clock → Astro,
4. astronomical event and offset editing,
5. Astro → Clock freezes the currently resolved wall-clock time,
6. persistence across restart,
7. portrait and landscape behavior.

The current web layout is intentionally simplified into separate natural-height sections (timeline, editor, upcoming events, schedules) to aid diagnosis. It should not be treated as final product presentation.

## Runtime architecture

The intended execution model remains:

```
iOS configuration UI
        |
        v
Firebase configuration sync
        |
        v
Mac local scheduler service
        |
        v
SmartDeviceTransport
        |
        v
local smart device
```

Cloud synchronization is configuration transport, not the execution path. The Mac service must execute from durable local configuration when WAN/cloud connectivity is unavailable.

## Engineering constraints

- Authored semantic schedules are authoritative.
- Authored and effective schedules remain distinct.
- The timeline uses one canonical time ↔ X transform.
- Production scheduling/application logic depends on an injected `Clock`; wall-clock reads and real sleeps belong only in clock adapters.
- Astronomical event identity is resolved before applying signed offsets.
- Native iOS is the interaction/HITL target; web remains a visual and build smoke-test surface.

## Next step

Pull `main` on the Mac, install dependencies, generate/build the iOS app with Expo/Xcode, and perform the Slice 2 native HITL. If native scrolling and editing behave correctly, close Slice 2 and proceed to Slice 3.
