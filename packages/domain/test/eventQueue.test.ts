import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { buildEventQueue, desiredStateAt } from '../src/scheduling/eventQueue.js';
import type { Schedule } from '../src/model/types.js';
import { config, EVERY_DAY, FENCES, LA } from './fixtures.js';

const porchEvening: Schedule = {
  id: 'porchEvening',
  deviceId: 'porch',
  enabled: true,
  on: { kind: 'astro', event: 'dusk', offsetMinutes: 0 },
  off: { kind: 'astro', event: 'sunrise', offsetMinutes: 30 },
  days: EVERY_DAY,
};

const noon = DateTime.fromISO('2026-01-15T12:00', { zone: LA.timezone });

describe('event queue', () => {
  const c = config({ constraints: FENCES, schedules: { porchEvening } });

  it('emits ON then OFF in chronological order with their reasons', () => {
    const { events } = buildEventQueue(c, noon, 1);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ deviceId: 'porch', desiredState: 'on', reason: 'Dusk' });
    expect(events[0]?.at.toFormat('yyyy-MM-dd HH:mm')).toBe('2026-01-15 17:34');
    expect(events[1]).toMatchObject({ desiredState: 'off', reason: 'Sunrise + 30 min' });
    expect(events[1]?.at.toFormat('yyyy-MM-dd HH:mm')).toBe('2026-01-16 07:29');
  });

  it('drops events at or before the queue start', () => {
    const evening = DateTime.fromISO('2026-01-15T20:00', { zone: LA.timezone });
    const { events } = buildEventQueue(c, evening, 1);
    expect(events.map((e) => e.desiredState)).toEqual(['off']);
  });

  it('does not duplicate events where adjacent solar days meet', () => {
    const { events } = buildEventQueue(c, noon, 3);
    const keys = events.map((e) => `${e.deviceId}|${e.at.toISO()}|${e.desiredState}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('carries the requested time on an event the fence moved', () => {
    const clamped = config({
      constraints: FENCES,
      schedules: {
        s: { ...porchEvening, id: 's', on: { kind: 'astro', event: 'sunset', offsetMinutes: -20 } },
      },
    });
    const { events, adjustments } = buildEventQueue(clamped, noon, 1);
    expect(events[0]?.at.toFormat('HH:mm')).toBe('17:34');
    expect(events[0]?.adjustedFrom?.toFormat('HH:mm')).toBe('16:47');
    expect(events[0]?.reason).toBe('Sunset - 20 min');
    expect(adjustments).toHaveLength(1);
  });

  it('leaves an ad-hoc event unadjusted', () => {
    const adhoc = config({
      constraints: FENCES,
      schedules: {
        s: {
          ...porchEvening,
          id: 's',
          kind: 'adhoc',
          on: { kind: 'absolute', minutesOfDay: 14 * 60 },
          off: { kind: 'absolute', minutesOfDay: 15 * 60 },
        },
      },
    });
    const { events, adjustments } = buildEventQueue(adhoc, noon, 1);
    expect(events[0]?.at.toFormat('HH:mm')).toBe('14:00');
    expect(events[0]?.adjustedFrom).toBeUndefined();
    expect(adjustments).toHaveLength(0);
  });

  it('reports a collapsed schedule as blocked rather than emitting an event', () => {
    const blockedConfig = config({
      constraints: {
        on: { from: { event: 'dusk', offsetMinutes: 0 }, to: { event: 'dusk', offsetMinutes: 0 } },
        off: { from: { event: 'dusk', offsetMinutes: -60 }, to: { event: 'dusk', offsetMinutes: -60 } },
      },
      schedules: {
        s: {
          ...porchEvening,
          id: 's',
          on: { kind: 'absolute', minutesOfDay: 18 * 60 },
          off: { kind: 'absolute', minutesOfDay: 19 * 60 },
        },
      },
    });
    const { events, blocked } = buildEventQueue(blockedConfig, noon, 1);
    expect(events).toHaveLength(0);
    expect(blocked[0]).toMatchObject({ scheduleId: 's', collapsed: true });
  });
});

describe('desiredStateAt', () => {
  const c = config({ constraints: FENCES, schedules: { porchEvening } });

  it('is on across midnight, inside an interval opened the previous evening', () => {
    const at = (iso: string) => desiredStateAt(c, 'porch', DateTime.fromISO(iso, { zone: LA.timezone }));
    expect(at('2026-01-15T17:00')).toBe('off');
    expect(at('2026-01-15T18:00')).toBe('on');
    expect(at('2026-01-16T03:00')).toBe('on');
    expect(at('2026-01-16T07:00')).toBe('on');
    expect(at('2026-01-16T08:00')).toBe('off');
  });

  it('ignores devices with no schedule', () => {
    expect(desiredStateAt(c, 'kitchen', noon)).toBe('off');
  });
});
