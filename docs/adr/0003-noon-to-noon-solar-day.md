# ADR 0003: Use a noon-to-noon solar day for the primary timeline

**Status:** Accepted

## Context
The primary use case is evening-through-morning scheduling. A conventional midnight-to-midnight timeline splits common intervals such as sunset through sunrise across a boundary.

## Decision
The primary schedule timeline represents a 24-hour solar day from local noon to the following local noon.

Time-to-position and position-to-time conversion belong to the timeline geometry layer. Intervals crossing the displayed boundaries are clipped for presentation without changing their underlying schedule semantics.

## Consequences
- Evening, midnight, and morning form one continuous visual span.
- The timeline must correctly handle DST and local timezone behavior.
- Other future views may use different temporal windows without changing schedule semantics.
