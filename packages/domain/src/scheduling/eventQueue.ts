/**
 * The upcoming event queue: the ordered state changes the scheduler must make.
 *
 * Regenerated wholesale whenever anything it depends on changes (PRD 28).
 * Correctness over incremental patching.
 */
import type { DateTime } from 'luxon';
import type { Configuration } from '../model/types';
import { solarDay, solarDayContaining, type SolarDay } from './solarDay';
import {
  adjustmentsOf,
  mergeIntervals,
  resolveDay,
  type Adjustment,
  type ResolvedCycle,
} from './resolver';
import { describeReason } from './summary';

export type DesiredState = 'on' | 'off';

export interface ScheduledEvent {
  deviceId: string;
  at: DateTime;
  desiredState: DesiredState;
  /** Human-readable cause, e.g. "Sunset - 20 min". */
  reason: string;
  /** Present when a fence moved this edge; the time the rule asked for. */
  adjustedFrom?: DateTime;
  /** Schedules responsible for this transition. */
  scheduleIds: string[];
}

export interface Blocked {
  scheduleId: string;
  deviceId: string;
  detail: string;
  collapsed: boolean;
}

export interface EventQueue {
  events: ScheduledEvent[];
  /** Fence adjustments applied, so nothing is changed without being shown. */
  adjustments: Adjustment[];
  /** Schedules that produced no event at all, with the reason why. */
  blocked: Blocked[];
}

function edgeOf(cycles: readonly ResolvedCycle[], scheduleId: string | undefined) {
  return cycles.find((c) => c.scheduleId === scheduleId);
}

/**
 * Build the queue covering `days` solar days starting from the one containing
 * `from`. Events at or before `from` are dropped.
 */
export function buildEventQueue(config: Configuration, from: DateTime, days = 2): EventQueue {
  const first = solarDayContaining(from, config.location);
  const events: ScheduledEvent[] = [];
  const adjustments: Adjustment[] = [];
  const blocked: Blocked[] = [];
  const allIntervals: Array<{ deviceId: string; start: DateTime; end: DateTime; scheduleIds: string[]; opening: ResolvedCycle | undefined; closing: ResolvedCycle | undefined }> = [];

  // Include the preceding solar day: its interval may close after this noon.
  for (let i = -1; i < days; i++) {
    const day: SolarDay = solarDay(
      first.start.plus({ days: i }).toFormat('yyyy-MM-dd'),
      config.location,
    );
    const resolution = resolveDay(config, day);
    if (i >= 0) {
      adjustments.push(...adjustmentsOf(resolution.cycles));
      for (const u of resolution.unresolved) {
        blocked.push({
          scheduleId: u.scheduleId,
          deviceId: u.deviceId,
          detail: u.reason,
          collapsed: u.collapsed,
        });
      }
    }

    for (const interval of mergeIntervals(resolution.cycles)) {
      const opening = edgeOf(resolution.cycles, interval.scheduleIds[0]);
      const closing = resolution.cycles.find(
        (c) => interval.scheduleIds.includes(c.scheduleId) && c.intervalEnd === interval.end,
      );
      allIntervals.push({
        deviceId: interval.deviceId,
        start: day.start.plus({ minutes: interval.start }),
        end: day.start.plus({ minutes: interval.end }),
        scheduleIds: [...interval.scheduleIds],
        opening,
        closing,
      });
    }
  }

  // Merge across solar-day boundaries as well as within each day. A previous
  // day's OFF must not switch a device off while today's schedule needs it ON.
  allIntervals.sort((a, b) => a.start.toMillis() - b.start.toMillis());
  const merged: typeof allIntervals = [];
  for (const interval of allIntervals) {
    const previous = [...merged].reverse().find((item) => item.deviceId === interval.deviceId && item.end >= interval.start);
    if (!previous) { merged.push(interval); continue; }
    previous.scheduleIds.push(...interval.scheduleIds);
    if (interval.end > previous.end) {
      previous.end = interval.end;
      previous.closing = interval.closing;
    }
  }

  for (const interval of merged) {
    for (const edge of [
      { at: interval.start, desiredState: 'on' as const, cycle: interval.opening, side: 'on' as const },
      { at: interval.end, desiredState: 'off' as const, cycle: interval.closing, side: 'off' as const },
    ]) {
      if (edge.at <= from) continue;
      const schedule = edge.cycle ? config.schedules[edge.cycle.scheduleId] : undefined;
      const cycleEdge = edge.cycle?.[edge.side];
      const event: ScheduledEvent = {
        deviceId: interval.deviceId,
        at: edge.at,
        desiredState: edge.desiredState,
        reason: schedule ? describeReason(schedule[edge.side]) : 'Schedule',
        scheduleIds: [...new Set(interval.scheduleIds)],
      };
      if (cycleEdge?.verdict.status === 'clamped') event.adjustedFrom = cycleEdge.requestedAt;
      events.push(event);
    }
  }

  events.sort((a, b) => a.at.toMillis() - b.at.toMillis());
  return { events, adjustments, blocked };
}

/** The state a device should be in at `instant`, per the current configuration. */
export function desiredStateAt(
  config: Configuration,
  deviceId: string,
  instant: DateTime,
): DesiredState {
  const day = solarDayContaining(instant, config.location);
  // An interval opened on the previous solar day can still be running.
  for (const offset of [-1, 0]) {
    const d = solarDay(day.start.plus({ days: offset }).toFormat('yyyy-MM-dd'), config.location);
    for (const interval of mergeIntervals(resolveDay(config, d).cycles)) {
      if (interval.deviceId !== deviceId) continue;
      if (instant >= d.start.plus({ minutes: interval.start }) && instant < d.start.plus({ minutes: interval.end })) return 'on';
    }
  }
  return 'off';
}
