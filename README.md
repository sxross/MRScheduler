# MRScheduler

Astronomically-aware scheduling for Meross smart plugs. Schedules are stored as
intent (`sunset - 20m`), never as derived clock times, and are executed locally
so the house keeps working when the Internet does not.

## Layout

```
packages/domain/     pure TypeScript scheduling engine -- no React, Firebase,
                     Meross or platform APIs, so it is testable in isolation
```

## Key design decisions

**Constraints are windows, not bounds.** A global guardrail such as "nothing
turns on after sunrise" cannot be a single upper bound: 2pm precedes the next
sunrise, so a lone bound would wave a daytime ON straight through. Each fence
is therefore a permitted window anchored at two astronomical events, which is
also what the timeline draws.

**The engine evaluates on a noon-origin axis.** Cycles routinely straddle
midnight -- "on at dusk, off at sunrise + 30m" is continuous, yet on a
midnight-origin clock its OFF edge sorts before its ON edge. The solar day runs
local noon to local noon, so dusk, midnight and the following sunrise increase
monotonically and every constraint check is a plain interval comparison. Day of
week keys off the ON edge, so "Friday" means the cycle starting Friday evening.

**There are two buckets of schedule.** A `governed` schedule lives inside the
fences: its endpoints are clamped into the permitted window, so lights never
come on in daylight or stay on past the morning bound, and the effective times
drift with the seasons. An `adhoc` schedule is astronomically unaware and runs
exactly as drawn -- morning kitchen lighting, for instance.

**Clamping is never silent.** Every adjusted edge keeps both the requested and
the effective time, and the event queue reports the adjustments it made. The one
case that cannot be clamped -- where the fences would invert a cycle, leaving no
time to run -- is reported as blocked rather than wrapped into a 24-hour ON.

## Architecture

The Mac runs a `launchd` daemon holding the scheduler, its local configuration
cache and the Meross LAN transport. A GUI layers on top of it over a local API
rather than embedding it, so the house keeps running whether or not anything is
on screen. Firebase Realtime Database synchronises configuration between the
daemon and the iOS client; it never executes anything.

## Development

```
npm install
npm test
npm run typecheck
```
