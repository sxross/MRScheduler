# ADR 0001: Semantic schedules are authoritative

**Status:** Accepted

## Context
MRScheduler supports absolute clock times and astronomical endpoints such as sunset plus or minus an offset. Astronomical clock times vary by date and location.

## Decision
Persist the user's scheduling intent, not a calculated clock-time snapshot. An endpoint such as `sunset - 20 minutes` remains an astronomical endpoint with its offset. Absolute endpoints remain absolute local-time values.

Calculated times are projections for a particular date and location and are never silently written back as authored schedules.

Astronomical event identity is resolved before applying its signed offset. Offsets may legitimately move the resulting instant across midnight, across the noon-to-noon timeline boundary, or outside the currently displayed solar day. These are not merely pathological edge cases: at high and polar latitudes, astronomical events can occur at extreme local times, making large boundary-crossing offsets a normal consequence of the model. The offset must never cause evaluation to switch silently to a different sunrise, sunset, dawn, or dusk occurrence.

## Consequences
- Schedules retain their meaning as daylight changes.
- The domain model must distinguish absolute and astronomical endpoint kinds.
- UI editing must preserve endpoint identity unless the user explicitly changes its kind.
- Evaluation requires date, location, and timezone context.
