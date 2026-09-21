import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { buildEventQueue, desiredStateAt } from '../src/scheduling/eventQueue.js';
import type { Schedule } from '../src/model/types.js';
import { config, EVERY_DAY, FENCES, PORTLAND } from './fixtures.js';

const porchEvening: Schedule = {
  id: 'porchEvening',
  deviceId: 'porch',
  enabled: true,
  on: { kind: 'astro', event: 'dusk', offsetMinutes: 0 },
  off: { kind: 'astro', event: 'sunrise', offsetMinutes: 30 },
  days: EVERY_DAY,
};

const noon = DateTime.fromISO('2026-01-15T12:00', { zone: PORTLAND.timezone });

describe('event queue', () => {
  const c = config({ constraints: FENCES, schedules: { porchEvening } });

  it('emits ON then OFF in chronological order with their reasons', () => {
    const { events } = buildEventQueue(c, noon, 1);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ deviceId: 'porch', desiredState: 'on', reason: 'Dusk' });
    expect(events[0]?.at.toFormat('yyyy-MM-dd HH:mm')).toBe('2026-01-15 17:27');
    expect(events[1]).toMatchObject({ desiredState: 'off', reason: 'Sunrise + 30 min' });
    expect(events[1]?.at.toFormat('yyyy-MM-dd HH:mm')).toBe('2026-01-16 08:17');
  });

  it('drops events at or before the queue start', () => {
    const evening = DateTime.fromISO('2026-01-15T20:00', { zone: PORTLAND.timezone });
    const { events } = buildEventQueue(c, evening, 1);
    expect(events.map((e) => e.desiredState)).toEqual(['off']);
  });

  it('does not duplicate events where adjacent solar days meet', () => {
    const { events } = buildEventQueue(c, noon, 3);
    const keys = events.map((e) => `${e.deviceId}|${e.at.toISO()}|${e.desiredState}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('reports a fence conflict with an explanation instead of adjusting it', () => {
    const blocked = config({
      constraints: FENCES,
      schedules: {
        s: { ...porchEvening, id: 's', on: { kind: 'astro', event: 'sunset', offsetMinutes: -20 } },
      },
    });
    const { events, conflicts } = buildEventQueue(blocked, noon, 1);
    expect(events).toHaveLength(0);
    expect(conflicts[0]).toMatchObject({ scheduleId: 's', kind: 'constraint' });
    expect(conflicts[0]?.detail).toContain('cannot execute as configured');
  });
});

describe('desiredStateAt', () => {
  const c = config({ constraints: FENCES, schedules: { porchEvening } });

  it('is on across midnight, inside an interval opened the previous evening', () => {
    const at = (iso: string) => desiredStateAt(c, 'porch', DateTime.fromISO(iso, { zone: PORTLAND.timezone }));
    expect(at('2026-01-15T17:00')).toBe('off');
    expect(at('2026-01-15T18:00')).toBe('on');
    expect(at('2026-01-16T03:00')).toBe('on');
    expect(at('2026-01-16T08:00')).toBe('on');
    expect(at('2026-01-16T09:00')).toBe('off');
  });

  it('ignores devices with no schedule', () => {
    expect(desiredStateAt(c, 'kitchen', noon)).toBe('off');
  });
});
