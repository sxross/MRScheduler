# MRScheduler Agent Instructions

## Project

MRScheduler is a React/TypeScript + React Native application for controlling home-lighting schedules. Native iOS is the authoritative interaction and HITL target. GitHub Pages remains a useful visual/smoke-test surface, but mobile-web behavior is not the interaction conformance target.

## Product principles

- Schedule geometry must be mathematically derived from the displayed time scale. Do not independently position labels and controls.
- Touch interaction is a primary target.
- Prefer native-feeling controls and interactions over clever custom gesture handling.
- Portrait and landscape layouts must both work.
- Avoid text selection during control interaction.
- Continuous dragging is preferred. Do not introduce snapping unless explicitly requested.
- Preserve useful space for the schedule scale and controls; avoid unnecessary dead space.
- Favor usability and natural interaction over merely making the geometry arithmetically correct.

## Engineering principles

- Observe SOLID principles.
- Keep responsibilities clear and components focused.
- Prefer simple, maintainable solutions over unnecessary abstraction.
- Preserve existing behavior unless the task explicitly calls for changing it.
- Do not change the schedule data model merely to solve presentation or interaction problems.
- Keep schedule geometry and its visual representation driven by a single source of truth.
- Avoid duplicating derived state or layout calculations when they can be centralized.
- Application and scheduling code must obtain current time and schedule waits through the `Clock` abstraction. Direct wall-clock reads and real sleeps belong only in clock adapters; tests should use controllable time.

## Verification

Before considering a change complete:

- Run the existing test suite and resolve regressions caused by the change.
- Run the production build and resolve TypeScript/build errors.
- Verify that GitHub Pages deployment behavior remains intact as a smoke test.
- For schedule UI changes, verify both portrait and landscape behavior on native iOS.
- For interaction changes, verify touch/scroll behavior on native iOS. Web interaction issues should be recorded, but should not override correct native behavior unless the web surface is explicitly in scope.
