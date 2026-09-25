import { describe, expect, it } from 'vitest';
import { DateTime } from 'luxon';
import { dayLength, ordinalOf, resolveEndpoint, solarDay, solarDayContaining } from '../src/scheduling/solarDay';
import { LA, TROMSO } from './fixtures';

describe('the noon-origin axis', () => {
  const day = solarDay('2026-01-15', LA);

  it('opens at local noon', () => {
    expect(day.start.toISO()).toBe('2026-01-15T12:00:00.000-08:00');
    expect(day.end.toISO()).toBe('2026-01-16T12:00:00.000-08:00');
  });

  it('places an evening absolute time in the afternoon that opened the day', () => {
    const r = resolveEndpoint({ kind: 'absolute', minutesOfDay: 18 * 60 + 30 }, day, LA);
    expect(r.ok && r.ordinal).toBe(390);
    expect(r.ok && r.at.toFormat('yyyy-MM-dd HH:mm')).toBe('2026-01-15 18:30');
  });

  it('places a morning absolute time in the morning that closes the day', () => {
    const r = resolveEndpoint({ kind: 'absolute', minutesOfDay: 6 * 60 }, day, LA);
    expect(r.ok && r.ordinal).toBe(1080);
    expect(r.ok && r.at.toFormat('yyyy-MM-dd HH:mm')).toBe('2026-01-16 06:00');
  });

  it('orders dusk before the following sunrise without wraparound', () => {
    const dusk = resolveEndpoint({ kind: 'astro', event: 'dusk', offsetMinutes: 0 }, day, LA);
    const sunrise = resolveEndpoint({ kind: 'astro', event: 'sunrise', offsetMinutes: 0 }, day, LA);
    expect(dusk.ok && sunrise.ok && dusk.ordinal < sunrise.ordinal).toBe(true);
    // Sanity: both land inside the solar day.
    expect(dusk.ok && dusk.ordinal).toBeGreaterThan(0);
    expect(sunrise.ok && sunrise.ordinal).toBeLessThan(1440);
  });

  it('applies signed offsets to astronomical anchors', () => {
    const plain = resolveEndpoint({ kind: 'astro', event: 'sunset', offsetMinutes: 0 }, day, LA);
    const early = resolveEndpoint({ kind: 'astro', event: 'sunset', offsetMinutes: -20 }, day, LA);
    expect(plain.ok && early.ok && plain.ordinal - early.ordinal).toBeCloseTo(20, 6);
  });

  it('keeps the same sunset occurrence when a positive offset crosses midnight', () => {
    const summer = solarDay('2026-06-15', LA);
    const plain = resolveEndpoint({ kind: 'astro', event: 'sunset', offsetMinutes: 0 }, summer, LA);
    const late = resolveEndpoint({ kind: 'astro', event: 'sunset', offsetMinutes: 5 * 60 }, summer, LA);
    expect(plain.ok).toBe(true);
    expect(late.ok).toBe(true);
    if (!plain.ok || !late.ok) return;

    expect(late.at.toMillis()).toBe(plain.at.plus({ hours: 5 }).toMillis());
    expect(late.at.day).not.toBe(plain.at.day);
    expect(late.ordinal - plain.ordinal).toBeCloseTo(5 * 60, 6);
  });

  it('keeps the following sunrise occurrence when a positive offset crosses solar noon', () => {
    const winter = solarDay('2026-01-15', LA);
    const plain = resolveEndpoint({ kind: 'astro', event: 'sunrise', offsetMinutes: 0 }, winter, LA);
    const late = resolveEndpoint({ kind: 'astro', event: 'sunrise', offsetMinutes: 6 * 60 }, winter, LA);
    expect(plain.ok).toBe(true);
    expect(late.ok).toBe(true);
    if (!plain.ok || !late.ok) return;

    expect(plain.at < winter.end).toBe(true);
    expect(late.at > winter.end).toBe(true);
    expect(late.at.toMillis()).toBe(plain.at.plus({ hours: 6 }).toMillis());
    expect(late.ordinal - plain.ordinal).toBeCloseTo(6 * 60, 6);
  });

  it('assigns an instant to the solar day whose noon precedes it', () => {
    const beforeNoon = DateTime.fromISO('2026-01-16T06:42', { zone: LA.timezone });
    expect(solarDayContaining(beforeNoon, LA).anchorDate).toBe('2026-01-15');
    const afterNoon = DateTime.fromISO('2026-01-16T19:30', { zone: LA.timezone });
    expect(solarDayContaining(afterNoon, LA).anchorDate).toBe('2026-01-16');
  });

  it('survives a DST spring-forward night', () => {
    // 2026-03-08: clocks jump 02:00 -> 03:00 in America/Los_Angeles.
    const dst = solarDay('2026-03-07', LA);
    const r = resolveEndpoint({ kind: 'absolute', minutesOfDay: 6 * 60 }, dst, LA);
    expect(r.ok && r.at.toFormat('yyyy-MM-dd HH:mm')).toBe('2026-03-08 06:00');
    expect(r.ok && r.ordinal).toBe(1020);
    expect(dayLength(dst)).toBe(1380);
  });

  it('keeps a fall-back wall-clock time at its authored hour', () => {
    const dst = solarDay('2026-10-31', LA);
    const r = resolveEndpoint({ kind: 'absolute', minutesOfDay: 6 * 60 }, dst, LA);
    expect(r.ok && r.at.toFormat('yyyy-MM-dd HH:mm')).toBe('2026-11-01 06:00');
    expect(r.ok && r.ordinal).toBe(1140);
    expect(dayLength(dst)).toBe(1500);
  });

  it('reports polar nights as unresolvable rather than guessing', () => {
    const polar = solarDay('2025-12-21', TROMSO);
    const r = resolveEndpoint({ kind: 'astro', event: 'sunrise', offsetMinutes: 0 }, polar, TROMSO);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toContain('does not occur');
  });
});
