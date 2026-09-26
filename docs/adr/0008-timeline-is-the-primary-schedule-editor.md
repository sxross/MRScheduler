# ADR 0008: The timeline is the primary schedule editor

**Status:** Accepted

## Context
The prototype established that users can understand schedules more naturally as intervals than as separate ON and OFF events. Direct manipulation also exposes schedule relationships and overlaps immediately.

## Decision
The timeline is not merely a visualization of schedules; it is the primary scheduling editor.

A device is represented as a track and an authored interval as an editable clip. Selection exposes editing affordances. Endpoint movement is continuous and precise rather than quantized to arbitrary coarse increments. Optional magnetic snapping may later assist alignment without becoming the stored scheduling model.

Text selection and other browser-document behavior should be disabled by default in the application UI; controls that genuinely require text interaction may opt back in.

## Consequences
- Timeline interaction is product behavior and receives domain/interaction tests, not just visual tests.
- Touch targets must be forgiving even when the visual handle is small.
- Web prototype behavior should approximate the intended native interaction, while native implementations may add platform gestures and haptics.
- Detailed forms may supplement direct manipulation for precise or semantic endpoint editing.
