import { describe, expect, it } from 'vitest';
import type { Configuration, Schedule } from '@mrscheduler/domain';
import { buildTimeline } from '../src/layout';
import { clockLabel, minutesOfDayAt, ordinalAtX, snap, xOfOrdinal } from '../src/scale';

const LA = { latitude: 34.05, longitude: -118.24, timezone: 'America/Los_Angeles' };
const EVERY_DAY: Schedule['days'] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// 375px plot inside a 407px viewport keeps the arithmetic easy to read.
const viewport = { width: 407, padding: 16, rowHeight: 56, headerHeight: 72 };

const porch: Schedule = {
  id: 'porchEvening',
  deviceId: 'porch',
  enabled: true,
  on: { kind: 'astro', event: 'dusk', offsetMinutes: 0 },
  off: { kind: 'astro', event: 'sunrise', offsetMinutes: 30 },
  days: EVERY_DAY,
};

const config: Configuration = {
  location: LA,
  devices: {
    porch: { id: 'porch', name: 'Porch Lights', enabled: true },
    kitchen: { id: 'kitchen', name: 'Kitchen', enabled: true },
  },
  schedules: { porchEvening: porch },
  constraints: {
    on: { from: { event: 'dusk', offsetMinutes: 0 }, to: { event: 'sunrise', offsetMinutes: -15 } },
    off: { from: { event: 'dusk', offsetMinutes: 20 }, to: { event: 'sunrise', offsetMinutes: 60 } },
  },
};

describe('the noon-origin scale', () => {
  it('puts noon at the left edge and midnight in the centre', () => {
    expect(xOfOrdinal(0, viewport)).toBe(16);
    expect(xOfOrdinal(720, viewport)).toBe(16 + 375 / 2);
    expect(xOfOrdinal(1440, viewport)).toBe(391);
  });

  it('labels ordinals on the wall clock', () => {
    expect(clockLabel(0)).toBe('12:00 PM');
    expect(clockLabel(335)).toBe('5:35 PM');
    expect(clockLabel(720)).toBe('12:00 AM');
    expect(clockLabel(1139)).toBe('6:59 AM');
  });

  it('round-trips a position through the inverse mapping', () => {
    for (const ordinal of [0, 335, 720, 1139, 1440]) {
      expect(ordinalAtX(xOfOrdinal(ordinal, viewport), viewport)).toBeCloseTo(ordinal, 6);
    }
  });

  it('wraps minutes-of-day correctly at both ends', () => {
    expect(minutesOfDayAt(0)).toBe(720);
    expect(minutesOfDayAt(720)).toBe(0);
    expect(minutesOfDayAt(1440)).toBe(720);
  });

  it('snaps to the grid without escaping the day', () => {
    expect(snap(333)).toBe(335);
    expect(snap(-20)).toBe(0);
    expect(snap(1500)).toBe(1440);
  });
});

describe('timeline layout', () => {
  const layout = buildTimeline(config, '2026-01-15', viewport);

  it('draws a midnight-spanning cycle as one continuous bar', () => {
    const row = layout.rows.find((r) => r.deviceId === 'porch');
    expect(row?.bars).toHaveLength(1);
    const bar = row!.bars[0]!;
    // Dusk 17:34 through sunrise + 30m at 07:29, straddling the centre.
    expect(bar.startLabel).toBe('5:34 PM');
    expect(bar.endLabel).toBe('7:29 AM');
    expect(bar.x).toBeLessThan(layout.midnightX);
    expect(bar.x + bar.width).toBeGreaterThan(layout.midnightX);
    expect(bar.continuesPast).toBe(false);
  });

  it('marks the astronomical events in chronological order', () => {
    expect(layout.astro.map((a) => a.event)).toEqual(['sunset', 'dusk', 'dawn', 'sunrise']);
    const xs = layout.astro.map((a) => a.x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    expect(layout.astro[1]).toMatchObject({ label: 'Dusk', time: '5:34 PM' });
  });

  it('places a band for each fence', () => {
    expect(layout.fences.map((f) => f.transition)).toEqual(['on', 'off']);
    for (const fence of layout.fences) {
      expect(fence.width).toBeGreaterThan(0);
      expect(fence.x).toBeGreaterThan(layout.ticks[0]!.x);
    }
  });

  it('gives every device a row, including ones with no schedule', () => {
    expect(layout.rows.map((r) => r.deviceId)).toEqual(['porch', 'kitchen']);
    expect(layout.rows[0]?.y).toBe(72);
    expect(layout.rows[1]?.y).toBe(128);
    expect(layout.rows[1]?.bars).toHaveLength(0);
    expect(layout.height).toBe(184);
  });

  it('emphasises midnight and noon among the ticks', () => {
    expect(layout.ticks.filter((t) => t.major).map((t) => t.label)).toEqual([
      '12:00 PM',
      '12:00 AM',
      '12:00 PM',
    ]);
  });

  it('keeps a six AM bar aligned with its clock label on a DST change', () => {
    const morning = { ...config, schedules: {
      s: { ...porch, id: 's', kind: 'adhoc' as const,
        on: { kind: 'absolute', minutesOfDay: 6 * 60 } as const,
        off: { kind: 'absolute', minutesOfDay: 7 * 60 } as const },
    } };
    const spring = buildTimeline(morning, '2026-03-07', viewport);
    const bar = spring.rows[0]!.bars[0]!;
    expect(bar.startLabel).toBe('6:00 AM');
    expect(ordinalAtX(bar.x, { ...viewport, durationMinutes: 1380 })).toBeCloseTo(1020, 5);
    expect(spring.ticks.find((tick) => tick.label === '12:00 AM')!.x).toBeCloseTo(spring.midnightX, 5);
  });

  it('exposes a clamp as a requested and an effective position', () => {
    const clamped = {
      ...config,
      schedules: {
        s: { ...porch, id: 's', on: { kind: 'astro', event: 'sunset', offsetMinutes: -20 } as const },
      },
    };
    const row = buildTimeline(clamped, '2026-01-15', viewport).rows[0]!;
    expect(row.clamps).toHaveLength(1);
    const clamp = row.clamps[0]!;
    expect(clamp.requestedLabel).toBe('4:47 PM');
    expect(clamp.effectiveLabel).toBe('5:34 PM');
    expect(clamp.requestedX).toBeLessThan(clamp.effectiveX);
  });

  it('flags an interval that runs past the right edge instead of truncating it', () => {
    const spilling = {
      ...config,
      schedules: {
        s: {
          ...porch,
          id: 's',
          kind: 'adhoc' as const,
          on: { kind: 'absolute', minutesOfDay: 10 * 60 } as const,
          off: { kind: 'absolute', minutesOfDay: 14 * 60 } as const,
        },
      },
    };
    const bar = buildTimeline(spilling, '2026-01-15', viewport).rows[0]!.bars[0]!;
    expect(bar.continuesPast).toBe(true);
    expect(bar.x + bar.width).toBeCloseTo(391, 6);
  });

  it('surfaces a blocked schedule on its device row', () => {
    const polar = {
      ...config,
      location: { latitude: 69.65, longitude: 18.96, timezone: 'Europe/Oslo' },
    };
    const row = buildTimeline(polar, '2025-12-21', viewport).rows[0]!;
    expect(row.bars).toHaveLength(0);
    expect(row.blocked[0]?.detail).toContain('does not occur');
  });
});
