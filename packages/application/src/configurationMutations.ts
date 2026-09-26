import type { Configuration, Endpoint, Schedule } from '@mrscheduler/domain';

export type ConfigurationMutation = (configuration: Configuration) => Configuration;

export function upsertSchedule(configuration: Configuration, schedule: Schedule): Configuration {
  if (!configuration.devices[schedule.deviceId]) {
    throw new Error(`Unknown device: ${schedule.deviceId}`);
  }
  return {
    ...configuration,
    schedules: {
      ...configuration.schedules,
      [schedule.id]: schedule,
    },
  };
}

export function removeSchedule(configuration: Configuration, scheduleId: string): Configuration {
  if (!configuration.schedules[scheduleId]) return configuration;
  const schedules = { ...configuration.schedules };
  delete schedules[scheduleId];
  return { ...configuration, schedules };
}

export function updateAbsoluteScheduleEndpoint(
  configuration: Configuration,
  scheduleId: string,
  edge: 'on' | 'off',
  minutesOfDay: number,
): Configuration {
  if (!Number.isInteger(minutesOfDay) || minutesOfDay < 0 || minutesOfDay >= 24 * 60) {
    throw new RangeError('minutesOfDay must be an integer from 0 through 1439.');
  }
  const schedule = configuration.schedules[scheduleId];
  if (!schedule) throw new Error(`Unknown schedule: ${scheduleId}`);
  if (schedule[edge].kind !== 'absolute') {
    throw new Error(`Cannot set an absolute time on an astronomical ${edge} endpoint.`);
  }
  return {
    ...configuration,
    schedules: {
      ...configuration.schedules,
      [scheduleId]: {
        ...schedule,
        [edge]: { kind: 'absolute', minutesOfDay },
      },
    },
  };
}

export function setScheduleEnabled(
  configuration: Configuration,
  scheduleId: string,
  enabled: boolean,
): Configuration {
  const schedule = configuration.schedules[scheduleId];
  if (!schedule) throw new Error(`Unknown schedule: ${scheduleId}`);
  if (schedule.enabled === enabled) return configuration;
  return {
    ...configuration,
    schedules: {
      ...configuration.schedules,
      [scheduleId]: { ...schedule, enabled },
    },
  };
}


export function setScheduleEndpoint(
  configuration: Configuration,
  scheduleId: string,
  edge: 'on' | 'off',
  endpoint: Endpoint,
): Configuration {
  validateEndpoint(endpoint);
  const schedule = configuration.schedules[scheduleId];
  if (!schedule) throw new Error(`Unknown schedule: ${scheduleId}`);
  return {
    ...configuration,
    schedules: {
      ...configuration.schedules,
      [scheduleId]: { ...schedule, [edge]: endpoint },
    },
  };
}

function validateEndpoint(endpoint: Endpoint): void {
  if (endpoint.kind === 'absolute') {
    if (!Number.isInteger(endpoint.minutesOfDay) || endpoint.minutesOfDay < 0 || endpoint.minutesOfDay >= 24 * 60) {
      throw new RangeError('minutesOfDay must be an integer from 0 through 1439.');
    }
    return;
  }
  if (!Number.isInteger(endpoint.offsetMinutes)) {
    throw new RangeError('Astronomical offsetMinutes must be an integer.');
  }
}
