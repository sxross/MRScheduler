/**
 * The upcoming event queue: the ordered state changes the scheduler must make.
 *
 * Regenerated wholesale whenever anything it depends on changes (PRD 28).
 * Correctness over incremental patching.
 */
import type { DateTime } from 'luxon';
import type { Configuration } from '../model/types.js';
import { solarDay, solarDayContaining, type SolarDay } from './solarDay.js';
import { mergeIntervals, resolveDay, type ResolvedCycle } from './resolver.js';
import { describeReason } from './summary.js';

export type DesiredState = 'on' | 'off';

export interface ScheduledEvent {
  deviceId: string;
  at: DateTime;
  desiredState: DesiredState;
  /** Human-readable cause, e.g. "Sunset - 20 min". */
  reason: string;
  /** Schedules responsible for this transition. */
  scheduleIds: string[];
}

export interface Conflict {
  scheduleId: string;
  deviceId: string;
  kind: 'constraint' | 'unresolvable';
  detail: string;
}

export interface EventQueue {
  events: ScheduledEvent[];
  conflicts: Conflict[];
}

function conflictsOf(cycles: readonly ResolvedCycle[], config: Configuration): Conflict[] {
  const out: Conflict[] = [];
  for (const cycle of cycles) {
    const schedule = config.schedules[cycle.scheduleId];
    if (!schedule) continue;
    for (const [kind, edge] of [['ON', cycle.on], ['OFF', cycle.off]] as const) {
      if (edge.verdict.status === 'violation') {
        out.push({
          scheduleId: cycle.scheduleId,
          deviceId: cycle.deviceId,
          kind: 'constraint',
          detail: `${kind} at ${edge.at.toFormat('h:mm a')} falls outside the permitted ${kind} window; this schedule cannot execute as configured.`,
        });
      } else if (edge.verdict.status === 'indeterminate') {
        out.push({
          scheduleId: cycle.scheduleId,
          deviceId: cycle.deviceId,
          kind: 'unresolvable',
          detail: edge.verdict.reason,
        });
      }
    }
  }
  return out;
}

/**
 * Build the queue covering `days` solar days starting from the one containing
 * `from`. Events at or before `from` are dropped; the caller gets only future
 * work.
 */
export function buildEventQueue(
  config: Configuration,
  from: DateTime,
  days = 2,
): EventQueue {
  const first = solarDayContaining(from, config.location);
  const events: ScheduledEvent[] = [];
  const conflicts: Conflict[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < days; i++) {
    const day: SolarDay = solarDay(
      first.start.plus({ days: i }).toFormat('yyyy-MM-dd'),
      config.location,
    );
    const resolution = resolveDay(config, day);
    conflicts.push(...conflictsOf(resolution.cycles, config));
    for (const u of resolution.unresolved) {
      conflicts.push({ scheduleId: u.scheduleId, deviceId: u.deviceId, kind: 'unresolvable', detail: u.reason });
    }

    for (const interval of mergeIntervals(resolution.cycles)) {
      const lead = resolution.cycles.find((c) => c.scheduleId === interval.scheduleIds[0]);
      const tail = resolution.cycles.find(
        (c) => interval.scheduleIds.includes(c.scheduleId) && c.intervalEnd === interval.end,
      );
      const onSchedule = lead ? config.schedules[lead.scheduleId] : undefined;
      const offSchedule = tail ? config.schedules[tail.scheduleId] : undefined;

      const edges: Array<[number, DesiredState, string]> = [
        [interval.start, 'on', onSchedule ? describeReason(onSchedule.on) : 'Schedule'],
        [interval.end, 'off', offSchedule ? describeReason(offSchedule.off) : 'Schedule'],
      ];

      for (const [ordinal, desiredState, reason] of edges) {
        const at = day.start.plus({ minutes: ordinal });
        if (at <= from) continue;
        // Adjacent solar days both cover the boundary; keep one copy.
        const key = `${interval.deviceId}|${at.toMillis()}|${desiredState}`;
        if (seen.has(key)) continue;
        seen.add(key);
        events.push({
          deviceId: interval.deviceId,
          at,
          desiredState,
          reason,
          scheduleIds: [...interval.scheduleIds],
        });
      }
    }
  }

  events.sort((a, b) => a.at.toMillis() - b.at.toMillis());
  return { events, conflicts };
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
