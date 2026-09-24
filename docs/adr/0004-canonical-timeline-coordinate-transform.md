# ADR 0004: One canonical timeline coordinate transform

**Status:** Accepted

## Context
Prototype work exposed geometry bugs when ruler positions, rendered intervals, and pointer editing used related but independent calculations.

## Decision
Timeline geometry has one canonical transform between time and horizontal position. Rendering, hit testing, dragging, labels, astronomical markers, and inverse position-to-time editing use that transform or functions derived directly from it.

The transform must account for plot insets explicitly. Time-to-X and X-to-time should be tested as inverse operations within expected rounding precision.

## Consequences
- UI components do not invent their own timeline arithmetic.
- Geometry remains a pure, testable package separate from React rendering.
- Changes to margins or layout cannot silently alter schedule semantics.
