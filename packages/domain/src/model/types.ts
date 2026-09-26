/**
 * Core domain types. Pure data: no React, Firebase, Meross or platform APIs.
 *
 * The cardinal rule (PRD 44.11): we store semantic rules, never derived clock
 * times. `sunset - 20m` stays `{ event: 'sunset', offsetMinutes: -20 }`.
 */

/** Astronomical events usable as schedule and constraint anchors. */
export type AstroEventName =
  | 'sunrise'
  | 'sunset'
  | 'dawn'
  | 'dusk'
  | 'nauticalDawn'
  | 'nauticalDusk';

export const ASTRO_EVENTS: readonly AstroEventName[] = [
  'dawn',
  'sunrise',
  'sunset',
  'dusk',
  'nauticalDawn',
  'nauticalDusk',
];

/** An event anchor with a signed minute offset, e.g. sunset - 20m. */
export interface AstroAnchor {
  event: AstroEventName;
  offsetMinutes: number;
}

/**
 * One end of a schedule. Either a wall-clock time or an astronomical rule.
 * `minutesOfDay` is local time, 0..1439.
 */
export type Endpoint =
  | { kind: 'absolute'; minutesOfDay: number }
  | ({ kind: 'astro' } & AstroAnchor);

export type Weekday = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

export const WEEKDAYS: readonly Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** Which transition a constraint window fences. */
export type TransitionKind = 'on' | 'off';

/**
 * The two buckets of schedule.
 *
 * 'governed' schedules live inside the astronomical fences: their endpoints are
 * clamped into the permitted window so lights never come on in daylight or stay
 * on past sunrise, and the effective times drift with the seasons.
 *
 * 'adhoc' schedules are astronomically unaware. The user drew them deliberately
 * and they execute as drawn -- morning kitchen lighting, for instance.
 */
export type ScheduleKind = 'governed' | 'adhoc';

export interface Device {
  id: string;
  name: string;
  enabled: boolean;
}

export interface Schedule {
  id: string;
  deviceId: string;
  enabled: boolean;
  on: Endpoint;
  off: Endpoint;
  /** Days the ON edge may fall on. An interval carries through to its OFF edge. */
  days: Weekday[];
  /** Which bucket this schedule belongs to. Defaults to 'governed'. */
  kind?: ScheduleKind;
}

/**
 * A permitted window for a transition, anchored at two astronomical events.
 * Both bounds are required: a lone upper bound would still permit an ON at
 * 2pm, which is not what "nothing turns on after sunrise" means.
 */
export interface ConstraintWindow {
  from: AstroAnchor;
  to: AstroAnchor;
}

/** Global guardrails. Absent window == that transition is unfenced. */
export interface Constraints {
  on?: ConstraintWindow;
  off?: ConstraintWindow;
}

export interface Location {
  latitude: number;
  longitude: number;
  /** IANA zone, e.g. 'America/Los_Angeles'. */
  timezone: string;
}

export interface Configuration {
  location: Location;
  devices: Record<string, Device>;
  schedules: Record<string, Schedule>;
  constraints: Constraints;
}
