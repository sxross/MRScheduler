/**
 * Natural-language descriptions generated from the schedule model (PRD 35).
 * Never stored -- always derived, so a summary cannot drift from intent.
 */
import type { AstroAnchor, Endpoint, Schedule, Weekday } from '../model/types.js';
import { WEEKDAYS } from '../model/types.js';

const EVENT_LABEL: Record<AstroAnchor['event'], string> = {
  sunrise: 'sunrise',
  sunset: 'sunset',
  dawn: 'dawn',
  dusk: 'dusk',
  nauticalDawn: 'nautical dawn',
  nauticalDusk: 'nautical dusk',
};

const DAY_LABEL: Record<Weekday, string> = {
  sun: 'Sun', mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat',
};

function clock(minutesOfDay: number): string {
  const h24 = Math.floor(minutesOfDay / 60);
  const m = minutesOfDay % 60;
  const suffix = h24 < 12 ? 'AM' : 'PM';
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(m).padStart(2, '0')} ${suffix}`;
}

function duration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} minutes`;
  if (m === 0) return h === 1 ? '1 hour' : `${h} hours`;
  const hours = h === 1 ? '1 hour' : `${h} hours`;
  return `${hours} ${m} minutes`;
}

/** e.g. "20 minutes before sunset", "at sunrise". */
export function describeEndpoint(endpoint: Endpoint): string {
  if (endpoint.kind === 'absolute') return `at ${clock(endpoint.minutesOfDay)}`;
  const event = EVENT_LABEL[endpoint.event];
  if (endpoint.offsetMinutes === 0) return `at ${event}`;
  const magnitude = duration(Math.abs(endpoint.offsetMinutes));
  return endpoint.offsetMinutes < 0
    ? `${magnitude} before ${event}`
    : `${magnitude} after ${event}`;
}

/** Compact form used in the upcoming-events list, e.g. "Sunset - 20 min". */
export function describeReason(endpoint: Endpoint): string {
  if (endpoint.kind === 'absolute') return 'Absolute time';
  const event = EVENT_LABEL[endpoint.event];
  const label = event.charAt(0).toUpperCase() + event.slice(1);
  if (endpoint.offsetMinutes === 0) return label;
  const sign = endpoint.offsetMinutes < 0 ? '-' : '+';
  return `${label} ${sign} ${Math.abs(endpoint.offsetMinutes)} min`;
}

export function describeDays(days: readonly Weekday[]): string {
  const set = new Set(days);
  if (set.size === 7) return 'every day';
  if (set.size === 5 && !set.has('sat') && !set.has('sun')) return 'weekdays';
  if (set.size === 2 && set.has('sat') && set.has('sun')) return 'weekends';
  return WEEKDAYS.filter((d) => set.has(d)).map((d) => DAY_LABEL[d]).join(', ');
}

export function describeSchedule(schedule: Schedule): string {
  const base = `Turns on ${describeEndpoint(schedule.on)} and off ${describeEndpoint(schedule.off)}, ${describeDays(schedule.days)}.`;
  return (schedule.kind ?? 'governed') === 'adhoc'
    ? `${base} Ad-hoc: runs as drawn, outside the astronomical fences.`
    : base;
}
