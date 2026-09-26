import { DateTime } from 'luxon';
import type { Configuration, Schedule } from '@mrscheduler/domain';
import { describe, expect, it } from 'vitest';
import {
  FakeClock,
  FakeSmartDeviceTransport,
  JsonConfigurationRepository,
  MemoryTextStorage,
  SchedulerEngine,
  updateAbsoluteScheduleEndpoint,
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

const porchSchedule: Schedule = {
  id: 'porchEvening',
  deviceId: 'porch',
  enabled: true,
  kind: 'adhoc',
  on: { kind: 'absolute', minutesOfDay: 18 * 60 },
  off: { kind: 'absolute', minutesOfDay: 23 * 60 },
  days: EVERY_DAY,
};

describe('Slice 1: one absolute authored schedule end to end', () => {
  it('persists exact authored edits, executes them, and behaves identically after restart', async () => {
    const storage = new MemoryTextStorage();
    const repository = new JsonConfigurationRepository(storage);

    let authored = upsertSchedule(emptyConfiguration, porchSchedule);
    authored = updateAbsoluteScheduleEndpoint(authored, porchSchedule.id, 'on', 18 * 60 + 37);
    authored = updateAbsoluteScheduleEndpoint(authored, porchSchedule.id, 'off', 22 * 60 + 52);
    await repository.save(authored);

    const loaded = await repository.load();
    expect(loaded?.schedules.porchEvening?.on).toEqual({ kind: 'absolute', minutesOfDay: 1117 });
    expect(loaded?.schedules.porchEvening?.off).toEqual({ kind: 'absolute', minutesOfDay: 1372 });

    const firstClock = new FakeClock(DateTime.fromISO('2026-09-24T18:00:00', { zone: ZONE }));
    const firstTransport = new FakeSmartDeviceTransport({ porch: 'off' });
    const firstEngine = new SchedulerEngine(repository, firstTransport, firstClock);

    await firstEngine.start();
    expect(firstTransport.commands).toEqual([]);

    await firstClock.advanceTo(DateTime.fromISO('2026-09-24T18:37:00', { zone: ZONE }));
    expect(firstTransport.commands).toEqual([{ deviceId: 'porch', state: 'on' }]);

    await firstClock.advanceTo(DateTime.fromISO('2026-09-24T22:52:00', { zone: ZONE }));
    expect(firstTransport.commands).toEqual([
      { deviceId: 'porch', state: 'on' },
      { deviceId: 'porch', state: 'off' },
    ]);
    firstEngine.stop();

    // Reconstruct every application object from the persisted bytes. Starting
    // exactly on the ON edge must reconcile to ON even though the event queue
    // intentionally contains only events strictly after "now".
    const restartedRepository = new JsonConfigurationRepository(storage);
    const restartedClock = new FakeClock(DateTime.fromISO('2026-09-25T18:37:00', { zone: ZONE }));
    const restartedTransport = new FakeSmartDeviceTransport({ porch: 'off' });
    const restartedEngine = new SchedulerEngine(restartedRepository, restartedTransport, restartedClock);

    await restartedEngine.start();
    expect(restartedTransport.commands).toEqual([{ deviceId: 'porch', state: 'on' }]);

    await restartedClock.advanceTo(DateTime.fromISO('2026-09-25T22:52:00', { zone: ZONE }));
    expect(restartedTransport.commands).toEqual([
      { deviceId: 'porch', state: 'on' },
      { deviceId: 'porch', state: 'off' },
    ]);
  });
});
