import type { Configuration, Schedule } from '../src/model/types.js';

/** Los Angeles -- the deployment location. All twilight events occur year round. */
export const LA = {
  latitude: 34.05,
  longitude: -118.24,
  timezone: 'America/Los_Angeles',
};

/** Tromsø, Norway -- polar night and midnight sun. */
export const TROMSO = {
  latitude: 69.65,
  longitude: 18.96,
  timezone: 'Europe/Oslo',
};

export const EVERY_DAY: Schedule['days'] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function config(partial: Partial<Configuration> = {}): Configuration {
  return {
    location: LA,
    devices: {
      porch: { id: 'porch', name: 'Porch Lights', enabled: true },
      kitchen: { id: 'kitchen', name: 'Kitchen', enabled: true },
    },
    schedules: {},
    constraints: {},
    ...partial,
  };
}

/** The guardrails from the PRD: lights only cycle between dusk and sunrise. */
export const FENCES: Configuration['constraints'] = {
  on: {
    from: { event: 'dusk', offsetMinutes: 0 },
    to: { event: 'sunrise', offsetMinutes: -15 },
  },
  off: {
    from: { event: 'dusk', offsetMinutes: 20 },
    to: { event: 'sunrise', offsetMinutes: 60 },
  },
};
