import { DateTime } from 'luxon';

export type CancelScheduledTask = () => void;

export interface Clock {
  now(): DateTime;
  schedule(at: DateTime, task: () => void | Promise<void>): CancelScheduledTask;
}

export class SystemClock implements Clock {
  constructor(private readonly zone: string) {}

  now(): DateTime {
    return DateTime.now().setZone(this.zone);
  }

  schedule(at: DateTime, task: () => void | Promise<void>): CancelScheduledTask {
    const delay = Math.max(0, at.toMillis() - Date.now());
    const handle = setTimeout(() => {
      void task();
    }, delay);
    return () => clearTimeout(handle);
  }
}
