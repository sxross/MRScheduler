# ADR 0009: Native iOS is the authoritative interaction target

**Status:** Accepted

## Context

MRScheduler is implemented with Expo/React Native and can also render through React Native Web for rapid browser prototyping and GitHub Pages deployment.

During Slice 2, repeated mobile-browser HITL across Safari, Brave, and Chrome showed unstable scrolling/layout behavior. The behavior persisted after removing nested vertical scroll surfaces, eliminating React-side dynamic viewport subscriptions, removing dynamic viewport CSS units, disabling document overscroll, and simplifying the page into independent natural-height sections.

The scheduling domain, application layer, persistence, and timeline geometry are platform-independent and continue to test deterministically.

## Decision

Native iOS is the authoritative target for touch, scrolling, rotation, schedule editing, and other interaction HITL.

GitHub Pages remains supported as a visual review and CI smoke-test surface. Web-specific interaction defects should be recorded, but they do not define product interaction correctness unless web is explicitly brought into product scope.

The application remains React Native/Expo. This decision changes the conformance runtime, not the application architecture.

## Consequences

- Portrait and landscape HITL are performed on iOS Simulator and/or physical iPhone.
- Expo Dev Client and Xcode are the native development/run toolchain.
- Linux CI continues to run domain/application/timeline tests, TypeScript checks, and the web export smoke test.
- Native CI can be added later when its cost and release value justify it.
- Web prototype layout may remain deliberately simplified while native product interaction evolves.
