/**
 * Global guardrails: time-fences that bound when a transition may occur.
 *
 * A constraint is a *window*, not a single bound. "Nothing turns on after
 * sunrise" cannot be expressed as an upper bound alone -- that would still
 * permit an ON at 2pm, since 2pm precedes the next sunrise. Both edges are
 * required, and together they describe the permitted region the timeline draws.
 *
 * Governed schedules are clamped into their window rather than rejected: the
 * user draws "on in the evening" and the effective time tracks the astronomical
 * clock through the year. Clamping is never silent -- the verdict carries both
 * the requested and effective times so the UI and diagnostics can show the
 * adjustment. Ad-hoc schedules are astronomically unaware and pass through.
 */
import type { Constraints, Location, ScheduleKind, TransitionKind } from '../model/types';
import { resolveEndpoint, type SolarDay } from './solarDay';

export interface WindowBounds {
  from: number;
  to: number;
}

export type Verdict =
  /** Ad-hoc schedule, or no window fences this transition. */
  | { status: 'unfenced'; ordinal: number }
  /** Already inside the permitted window; nothing adjusted. */
  | { status: 'within'; window: WindowBounds; ordinal: number }
  /** Moved to the nearest edge of the permitted window. */
  | {
      status: 'clamped';
      window: WindowBounds;
      requested: number;
      ordinal: number;
      bound: 'from' | 'to';
    }
  /** The window's own anchors could not be computed (polar latitudes). */
  | { status: 'indeterminate'; reason: string };

export function evaluateTransition(
  kind: TransitionKind,
  requested: number,
  constraints: Constraints,
  scheduleKind: ScheduleKind,
  day: SolarDay,
  location: Location,
): Verdict {
  const window = constraints[kind];
  if (scheduleKind === 'adhoc' || !window) return { status: 'unfenced', ordinal: requested };

  const from = resolveEndpoint({ kind: 'astro', ...window.from }, day, location);
  const to = resolveEndpoint({ kind: 'astro', ...window.to }, day, location);
  if (!from.ok) return { status: 'indeterminate', reason: from.reason };
  if (!to.ok) return { status: 'indeterminate', reason: to.reason };

  const bounds = { from: from.ordinal, to: to.ordinal };
  if (requested < bounds.from) {
    return { status: 'clamped', window: bounds, requested, ordinal: bounds.from, bound: 'from' };
  }
  if (requested > bounds.to) {
    return { status: 'clamped', window: bounds, requested, ordinal: bounds.to, bound: 'to' };
  }
  return { status: 'within', window: bounds, ordinal: requested };
}

/** The position the scheduler will actually act on, or null if uncomputable. */
export function effectiveOrdinal(verdict: Verdict): number | null {
  return verdict.status === 'indeterminate' ? null : verdict.ordinal;
}
