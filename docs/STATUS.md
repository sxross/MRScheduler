# Project status and decisions

Last updated 2026-09-27.

## Current phase

Slices 0, 1, and 2 are complete. Slice 2 closed after passing native-iOS HITL on 2026-09-27. Slice 3 is next.

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

Slice 2 native HITL passed on 2026-09-27 on the iPhone 17 Pro Max simulator (iOS 27.0, Xcode 27, Expo Dev Client). It verified:

1. normal vertical scrolling,
2. schedule selection and editor presentation,
3. Clock → Astro,
4. astronomical event and offset editing,
5. Astro → Clock freezes the currently resolved wall-clock time,
6. persistence across restart,
7. portrait and landscape behavior.

The current web layout is intentionally simplified into separate natural-height sections (timeline, editor, upcoming events, schedules) to aid diagnosis. It should not be treated as final product presentation.

### iOS 27 scene life cycle

iOS 27 refuses to launch apps that have not adopted the UIScene life cycle. Expo SDK 57 ships `ExpoAppSceneDelegate`, but its prebuild template does not wire it up. `apps/mobile/plugins/withSceneLifecycle.js` does so at prebuild time, so the generated (gitignored) `ios/` project stays correct after `expo prebuild --clean`. Remove the plugin once Expo's template adopts scenes itself.

## Runtime architecture

The intended execution model remains:

```
iOS configuration UI
        |
        v
Firebase configuration sync
        |
        v
Local appliance scheduler service
        |
        v
SmartDeviceTransport
        |
        v
local smart device
```

Cloud synchronization is configuration transport, not the execution path. The appliance service must execute from durable local configuration when WAN/cloud connectivity is unavailable. Linux is the preferred production host for a dedicated always-on appliance; macOS remains a supported development/runtime environment.

## Engineering constraints

- Authored semantic schedules are authoritative.
- Authored and effective schedules remain distinct.
- The timeline uses one canonical time ↔ X transform.
- Production scheduling/application logic depends on an injected `Clock`; wall-clock reads and real sleeps belong only in clock adapters.
- Astronomical event identity is resolved before applying signed offsets.
- Native iOS is the interaction/HITL target; web remains a visual and build smoke-test surface.

## Next step

Slice 3 — multiple authored schedules and effective union (see `FEATURES.md`). Exit: ending one schedule cannot turn a device off while another still requires it ON. Start test-first in `packages/domain` and `packages/application` before UI work.
