import { describe, expect, it } from 'vitest';
import { effectiveOrdinal, evaluateTransition } from '../src/scheduling/constraints';
import { resolveEndpoint, solarDay } from '../src/scheduling/solarDay';
import type { Endpoint, ScheduleKind, TransitionKind } from '../src/model/types';
import { FENCES, LA } from './fixtures';

// 2026-01-15 in Los Angeles: sunset 17:07, dusk 17:34, sunrise 06:59 (next day).
// Fences: ON permitted [dusk, sunrise - 15m] = [335, 1124]
//         OFF permitted [dusk + 20m, sunrise + 60m] = [355, 1199]
const day = solarDay('2026-01-15', LA);

function verdict(kind: TransitionKind, endpoint: Endpoint, scheduleKind: ScheduleKind = 'governed') {
  const r = resolveEndpoint(endpoint, day, LA);
  if (!r.ok) throw new Error(r.reason);
  return evaluateTransition(kind, r.ordinal, FENCES, scheduleKind, day, LA);
}

describe('governed schedules are clamped into their window', () => {
  it('leaves an OFF the morning after the ON alone, which a calendar day would reject', () => {
    // sunrise + 30m is 07:29 -- earlier on the clock than the dusk + 20m lower
    // bound, but later in the night. This is the case the noon axis exists for.
    expect(verdict('off', { kind: 'astro', event: 'sunrise', offsetMinutes: 30 }).status).toBe('within');
  });

  it('pushes a pre-dusk ON forward so lights never come on in daylight', () => {
    const v = verdict('on', { kind: 'astro', event: 'sunset', offsetMinutes: -20 });
    expect(v.status).toBe('clamped');
    expect(v.status === 'clamped' && v.bound).toBe('from');
    expect(v.status === 'clamped' && Math.round(v.requested)).toBe(288); // 16:47
    expect(Math.round(effectiveOrdinal(v)!)).toBe(335); // dusk, 17:34
  });

  it('pulls a late OFF back so lights never stay on past the morning fence', () => {
    const v = verdict('off', { kind: 'absolute', minutesOfDay: 9 * 60 });
    expect(v.status === 'clamped' && v.bound).toBe('to');
    expect(Math.round(effectiveOrdinal(v)!)).toBe(1199); // sunrise + 60m, 07:59
  });

  it('clamps a daytime ON, which an upper bound alone would wave through', () => {
    // 2pm precedes the next sunrise, so a lone "not after sunrise - 15m" bound
    // would permit it. The window's lower bound is what catches it.
    const v = verdict('on', { kind: 'absolute', minutesOfDay: 14 * 60 });
    expect(v.status === 'clamped' && v.bound).toBe('from');
  });

  it('treats exact equality with a fence as already inside it', () => {
    expect(verdict('on', { kind: 'astro', event: 'dusk', offsetMinutes: 0 }).status).toBe('within');
    expect(verdict('on', { kind: 'astro', event: 'sunrise', offsetMinutes: -15 }).status).toBe('within');
    expect(verdict('off', { kind: 'astro', event: 'dusk', offsetMinutes: 20 }).status).toBe('within');
  });

  it('reports both requested and effective positions so the UI can show the move', () => {
    const v = verdict('on', { kind: 'absolute', minutesOfDay: 14 * 60 });
    expect(v.status === 'clamped' && Math.round(v.requested)).toBe(120);
    expect(v.status === 'clamped' && Math.round(v.window.from)).toBe(335);
    expect(v.status === 'clamped' && Math.round(v.window.to)).toBe(1124);
  });
});

describe('ad-hoc schedules ignore the fences', () => {
  it('passes a daytime ON through untouched', () => {
    const v = verdict('on', { kind: 'absolute', minutesOfDay: 14 * 60 }, 'adhoc');
    expect(v.status).toBe('unfenced');
    expect(Math.round(effectiveOrdinal(v)!)).toBe(120);
  });

  it('passes a morning OFF through untouched', () => {
    const v = verdict('off', { kind: 'absolute', minutesOfDay: 9 * 60 }, 'adhoc');
    expect(v.status).toBe('unfenced');
    expect(Math.round(effectiveOrdinal(v)!)).toBe(1260);
  });
});

describe('unfenced transitions', () => {
  it('leaves a governed schedule alone when no window is configured', () => {
    const r = resolveEndpoint({ kind: 'absolute', minutesOfDay: 14 * 60 }, day, LA);
    if (!r.ok) throw new Error(r.reason);
    expect(evaluateTransition('on', r.ordinal, {}, 'governed', day, LA).status).toBe('unfenced');
  });
});
