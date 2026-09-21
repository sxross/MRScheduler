/**
 * The noon-origin axis.
 *
 * Schedules and constraints routinely straddle midnight: "on at dusk, off at
 * sunrise + 30m" is one continuous cycle, but on a midnight-origin clock its
 * OFF edge (06:42) sorts *before* its ON edge (19:30). Every comparison would
 * need wraparound special-casing, and that is where scheduling bugs live.
 *
 * So the engine evaluates everything on a solar day running local noon to
 * local noon. Dusk, midnight and the following sunrise then increase
 * monotonically, and constraint checks are plain interval comparisons.
 *
 * A solar day is identified by the calendar date of the noon that starts it.
 */
import { DateTime } from 'luxon';
import type { Endpoint, Location } from '../model/types';
import { astroTime } from './astronomical';

export const MINUTES_PER_DAY = 1440;
const NOON = 720;

export interface SolarDay {
  /** Calendar date of the opening noon, 'yyyy-MM-dd' in the configured zone. */
  readonly anchorDate: string;
  readonly start: DateTime;
  readonly end: DateTime;
}

export function solarDay(anchorDate: string, location: Location): SolarDay {
  const start = DateTime.fromISO(anchorDate, { zone: location.timezone }).set({
    hour: 12,
    minute: 0,
    second: 0,
    millisecond: 0,
  });
  return { anchorDate, start, end: start.plus({ days: 1 }) };
}

/** The solar day containing `instant` (the one whose opening noon precedes it). */
export function solarDayContaining(instant: DateTime, location: Location): SolarDay {
  const local = instant.setZone(location.timezone);
  const anchor = local.hour < 12 ? local.minus({ days: 1 }) : local;
  return solarDay(anchor.toFormat('yyyy-MM-dd'), location);
}

/** Minutes from the solar day's opening noon. May exceed 1440 with offsets. */
export function ordinalOf(instant: DateTime, day: SolarDay): number {
  return instant.diff(day.start, 'minutes').minutes;
}

export type Resolution =
  | { ok: true; at: DateTime; ordinal: number }
  | { ok: false; reason: string };

/**
 * Place an endpoint on a solar day's axis.
 *
 * Absolute times are unambiguous under this axis: 18:30 belongs to the
 * afternoon that opened the day, 06:00 to the morning that closes it.
 *
 * Astronomical endpoints are resolved by computing the event on both calendar
 * dates the solar day spans and taking the occurrence inside the window,
 * rather than assuming sunset is always "today" -- which fails where a zone
 * sits far from its longitude.
 */
export function resolveEndpoint(
  endpoint: Endpoint,
  day: SolarDay,
  location: Location,
): Resolution {
  if (endpoint.kind === 'absolute') {
    const m = endpoint.minutesOfDay;
    const ordinal = m >= NOON ? m - NOON : m + NOON;
    return { ok: true, at: day.start.plus({ minutes: ordinal }), ordinal };
  }

  const candidates = [day.start, day.start.plus({ days: 1 })]
    .map((noon) => astroTime(endpoint.event, noon, location))
    .filter((t): t is DateTime => t !== null)
    .map((t) => t.plus({ minutes: endpoint.offsetMinutes }));

  const base = candidates.find((t) => t >= day.start && t < day.end) ?? candidates[0];
  if (!base) {
    return {
      ok: false,
      reason: `${endpoint.event} does not occur at this latitude on ${day.anchorDate}`,
    };
  }
  return { ok: true, at: base, ordinal: ordinalOf(base, day) };
}
