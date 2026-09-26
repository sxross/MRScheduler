# ADR 0002: Authored and effective intervals are distinct

**Status:** Accepted

## Context
Multiple schedules for one device can overlap, and governed schedules can be adjusted by astronomical constraints. The resulting device-on interval may therefore differ from any single interval the user authored.

## Decision
Treat authored schedules and effective intervals as separate domain concepts.

Users edit authored schedules. The resolver derives effective intervals by applying constraints and union/overlap semantics. Effective intervals must retain enough provenance to identify the contributing authored schedules and any adjustments.

The UI must not silently convert an effective interval back into authored schedule data.

## Consequences
- A displayed effective bar may correspond to more than one authored schedule.
- Direct manipulation is permitted only when the edit target is unambiguous, or after the UI explicitly chooses an authored schedule.
- Resolver behavior remains deterministic and testable independently of presentation.
