/**
 * Turns schedule definitions into concrete cycles for a solar day, then
 * resolves overlapping cycles into device state.
 *
 * Resolution rule (PRD 14): a device is ON whenever at least one enabled,
 * executable schedule requires it to be ON. No priority system.
 */
import type { DateTime } from 'luxon';
import type { Configuration, Schedule, ScheduleKind, Weekday } from '../model/types';
import { WEEKDAYS } from '../model/types';
import { MINUTES_PER_DAY, resolveEndpoint, type SolarDay } from './solarDay';
import { evaluateTransition, type Verdict } from './constraints';

export interface CycleEdge {
  /** Where the user's rule puts this edge, before any fence is applied. */
  requestedAt: DateTime;
  /** Where the scheduler will actually act. Differs when clamped. */
  at: DateTime;
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
  /** Clamping inverted the interval, leaving nothing to execute. */
  collapsed: boolean;
}

export interface DayResolution {
  day: SolarDay;
  cycles: ResolvedCycle[];
  unresolved: UnresolvedCycle[];
}

function weekdayOf(at: DateTime): Weekday {
  // luxon weekday: 1 = Monday .. 7 = Sunday; WEEKDAYS starts at Sunday.
  return WEEKDAYS[at.weekday % 7]!;
}

export function kindOf(schedule: Schedule): ScheduleKind {
  return schedule.kind ?? 'governed';
}

/** Resolve every enabled schedule that starts on `day` into a concrete cycle. */
export function resolveDay(config: Configuration, day: SolarDay): DayResolution {
  const cycles: ResolvedCycle[] = [];
  const unresolved: UnresolvedCycle[] = [];

  for (const schedule of Object.values(config.schedules)) {
    const device = config.devices[schedule.deviceId];
    if (!schedule.enabled || !device?.enabled) continue;

    const fail = (reason: string, collapsed = false) =>
      unresolved.push({ scheduleId: schedule.id, deviceId: schedule.deviceId, reason, collapsed });

    const on = resolveEndpoint(schedule.on, day, config.location);
    const off = resolveEndpoint(schedule.off, day, config.location);
    if (!on.ok || !off.ok) {
      fail(on.ok ? (off as { reason: string }).reason : on.reason);
      continue;
    }

    // Day-of-week keys off the ON edge, so "Friday" means the cycle that
    // starts Friday evening even when it ends Saturday morning.
    if (!schedule.days.includes(weekdayOf(on.at))) continue;

    const kind = kindOf(schedule);
    const onVerdict = evaluateTransition('on', on.ordinal, config.constraints, kind, day, config.location);
    const offVerdict = evaluateTransition('off', off.ordinal, config.constraints, kind, day, config.location);
    if (onVerdict.status === 'indeterminate') { fail(onVerdict.reason); continue; }
    if (offVerdict.status === 'indeterminate') { fail(offVerdict.reason); continue; }

    // Clamping can in principle drag the edges past each other. Detect it by
    // comparing against the ordering the user asked for rather than letting
    // the interval silently wrap into a near-24-hour ON.
    if (off.ordinal > on.ordinal && offVerdict.ordinal <= onVerdict.ordinal) {
      fail('Constraint clamping leaves this schedule with no time to run.', true);
      continue;
    }

    const intervalEnd =
      offVerdict.ordinal > onVerdict.ordinal
        ? offVerdict.ordinal
        : offVerdict.ordinal + MINUTES_PER_DAY;

    cycles.push({
      scheduleId: schedule.id,
      deviceId: schedule.deviceId,
      on: {
        requestedAt: on.at,
        at: day.start.plus({ minutes: onVerdict.ordinal }),
        ordinal: onVerdict.ordinal,
        verdict: onVerdict,
      },
      off: {
        requestedAt: off.at,
        at: day.start.plus({ minutes: offVerdict.ordinal }),
        ordinal: offVerdict.ordinal,
        verdict: offVerdict,
      },
      intervalEnd,
      executable: true,
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

/** Merge overlapping cycles per device into the intervals the device is ON. */
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

/** Every adjustment made on a day, for the timeline and the diagnostics view. */
export interface Adjustment {
  scheduleId: string;
  deviceId: string;
  transition: 'on' | 'off';
  requestedAt: DateTime;
  effectiveAt: DateTime;
  bound: 'from' | 'to';
}

export function adjustmentsOf(cycles: readonly ResolvedCycle[]): Adjustment[] {
  const out: Adjustment[] = [];
  for (const cycle of cycles) {
    for (const [transition, edge] of [['on', cycle.on], ['off', cycle.off]] as const) {
      if (edge.verdict.status !== 'clamped') continue;
      out.push({
        scheduleId: cycle.scheduleId,
        deviceId: cycle.deviceId,
        transition,
        requestedAt: edge.requestedAt,
        effectiveAt: edge.at,
        bound: edge.verdict.bound,
      });
    }
  }
  return out;
}
