/**
 * Turns schedule definitions into concrete cycles for a solar day, then
 * resolves overlapping cycles into device state.
 *
 * Resolution rule (PRD 14): a device is ON whenever at least one enabled,
 * executable schedule requires it to be ON. No priority system.
 */
import type { DateTime } from 'luxon';
import type {
  Configuration,
  Schedule,
  TransitionKind,
  Weekday,
} from '../model/types.js';
import { WEEKDAYS } from '../model/types.js';
import { MINUTES_PER_DAY, resolveEndpoint, type SolarDay } from './solarDay.js';
import { evaluateTransition, isPermitted, type Verdict } from './constraints.js';

export interface CycleEdge {
  at: DateTime;
  /** Natural position on the noon-origin axis; what constraints are judged on. */
  ordinal: number;
  verdict: Verdict;
}

export interface ResolvedCycle {
  scheduleId: string;
  deviceId: string;
  on: CycleEdge;
  off: CycleEdge;
  /** OFF ordinal advanced by a day where needed so the interval reads forward. */
  intervalEnd: number;
  executable: boolean;
}

export interface UnresolvedCycle {
  scheduleId: string;
  deviceId: string;
  reason: string;
}

export interface DayResolution {
  day: SolarDay;
  cycles: ResolvedCycle[];
  /** Cycles that could not be placed at all (e.g. polar latitudes). */
  unresolved: UnresolvedCycle[];
}

function weekdayOf(at: DateTime): Weekday {
  // luxon weekday: 1 = Monday .. 7 = Sunday; WEEKDAYS starts at Sunday.
  return WEEKDAYS[at.weekday % 7]!;
}

function exemptions(schedule: Schedule): readonly TransitionKind[] {
  return schedule.exemptFrom ?? [];
}

/** Resolve every enabled schedule that starts on `day` into a concrete cycle. */
export function resolveDay(config: Configuration, day: SolarDay): DayResolution {
  const cycles: ResolvedCycle[] = [];
  const unresolved: UnresolvedCycle[] = [];

  for (const schedule of Object.values(config.schedules)) {
    const device = config.devices[schedule.deviceId];
    if (!schedule.enabled || !device?.enabled) continue;

    const on = resolveEndpoint(schedule.on, day, config.location);
    const off = resolveEndpoint(schedule.off, day, config.location);
    if (!on.ok || !off.ok) {
      unresolved.push({
        scheduleId: schedule.id,
        deviceId: schedule.deviceId,
        reason: on.ok ? (off as { reason: string }).reason : on.reason,
      });
      continue;
    }

    // Day-of-week keys off the ON edge, so "Friday" means the cycle that
    // starts Friday evening even when it ends Saturday morning.
    if (!schedule.days.includes(weekdayOf(on.at))) continue;

    const exempt = exemptions(schedule);
    const onVerdict = evaluateTransition('on', on.ordinal, config.constraints, exempt, day, config.location);
    const offVerdict = evaluateTransition('off', off.ordinal, config.constraints, exempt, day, config.location);

    // An OFF at or before its ON belongs to the next turn of the axis.
    const intervalEnd = off.ordinal > on.ordinal ? off.ordinal : off.ordinal + MINUTES_PER_DAY;

    cycles.push({
      scheduleId: schedule.id,
      deviceId: schedule.deviceId,
      on: { at: on.at, ordinal: on.ordinal, verdict: onVerdict },
      off: { at: off.at, ordinal: off.ordinal, verdict: offVerdict },
      intervalEnd,
      executable: isPermitted(onVerdict) && isPermitted(offVerdict),
    });
  }

  return { day, cycles, unresolved };
}

export interface DeviceInterval {
  deviceId: string;
  start: number;
  end: number;
  /** Every schedule contributing to this merged interval. */
  scheduleIds: string[];
}

/**
 * Merge overlapping cycles per device into the intervals the device is ON.
 *
 * Only executable cycles contribute. A cycle blocked by a constraint is
 * reported as a conflict elsewhere and silently rewritten nowhere.
 */
export function mergeIntervals(cycles: readonly ResolvedCycle[]): DeviceInterval[] {
  const byDevice = new Map<string, ResolvedCycle[]>();
  for (const cycle of cycles) {
    if (!cycle.executable) continue;
    const list = byDevice.get(cycle.deviceId);
    if (list) list.push(cycle);
    else byDevice.set(cycle.deviceId, [cycle]);
  }

  const merged: DeviceInterval[] = [];
  for (const [deviceId, list] of byDevice) {
    const sorted = [...list].sort((a, b) => a.on.ordinal - b.on.ordinal);
    let current: DeviceInterval | undefined;
    for (const cycle of sorted) {
      if (current && cycle.on.ordinal <= current.end) {
        current.end = Math.max(current.end, cycle.intervalEnd);
        current.scheduleIds.push(cycle.scheduleId);
        continue;
      }
      current = {
        deviceId,
        start: cycle.on.ordinal,
        end: cycle.intervalEnd,
        scheduleIds: [cycle.scheduleId],
      };
      merged.push(current);
    }
  }
  return merged;
}
