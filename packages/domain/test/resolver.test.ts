import { describe, expect, it } from 'vitest';
import { adjustmentsOf, mergeIntervals, resolveDay } from '../src/scheduling/resolver.js';
import { solarDay } from '../src/scheduling/solarDay.js';
import type { Schedule } from '../src/model/types.js';
import { config, EVERY_DAY, FENCES, LA, TROMSO } from './fixtures.js';

// 2026-01-15 is a Thursday; its solar day closes on Friday morning.
const day = solarDay('2026-01-15', LA);
const june = solarDay('2026-06-15', LA);

function schedule(partial: Partial<Schedule> & Pick<Schedule, 'id' | 'deviceId'>): Schedule {
  return {
    enabled: true,
    on: { kind: 'astro', event: 'dusk', offsetMinutes: 0 },
    off: { kind: 'astro', event: 'sunrise', offsetMinutes: 30 },
    days: EVERY_DAY,
    ...partial,
  };
}

describe('day-of-week selection', () => {
  it('keys a midnight-spanning cycle to the day its ON edge falls on', () => {
    const thursday = resolveDay(
      config({ schedules: { s: schedule({ id: 's', deviceId: 'porch', days: ['thu'] }) } }),
      day,
    );
    expect(thursday.cycles).toHaveLength(1);

    // The OFF edge lands on Friday, but selecting Friday must not match it.
    const friday = resolveDay(
      config({ schedules: { s: schedule({ id: 's', deviceId: 'porch', days: ['fri'] }) } }),
      day,
    );
    expect(friday.cycles).toHaveLength(0);
  });
});

describe('resolution', () => {
  it('skips disabled schedules and disabled devices', () => {
    const off = resolveDay(
      config({ schedules: { s: schedule({ id: 's', deviceId: 'porch', enabled: false }) } }),
      day,
    );
    expect(off.cycles).toHaveLength(0);

    const c = config({ schedules: { s: schedule({ id: 's', deviceId: 'porch' }) } });
    c.devices['porch']!.enabled = false;
    expect(resolveDay(c, day).cycles).toHaveLength(0);
  });

  it('keeps the requested time alongside the clamped one', () => {
    const c = config({
      constraints: FENCES,
      schedules: {
        s: schedule({ id: 's', deviceId: 'porch', on: { kind: 'astro', event: 'sunset', offsetMinutes: -20 } }),
      },
    });
    const [cycle] = resolveDay(c, day).cycles;
    expect(cycle?.executable).toBe(true);
    expect(cycle?.on.requestedAt.toFormat('HH:mm')).toBe('16:47');
    expect(cycle?.on.at.toFormat('HH:mm')).toBe('17:34');
  });

  it('surfaces every adjustment it made', () => {
    const c = config({
      constraints: FENCES,
      schedules: {
        s: schedule({
          id: 's',
          deviceId: 'porch',
          on: { kind: 'astro', event: 'sunset', offsetMinutes: -20 },
          off: { kind: 'absolute', minutesOfDay: 9 * 60 },
        }),
      },
    });
    const adjustments = adjustmentsOf(resolveDay(c, day).cycles);
    expect(adjustments.map((a) => a.transition)).toEqual(['on', 'off']);
    expect(adjustments[0]).toMatchObject({ bound: 'from' });
    expect(adjustments[1]?.effectiveAt.toFormat('HH:mm')).toBe('07:59');
  });

  it('clamps seasonally: the same rule moves as sunrise moves', () => {
    const c = config({
      constraints: FENCES,
      schedules: {
        s: schedule({
          id: 's',
          deviceId: 'kitchen',
          on: { kind: 'absolute', minutesOfDay: 6 * 60 },
          off: { kind: 'absolute', minutesOfDay: 7 * 60 },
        }),
      },
    });
    // January: sunrise 06:59, so a 6am ON is comfortably inside the window.
    expect(resolveDay(c, day).cycles[0]?.on.at.toFormat('HH:mm')).toBe('06:00');
    // June: sunrise 05:42, so the same rule is pulled back to sunrise - 15m.
    expect(resolveDay(c, june).cycles[0]?.on.at.toFormat('HH:mm')).toBe('05:27');
  });

  it('runs an ad-hoc schedule exactly as drawn in both seasons', () => {
    const c = config({
      constraints: FENCES,
      schedules: {
        s: schedule({
          id: 's',
          deviceId: 'kitchen',
          kind: 'adhoc',
          on: { kind: 'absolute', minutesOfDay: 6 * 60 },
          off: { kind: 'absolute', minutesOfDay: 9 * 60 },
        }),
      },
    });
    for (const d of [day, june]) {
      const [cycle] = resolveDay(c, d).cycles;
      expect(cycle?.on.at.toFormat('HH:mm')).toBe('06:00');
      expect(cycle?.off.at.toFormat('HH:mm')).toBe('09:00');
      expect(adjustmentsOf(resolveDay(c, d).cycles)).toHaveLength(0);
    }
  });

  it('blocks a cycle that clamping would invert rather than wrapping it', () => {
    const c = config({
      // Pathological fences: ON pinned to dusk, OFF pinned an hour earlier.
      constraints: {
        on: { from: { event: 'dusk', offsetMinutes: 0 }, to: { event: 'dusk', offsetMinutes: 0 } },
        off: { from: { event: 'dusk', offsetMinutes: -60 }, to: { event: 'dusk', offsetMinutes: -60 } },
      },
      schedules: {
        s: schedule({
          id: 's',
          deviceId: 'porch',
          on: { kind: 'absolute', minutesOfDay: 18 * 60 },
          off: { kind: 'absolute', minutesOfDay: 19 * 60 },
        }),
      },
    });
    const r = resolveDay(c, day);
    expect(r.cycles).toHaveLength(0);
    expect(r.unresolved[0]).toMatchObject({ scheduleId: 's', collapsed: true });
  });

  it('reports polar unresolvability instead of inventing a time', () => {
    const c = config({ location: TROMSO, schedules: { s: schedule({ id: 's', deviceId: 'porch' }) } });
    const r = resolveDay(c, solarDay('2025-12-21', TROMSO));
    expect(r.cycles).toHaveLength(0);
    expect(r.unresolved[0]?.reason).toContain('does not occur');
    expect(r.unresolved[0]?.collapsed).toBe(false);
  });
});

describe('overlapping schedules', () => {
  const overlapping = config({
    schedules: {
      porchEvening: schedule({
        id: 'porchEvening',
        deviceId: 'porch',
        on: { kind: 'astro', event: 'dusk', offsetMinutes: 0 },
        off: { kind: 'absolute', minutesOfDay: 23 * 60 },
      }),
      porchLate: schedule({
        id: 'porchLate',
        deviceId: 'porch',
        on: { kind: 'absolute', minutesOfDay: 22 * 60 },
        off: { kind: 'astro', event: 'sunrise', offsetMinutes: 30 },
      }),
    },
  });

  it('unions overlapping cycles into a single ON interval', () => {
    const intervals = mergeIntervals(resolveDay(overlapping, day).cycles);
    expect(intervals).toHaveLength(1);
    expect(intervals[0]?.scheduleIds).toEqual(['porchEvening', 'porchLate']);
    // Opens at dusk (17:34), closes at sunrise + 30m (07:29) the next morning.
    expect(Math.round(intervals[0]!.start)).toBe(335);
    expect(Math.round(intervals[0]!.end)).toBe(1169);
  });

  it('keeps disjoint cycles separate', () => {
    const c = config({
      schedules: {
        early: schedule({
          id: 'early',
          deviceId: 'porch',
          on: { kind: 'absolute', minutesOfDay: 18 * 60 },
          off: { kind: 'absolute', minutesOfDay: 19 * 60 },
        }),
        late: schedule({
          id: 'late',
          deviceId: 'porch',
          on: { kind: 'absolute', minutesOfDay: 22 * 60 },
          off: { kind: 'absolute', minutesOfDay: 23 * 60 },
        }),
      },
    });
    expect(mergeIntervals(resolveDay(c, day).cycles)).toHaveLength(2);
  });

  it('merges a governed and an ad-hoc schedule on the same device', () => {
    const c = config({
      constraints: FENCES,
      schedules: {
        overnight: schedule({ id: 'overnight', deviceId: 'kitchen' }),
        morning: schedule({
          id: 'morning',
          deviceId: 'kitchen',
          kind: 'adhoc',
          on: { kind: 'absolute', minutesOfDay: 7 * 60 },
          off: { kind: 'absolute', minutesOfDay: 9 * 60 },
        }),
      },
    });
    const intervals = mergeIntervals(resolveDay(c, day).cycles);
    // Overnight runs dusk -> 07:29; the ad-hoc morning cycle extends it to 09:00.
    expect(intervals).toHaveLength(1);
    expect(Math.round(intervals[0]!.end)).toBe(1260);
  });

  it('keeps devices independent', () => {
    const c = config({
      schedules: {
        a: schedule({ id: 'a', deviceId: 'porch' }),
        b: schedule({ id: 'b', deviceId: 'kitchen' }),
      },
    });
    const intervals = mergeIntervals(resolveDay(c, day).cycles);
    expect(intervals.map((i) => i.deviceId).sort()).toEqual(['kitchen', 'porch']);
  });
});
