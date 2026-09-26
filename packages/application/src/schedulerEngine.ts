import { buildEventQueue, desiredStateAt, type Configuration } from '@mrscheduler/domain';
import type { Clock, CancelScheduledTask } from './clock';
import type { ConfigurationRepository } from './configurationRepository';
import type { SmartDeviceTransport } from './deviceTransport';

export class SchedulerEngine {
  private configuration: Configuration | null = null;
  private cancelWake: CancelScheduledTask | null = null;
  private running = false;

  constructor(
    private readonly repository: ConfigurationRepository,
    private readonly transport: SmartDeviceTransport,
    private readonly clock: Clock,
  ) {}

  async start(): Promise<void> {
    this.running = true;
    await this.reload();
  }

  stop(): void {
    this.running = false;
    this.cancelWake?.();
    this.cancelWake = null;
  }

  async reload(): Promise<void> {
    const configuration = await this.repository.load();
    if (!configuration) throw new Error('No persisted configuration is available.');
    this.configuration = configuration;
    await this.reconcileAndSchedule();
  }

  private async reconcileAndSchedule(): Promise<void> {
    this.cancelWake?.();
    this.cancelWake = null;
    if (!this.running || !this.configuration) return;

    const now = this.clock.now();
    for (const device of Object.values(this.configuration.devices)) {
      const desired = desiredStateAt(this.configuration, device.id, now);
      const actual = await this.transport.readPower(device.id);
      if (actual !== desired) {
        await this.transport.setPower(device.id, desired);
      }
    }

    const next = buildEventQueue(this.configuration, now, 2).events[0];
    if (!next) return;

    this.cancelWake = this.clock.schedule(next.at, async () => {
      if (!this.running) return;
      await this.reconcileAndSchedule();
    });
  }
}
