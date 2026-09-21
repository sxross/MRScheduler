/**
 * Global guardrails: time-fences that bound when a transition may occur.
 *
 * A constraint is a *window*, not a single bound. "Nothing turns on after
 * sunrise" cannot be expressed as an upper bound alone -- that would still
 * permit an ON at 2pm, since 2pm precedes the next sunrise. Both edges are
 * required, and together they describe the permitted region the timeline draws.
 */
import type { Constraints, Location, TransitionKind } from '../model/types.js';
import { resolveEndpoint, type SolarDay } from './solarDay.js';

export type Verdict =
  /** No window fences this transition. */
  | { status: 'unfenced' }
  /** Inside the permitted window. */
  | { status: 'permitted'; window: { from: number; to: number } }
  /** Outside the window, but the schedule declares an exemption. */
  | { status: 'exempt'; window: { from: number; to: number } }
  /** Outside the window with no exemption: must not execute. */
  | { status: 'violation'; window: { from: number; to: number }; ordinal: number }
  /** The window's own anchors could not be computed (polar latitudes). */
  | { status: 'indeterminate'; reason: string };

export function evaluateTransition(
  kind: TransitionKind,
  ordinal: number,
  constraints: Constraints,
  exemptFrom: readonly TransitionKind[],
  day: SolarDay,
  location: Location,
): Verdict {
  const window = constraints[kind];
  if (!window) return { status: 'unfenced' };

  const from = resolveEndpoint({ kind: 'astro', ...window.from }, day, location);
  const to = resolveEndpoint({ kind: 'astro', ...window.to }, day, location);
  if (!from.ok) return { status: 'indeterminate', reason: from.reason };
  if (!to.ok) return { status: 'indeterminate', reason: to.reason };

  const bounds = { from: from.ordinal, to: to.ordinal };
  if (ordinal >= bounds.from && ordinal <= bounds.to) {
    return { status: 'permitted', window: bounds };
  }
  return exemptFrom.includes(kind)
    ? { status: 'exempt', window: bounds }
    : { status: 'violation', window: bounds, ordinal };
}

/** Whether a verdict allows the scheduler to act. Violations never execute. */
export function isPermitted(verdict: Verdict): boolean {
  return verdict.status !== 'violation' && verdict.status !== 'indeterminate';
}
