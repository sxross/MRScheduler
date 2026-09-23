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
    driveway: { id: 'driveway', name: 'Driveway', enabled: true },
    path: { id: 'path', name: 'Path Lights', enabled: true },
    deck: { id: 'deck', name: 'Deck', enabled: true },
    accent: { id: 'accent', name: 'Accent', enabled: true },
    office: { id: 'office', name: 'Office', enabled: true },
    hall: { id: 'hall', name: 'Hall', enabled: true },
    bedroom: { id: 'bedroom', name: 'Bedroom', enabled: true },
    garage: { id: 'garage', name: 'Garage', enabled: true },
    fountain: { id: 'fountain', name: 'Fountain', enabled: true },
  },
  schedules: {
    porchEvening: {
      id: 'porchEvening',
      deviceId: 'porch',
      enabled: true,
      kind: 'adhoc',
      on: { kind: 'absolute', minutesOfDay: 16 * 60 + 30 },
      off: { kind: 'absolute', minutesOfDay: 19 * 60 },
      days: [...EVERY_DAY],
    },
    porchLate: {
      id: 'porchLate',
      deviceId: 'porch',
      enabled: true,
      kind: 'adhoc',
      on: { kind: 'absolute', minutesOfDay: 20 * 60 + 15 },
      off: { kind: 'absolute', minutesOfDay: 23 * 60 },
      days: [...EVERY_DAY],
    },
    porchOvernight: {
      id: 'porchOvernight',
      deviceId: 'porch',
      enabled: true,
      on: { kind: 'astro', event: 'sunset', offsetMinutes: -20 },
      off: { kind: 'astro', event: 'sunrise', offsetMinutes: 30 },
      days: [...EVERY_DAY],
    },
    entryEarly: {
      id: 'entryEarly',
      deviceId: 'entry',
      enabled: true,
      kind: 'adhoc',
      on: { kind: 'absolute', minutesOfDay: 17 * 60 },
      off: { kind: 'absolute', minutesOfDay: 18 * 60 + 30 },
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
    drivewayEvening: {
      id: 'drivewayEvening', deviceId: 'driveway', enabled: true, kind: 'adhoc',
      on: { kind: 'absolute', minutesOfDay: 17 * 60 + 30 }, off: { kind: 'absolute', minutesOfDay: 23 * 60 + 30 }, days: [...EVERY_DAY],
    },
    pathEvening: {
      id: 'pathEvening', deviceId: 'path', enabled: true, kind: 'adhoc',
      on: { kind: 'absolute', minutesOfDay: 18 * 60 }, off: { kind: 'absolute', minutesOfDay: 22 * 60 + 30 }, days: [...EVERY_DAY],
    },
    deckEvening: {
      id: 'deckEvening', deviceId: 'deck', enabled: true, kind: 'adhoc',
      on: { kind: 'absolute', minutesOfDay: 19 * 60 }, off: { kind: 'absolute', minutesOfDay: 23 * 60 }, days: [...EVERY_DAY],
    },
    accentEvening: {
      id: 'accentEvening', deviceId: 'accent', enabled: true, kind: 'adhoc',
      on: { kind: 'absolute', minutesOfDay: 16 * 60 + 45 }, off: { kind: 'absolute', minutesOfDay: 22 * 60 }, days: [...EVERY_DAY],
    },
    officeEvening: {
      id: 'officeEvening', deviceId: 'office', enabled: true, kind: 'adhoc',
      on: { kind: 'absolute', minutesOfDay: 17 * 60 }, off: { kind: 'absolute', minutesOfDay: 20 * 60 + 30 }, days: [...EVERY_DAY],
    },
    hallNight: {
      id: 'hallNight', deviceId: 'hall', enabled: true, kind: 'adhoc',
      on: { kind: 'absolute', minutesOfDay: 21 * 60 }, off: { kind: 'absolute', minutesOfDay: 23 * 60 + 45 }, days: [...EVERY_DAY],
    },
    bedroomNight: {
      id: 'bedroomNight', deviceId: 'bedroom', enabled: true, kind: 'adhoc',
      on: { kind: 'absolute', minutesOfDay: 22 * 60 }, off: { kind: 'absolute', minutesOfDay: 23 * 60 + 30 }, days: [...EVERY_DAY],
    },
    garageEvening: {
      id: 'garageEvening', deviceId: 'garage', enabled: true, kind: 'adhoc',
      on: { kind: 'absolute', minutesOfDay: 18 * 60 + 30 }, off: { kind: 'absolute', minutesOfDay: 21 * 60 }, days: [...EVERY_DAY],
    },
    fountainEvening: {
      id: 'fountainEvening', deviceId: 'fountain', enabled: true, kind: 'adhoc',
      on: { kind: 'absolute', minutesOfDay: 16 * 60 }, off: { kind: 'absolute', minutesOfDay: 20 * 60 }, days: [...EVERY_DAY],
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
