/**
 * Thin, deterministic adapter over suncalc. The only place in the domain that
 * knows how astronomical times are computed.
 */
import SunCalc from 'suncalc';
import { DateTime } from 'luxon';
import type { AstroEventName, Location } from '../model/types';

/** suncalc uses these exact property names; kept explicit so a rename is caught. */
const SUNCALC_KEY: Record<AstroEventName, keyof SunCalc.GetTimesResult> = {
  sunrise: 'sunrise',
  sunset: 'sunset',
  dawn: 'dawn',
  dusk: 'dusk',
  nauticalDawn: 'nauticalDawn',
  nauticalDusk: 'nauticalDusk',
};

/**
 * The instant of `event` for the solar day containing `localNoon`.
 *
 * Returns null when the event does not occur -- at high latitudes the sun may
 * never reach the required angle, and suncalc yields an invalid Date. Callers
 * surface that as an unresolvable schedule rather than guessing a time.
 */
export function astroTime(
  event: AstroEventName,
  localNoon: DateTime,
  location: Location,
): DateTime | null {
  const times = SunCalc.getTimes(localNoon.toJSDate(), location.latitude, location.longitude);
  const at = times[SUNCALC_KEY[event]];
  if (!(at instanceof Date) || Number.isNaN(at.getTime())) return null;
  return DateTime.fromJSDate(at, { zone: location.timezone });
}
