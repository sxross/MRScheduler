import { DateTime } from 'luxon';
import type { DesiredState } from '@mrscheduler/domain';
import type { CancelScheduledTask, Clock } from './clock';
import type { SmartDeviceTransport } from './deviceTransport';

interface ScheduledTask {
  id: number;
  at: DateTime;
  task: () => void | Promise<void>;
  cancelled: boolean;
}

export class FakeClock implements Clock {
  private nextId = 1;
  private readonly tasks: ScheduledTask[] = [];

  constructor(private current: DateTime) {}

  now(): DateTime {
    return this.current;
  }

  schedule(at: DateTime, task: () => void | Promise<void>): CancelScheduledTask {
    const scheduled: ScheduledTask = {
      id: this.nextId++,
      at,
      task,
      cancelled: false,
    };
    this.tasks.push(scheduled);
    return () => {
      scheduled.cancelled = true;
    };
  }

  async advanceTo(target: DateTime): Promise<void> {
    if (target < this.current) throw new Error('FakeClock cannot move backwards.');

    while (true) {
      const next = this.tasks
        .filter((candidate) => !candidate.cancelled && candidate.at <= target)
        .sort((a, b) => a.at.toMillis() - b.at.toMillis() || a.id - b.id)[0];
      if (!next) break;

      next.cancelled = true;
      this.current = next.at;
      await next.task();
    }
    this.current = target;
  }
}

export interface PowerCommand {
  deviceId: string;
  state: DesiredState;
}

export class FakeSmartDeviceTransport implements SmartDeviceTransport {
  readonly commands: PowerCommand[] = [];
  private readonly states = new Map<string, DesiredState>();

  constructor(initialStates: Record<string, DesiredState> = {}) {
    for (const [deviceId, state] of Object.entries(initialStates)) {
      this.states.set(deviceId, state);
    }
  }

  async readPower(deviceId: string): Promise<DesiredState> {
    return this.states.get(deviceId) ?? 'off';
  }

  async setPower(deviceId: string, state: DesiredState): Promise<void> {
    this.states.set(deviceId, state);
    this.commands.push({ deviceId, state });
  }
}
