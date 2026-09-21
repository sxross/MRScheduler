/**
 * The upcoming event queue: the ordered state changes the scheduler must make.
 *
 * Regenerated wholesale whenever anything it depends on changes (PRD 28).
 * Correctness over incremental patching.
 */
import type { DateTime } from 'luxon';
import type { Configuration } from '../model/types.js';
import { solarDay, solarDayContaining, type SolarDay } from './solarDay.js';
import {
  adjustmentsOf,
  mergeIntervals,
  resolveDay,
  type Adjustment,
  type ResolvedCycle,
} from './resolver.js';
import { describeReason } from './summary.js';

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
  const seen = new Set<string>();

  for (let i = 0; i < days; i++) {
    const day: SolarDay = solarDay(
      first.start.plus({ days: i }).toFormat('yyyy-MM-dd'),
      config.location,
    );
    const resolution = resolveDay(config, day);
    adjustments.push(...adjustmentsOf(resolution.cycles));
    for (const u of resolution.unresolved) {
      blocked.push({
        scheduleId: u.scheduleId,
        deviceId: u.deviceId,
        detail: u.reason,
        collapsed: u.collapsed,
      });
    }

    for (const interval of mergeIntervals(resolution.cycles)) {
      const opening = edgeOf(resolution.cycles, interval.scheduleIds[0]);
      const closing = resolution.cycles.find(
        (c) => interval.scheduleIds.includes(c.scheduleId) && c.intervalEnd === interval.end,
      );

      const edges = [
        { ordinal: interval.start, desiredState: 'on' as const, cycle: opening, side: 'on' as const },
        { ordinal: interval.end, desiredState: 'off' as const, cycle: closing, side: 'off' as const },
      ];

      for (const edge of edges) {
        const at = day.start.plus({ minutes: edge.ordinal });
        if (at <= from) continue;
        // Adjacent solar days both cover the boundary; keep one copy.
        const key = `${interval.deviceId}|${at.toMillis()}|${edge.desiredState}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const schedule = edge.cycle ? config.schedules[edge.cycle.scheduleId] : undefined;
        const cycleEdge = edge.cycle?.[edge.side];
        const event: ScheduledEvent = {
          deviceId: interval.deviceId,
          at,
          desiredState: edge.desiredState,
          reason: schedule ? describeReason(schedule[edge.side]) : 'Schedule',
          scheduleIds: [...interval.scheduleIds],
        };
        if (cycleEdge?.verdict.status === 'clamped') {
          event.adjustedFrom = cycleEdge.requestedAt;
        }
        events.push(event);
      }
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
  const ordinal = instant.diff(day.start, 'minutes').minutes;
  // An interval opened on the previous solar day can still be running.
  for (const offset of [-1, 0]) {
    const d = solarDay(day.start.plus({ days: offset }).toFormat('yyyy-MM-dd'), config.location);
    const shift = offset === 0 ? 0 : 1440;
    for (const interval of mergeIntervals(resolveDay(config, d).cycles)) {
      if (interval.deviceId !== deviceId) continue;
      if (ordinal + shift >= interval.start && ordinal + shift < interval.end) return 'on';
    }
  }
  return 'off';
}
