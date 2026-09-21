/**
 * The configuration the UI runs against until Firebase lands. Editing happens
 * in memory; the shape is exactly what will be synchronised later, so swapping
 * the source is a change of provider rather than a change of model.
 */
import type { Configuration } from '@mrscheduler/domain';

export const EVERY_DAY = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

export const sampleConfig: Configuration = {
  location: { latitude: 34.05, longitude: -118.24, timezone: 'America/Los_Angeles' },
  devices: {
    porch: { id: 'porch', name: 'Porch Lights', enabled: true },
    entry: { id: 'entry', name: 'Entry', enabled: true },
    kitchen: { id: 'kitchen', name: 'Kitchen', enabled: true },
  },
  schedules: {
    porchOvernight: {
      id: 'porchOvernight',
      deviceId: 'porch',
      enabled: true,
      on: { kind: 'astro', event: 'sunset', offsetMinutes: -20 },
      off: { kind: 'astro', event: 'sunrise', offsetMinutes: 30 },
      days: [...EVERY_DAY],
    },
    entryEvening: {
      id: 'entryEvening',
      deviceId: 'entry',
      enabled: true,
      on: { kind: 'astro', event: 'dusk', offsetMinutes: -10 },
      off: { kind: 'absolute', minutesOfDay: 22 * 60 },
      days: [...EVERY_DAY],
    },
    kitchenMorning: {
      id: 'kitchenMorning',
      deviceId: 'kitchen',
      enabled: true,
      kind: 'adhoc',
      on: { kind: 'absolute', minutesOfDay: 6 * 60 },
      off: { kind: 'absolute', minutesOfDay: 9 * 60 },
      days: [...EVERY_DAY],
    },
  },
  constraints: {
    on: { from: { event: 'dusk', offsetMinutes: 0 }, to: { event: 'sunrise', offsetMinutes: -15 } },
    off: { from: { event: 'dusk', offsetMinutes: 20 }, to: { event: 'sunrise', offsetMinutes: 60 } },
  },
};
