import { describe, expect, it } from 'vitest';
import { mergeIntervals, resolveDay } from '../src/scheduling/resolver.js';
import { solarDay } from '../src/scheduling/solarDay.js';
import type { Schedule } from '../src/model/types.js';
import { config, EVERY_DAY, FENCES, PORTLAND, TROMSO } from './fixtures.js';

// 2026-01-15 is a Thursday; its solar day closes on Friday morning.
const day = solarDay('2026-01-15', PORTLAND);

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

  it('marks a fence-violating cycle unexecutable without rewriting it', () => {
    const c = config({
      constraints: FENCES,
      schedules: {
        s: schedule({ id: 's', deviceId: 'porch', on: { kind: 'astro', event: 'sunset', offsetMinutes: -20 } }),
      },
    });
    const [cycle] = resolveDay(c, day).cycles;
    expect(cycle?.executable).toBe(false);
    // Intent is preserved: the endpoint still resolves to the user's time.
    expect(cycle?.on.at.toFormat('HH:mm')).toBe('16:34');
  });

  it('lets an exemption make an otherwise blocked cycle executable', () => {
    const c = config({
      constraints: FENCES,
      schedules: {
        s: schedule({
          id: 's',
          deviceId: 'kitchen',
          on: { kind: 'absolute', minutesOfDay: 6 * 60 },
          off: { kind: 'absolute', minutesOfDay: 9 * 60 },
          exemptFrom: ['on', 'off'],
        }),
      },
    });
    expect(resolveDay(c, day).cycles[0]?.executable).toBe(true);
  });

  it('reports polar unresolvability instead of inventing a time', () => {
    const c = config({ location: TROMSO, schedules: { s: schedule({ id: 's', deviceId: 'porch' }) } });
    const r = resolveDay(c, solarDay('2025-12-21', TROMSO));
    expect(r.cycles).toHaveLength(0);
    expect(r.unresolved[0]?.reason).toContain('does not occur');
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
    // Opens at dusk (17:27), closes at sunrise + 30m (08:17) the next morning.
    expect(Math.round(intervals[0]!.start)).toBe(327);
    expect(Math.round(intervals[0]!.end)).toBe(1218);
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

  it('excludes unexecutable cycles from the union', () => {
    const c = config({
      constraints: FENCES,
      schedules: {
        good: schedule({ id: 'good', deviceId: 'porch' }),
        blocked: schedule({
          id: 'blocked',
          deviceId: 'porch',
          on: { kind: 'absolute', minutesOfDay: 14 * 60 },
          off: { kind: 'absolute', minutesOfDay: 15 * 60 },
        }),
      },
    });
    const intervals = mergeIntervals(resolveDay(c, day).cycles);
    expect(intervals).toHaveLength(1);
    expect(intervals[0]?.scheduleIds).toEqual(['good']);
  });
});
