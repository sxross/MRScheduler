import { DateTime } from 'luxon';
import type { Configuration, Schedule } from '@mrscheduler/domain';
import { describe, expect, it } from 'vitest';
import {
  FakeClock,
  FakeSmartDeviceTransport,
  JsonConfigurationRepository,
  MemoryTextStorage,
  SchedulerEngine,
  setScheduleEndpoint,
  upsertSchedule,
} from '../src';

const ZONE = 'America/Los_Angeles';
const EVERY_DAY: Schedule['days'] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const emptyConfiguration: Configuration = {
  location: { latitude: 34.05, longitude: -118.24, timezone: ZONE },
  devices: {
    porch: { id: 'porch', name: 'Porch Light', enabled: true },
  },
  schedules: {},
  constraints: {},
};

const absoluteSchedule: Schedule = {
  id: 'porchEvening',
  deviceId: 'porch',
  enabled: true,
  kind: 'adhoc',
  on: { kind: 'absolute', minutesOfDay: 18 * 60 },
  off: { kind: 'absolute', minutesOfDay: 23 * 60 },
  days: EVERY_DAY,
};

describe('Slice 2: astronomical identity', () => {
  it('retains sunset - 20m as authored identity while resolved execution moves with the date', async () => {
    const storage = new MemoryTextStorage();
    const repository = new JsonConfigurationRepository(storage);

    let authored = upsertSchedule(emptyConfiguration, absoluteSchedule);
    authored = setScheduleEndpoint(authored, absoluteSchedule.id, 'on', {
      kind: 'astro',
      event: 'sunset',
      offsetMinutes: -20,
    });
    await repository.save(authored);

    const persisted = await repository.load();
    expect(persisted?.schedules.porchEvening?.on).toEqual({
      kind: 'astro',
      event: 'sunset',
      offsetMinutes: -20,
    });

    const winterClock = new FakeClock(DateTime.fromISO('2026-01-15T15:00:00', { zone: ZONE }));
    const winterTransport = new FakeSmartDeviceTransport({ porch: 'off' });
    const winterEngine = new SchedulerEngine(repository, winterTransport, winterClock);
    await winterEngine.start();
    const winterOn = winterClock.nextScheduledAt();
    expect(winterOn).not.toBeNull();
    await winterClock.advanceTo(winterOn!);
    expect(winterTransport.commands).toEqual([{ deviceId: 'porch', state: 'on' }]);
    winterEngine.stop();

    const summerClock = new FakeClock(DateTime.fromISO('2026-06-15T15:00:00', { zone: ZONE }));
    const summerTransport = new FakeSmartDeviceTransport({ porch: 'off' });
    const summerEngine = new SchedulerEngine(new JsonConfigurationRepository(storage), summerTransport, summerClock);
    await summerEngine.start();
    const summerOn = summerClock.nextScheduledAt();
    expect(summerOn).not.toBeNull();
    expect(summerOn!.toFormat('HH:mm')).not.toBe(winterOn!.toFormat('HH:mm'));
    await summerClock.advanceTo(summerOn!);
    expect(summerTransport.commands).toEqual([{ deviceId: 'porch', state: 'on' }]);

    const afterTimeTravel = await repository.load();
    expect(afterTimeTravel?.schedules.porchEvening?.on).toEqual({
      kind: 'astro',
      event: 'sunset',
      offsetMinutes: -20,
    });
  });
});
