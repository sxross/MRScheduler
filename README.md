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

**Exemptions are declared, not silent.** A schedule may name the fences it is
excused from (`exemptFrom: ['on']`) -- for kitchen lighting that is meant to run
in the morning. Diagnostics and summaries name the exemption, so a hard
constraint is still never silently violated.

**Nothing is silently rewritten.** A cycle that violates a fence is reported as
a conflict with its resolved times and the window it missed. It never executes,
and it is never adjusted to fit.

## Development

```
npm install
npm test
npm run typecheck
```
