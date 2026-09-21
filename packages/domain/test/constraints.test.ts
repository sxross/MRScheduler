import { describe, expect, it } from 'vitest';
import { evaluateTransition } from '../src/scheduling/constraints.js';
import { resolveEndpoint, solarDay } from '../src/scheduling/solarDay.js';
import type { Endpoint, TransitionKind } from '../src/model/types.js';
import { FENCES, PORTLAND } from './fixtures.js';

// 2026-01-15 in Portland: sunset 16:54, dusk 17:27, sunrise 07:47 (next day).
// Fences: ON permitted [dusk, sunrise - 15m]; OFF permitted [dusk + 20m, sunrise + 60m].
const day = solarDay('2026-01-15', PORTLAND);

function verdict(kind: TransitionKind, endpoint: Endpoint, exempt: TransitionKind[] = []) {
  const r = resolveEndpoint(endpoint, day, PORTLAND);
  if (!r.ok) throw new Error(r.reason);
  return evaluateTransition(kind, r.ordinal, FENCES, exempt, day, PORTLAND);
}

describe('astronomical time-fences', () => {
  it('permits an OFF the morning after the ON, which a calendar day would reject', () => {
    // sunrise + 30m is 07:17 -- earlier on the clock than the dusk + 20m lower
    // bound, but later in the night. This is the case the noon axis exists for.
    expect(verdict('off', { kind: 'astro', event: 'sunrise', offsetMinutes: 30 }).status).toBe('permitted');
  });

  it('rejects an afternoon OFF as before the earliest permitted OFF', () => {
    expect(verdict('off', { kind: 'absolute', minutesOfDay: 16 * 60 }).status).toBe('violation');
  });

  it('rejects a daytime ON, which an upper bound alone would permit', () => {
    // 2pm precedes the next sunrise, so a lone "not after sunrise - 15m" bound
    // would wave this through. The window's lower bound is what catches it.
    expect(verdict('on', { kind: 'absolute', minutesOfDay: 14 * 60 }).status).toBe('violation');
  });

  it('rejects an ON before dusk even when it is after sunset', () => {
    // The PRD's own porch example: sunset - 20m sits 53 minutes before dusk.
    expect(verdict('on', { kind: 'astro', event: 'sunset', offsetMinutes: -20 }).status).toBe('violation');
  });

  it('treats exact equality with a fence as permitted', () => {
    expect(verdict('on', { kind: 'astro', event: 'dusk', offsetMinutes: 0 }).status).toBe('permitted');
    expect(verdict('on', { kind: 'astro', event: 'sunrise', offsetMinutes: -15 }).status).toBe('permitted');
    expect(verdict('off', { kind: 'astro', event: 'dusk', offsetMinutes: 20 }).status).toBe('permitted');
  });

  it('reports the window bounds so the UI can explain the rejection', () => {
    const v = verdict('on', { kind: 'absolute', minutesOfDay: 14 * 60 });
    expect(v.status === 'violation' && Math.round(v.window.from)).toBe(327);
    expect(v.status === 'violation' && Math.round(v.ordinal)).toBe(120);
  });

  it('honours an exemption for the named transition only', () => {
    const early: Endpoint = { kind: 'absolute', minutesOfDay: 16 * 60 };
    expect(verdict('off', early, ['off']).status).toBe('exempt');
    expect(verdict('off', early, ['on']).status).toBe('violation');
  });

  it('leaves an unfenced transition alone', () => {
    const r = resolveEndpoint({ kind: 'absolute', minutesOfDay: 14 * 60 }, day, PORTLAND);
    if (!r.ok) throw new Error(r.reason);
    expect(evaluateTransition('on', r.ordinal, {}, [], day, PORTLAND).status).toBe('unfenced');
  });
});
