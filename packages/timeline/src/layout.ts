/**
 * Pure geometry for the timeline. No rendering, no React -- this is the part
 * that can be tested, and both the axis maths and the bar placement live here
 * so a renderer only has to paint what it is handed.
 */
import {
  dayLength,
  adjustmentsOf,
  mergeIntervals,
  resolveDay,
  resolveEndpoint,
  solarDay,
  type AstroEventName,
  type Configuration,
  type TransitionKind,
} from '@mrscheduler/domain';
import { plotWidth, xOfOrdinal, type Viewport } from './scale';

export interface AxisTick {
  x: number;
  label: string;
  /** Midnight and noon are emphasised; the rest are minor gridlines. */
  major: boolean;
}

export interface AstroMark {
  event: AstroEventName;
  x: number;
  label: string;
  time: string;
}

/** The region in which a transition is permitted, drawn behind the rows. */
export interface FenceBand {
  transition: TransitionKind;
  x: number;
  width: number;
  fromLabel: string;
  toLabel: string;
}

export interface Bar {
  scheduleIds: string[];
  x: number;
  width: number;
  startLabel: string;
  endLabel: string;
  /** The interval runs past the right edge of this day. */
  continuesPast: boolean;
}

/** A clamp: where the rule asked for an edge, and where it actually lands. */
export interface ClampMark {
  scheduleId: string;
  transition: TransitionKind;
  requestedX: number;
  effectiveX: number;
  requestedLabel: string;
  effectiveLabel: string;
}

export interface BlockedNote {
  scheduleId: string;
  detail: string;
}

export interface DeviceRow {
  deviceId: string;
  name: string;
  y: number;
  height: number;
  bars: Bar[];
  clamps: ClampMark[];
  blocked: BlockedNote[];
}

export interface TimelineLayout {
  width: number;
  height: number;
  anchorDate: string;
  ticks: AxisTick[];
  /** Centre of the plot: the midnight the solar day contains. */
  midnightX: number;
  astro: AstroMark[];
  fences: FenceBand[];
  rows: DeviceRow[];
}

const ASTRO_LABEL: Record<AstroEventName, string> = {
  sunrise: 'Sunrise',
  sunset: 'Sunset',
  dawn: 'Dawn',
  dusk: 'Dusk',
  nauticalDawn: 'N. dawn',
  nauticalDusk: 'N. dusk',
};

/** Hour ticks every `everyMinutes`, labelled on the wall clock. */
function buildTicks(viewport: Viewport, everyMinutes: number, day: ReturnType<typeof solarDay>): AxisTick[] {
  const ticks: AxisTick[] = [];
  for (let wallMinutes = 0; wallMinutes <= 1440; wallMinutes += everyMinutes) {
    const minutesOfDay = (wallMinutes + 720) % 1440;
    const at = (wallMinutes < 720 ? day.start : day.end).set({
      hour: Math.floor(minutesOfDay / 60), minute: minutesOfDay % 60,
    });
    const ordinal = at.diff(day.start, 'minutes').minutes;
    const label = at.toFormat('h:mm a');
    const minutes = at.hour * 60 + at.minute;
    ticks.push({ x: xOfOrdinal(ordinal, viewport), label, major: minutes === 0 || minutes === 720 });
  }
  return ticks;
}

/**
 * Build everything the renderer needs for one solar day.
 *
 * Bars are clipped to the day. An interval that runs past the right edge is
 * flagged rather than truncated silently, so the renderer can show that it
 * continues.
 */
export function buildTimeline(
  config: Configuration,
  anchorDate: string,
  viewport: Viewport,
  options: { tickMinutes?: number } = {},
): TimelineLayout {
  const day = solarDay(anchorDate, config.location);
  const axis = { ...viewport, durationMinutes: dayLength(day) };
  const resolution = resolveDay(config, day);
  const intervals = mergeIntervals(resolution.cycles);
  const clamps = adjustmentsOf(resolution.cycles);

  const astro: AstroMark[] = [];
  for (const event of ['sunset', 'dusk', 'dawn', 'sunrise'] as const) {
    const r = resolveEndpoint({ kind: 'astro', event, offsetMinutes: 0 }, day, config.location);
    if (!r.ok) continue;
    astro.push({
      event,
      x: xOfOrdinal(r.ordinal, axis),
      label: ASTRO_LABEL[event],
      time: r.at.toFormat('h:mm a'),
    });
  }

  const fences: FenceBand[] = [];
  for (const transition of ['on', 'off'] as const) {
    const window = config.constraints[transition];
    if (!window) continue;
    const from = resolveEndpoint({ kind: 'astro', ...window.from }, day, config.location);
    const to = resolveEndpoint({ kind: 'astro', ...window.to }, day, config.location);
    if (!from.ok || !to.ok) continue;
    const x = xOfOrdinal(from.ordinal, axis);
    fences.push({
      transition,
      x,
      width: xOfOrdinal(to.ordinal, axis) - x,
      fromLabel: from.at.toFormat('h:mm a'),
      toLabel: to.at.toFormat('h:mm a'),
    });
  }

  const rows: DeviceRow[] = [];
  let y = viewport.headerHeight;
  for (const device of Object.values(config.devices)) {
    const bars: Bar[] = intervals
      .filter((i) => i.deviceId === device.id)
      .map((interval) => {
        const visibleStart = Math.max(0, interval.start);
        const visibleEnd = Math.min(interval.end, dayLength(day));
        if (visibleEnd <= visibleStart) return null;
        const x = xOfOrdinal(visibleStart, axis);
        return {
          scheduleIds: [...interval.scheduleIds],
          x,
          width: xOfOrdinal(visibleEnd, axis) - x,
          // Labels must describe the same effective ordinals that produced
          // the geometry. Authored/requested values belong in edit detail.
          startLabel: day.start.plus({ minutes: interval.start }).toFormat('h:mm a'),
          endLabel: day.start.plus({ minutes: interval.end }).toFormat('h:mm a'),
          continuesPast: interval.end > dayLength(day),
        };
      })
      .filter((bar): bar is Bar => bar !== null);

    rows.push({
      deviceId: device.id,
      name: device.name,
      y,
      height: viewport.rowHeight,
      bars,
      clamps: clamps
        .filter((a) => a.deviceId === device.id)
        .map((a) => {
          const requested = a.requestedAt.diff(day.start, 'minutes').minutes;
          const effective = a.effectiveAt.diff(day.start, 'minutes').minutes;
          return {
            scheduleId: a.scheduleId,
            transition: a.transition,
            requestedX: xOfOrdinal(requested, axis),
            effectiveX: xOfOrdinal(effective, axis),
            requestedLabel: a.requestedAt.toFormat('h:mm a'),
            effectiveLabel: a.effectiveAt.toFormat('h:mm a'),
          };
        }),
      blocked: resolution.unresolved
        .filter((u) => u.deviceId === device.id)
        .map((u) => ({ scheduleId: u.scheduleId, detail: u.reason })),
    });
    y += viewport.rowHeight;
  }

  return {
    width: viewport.width,
    height: y,
    anchorDate,
    ticks: buildTicks(axis, options.tickMinutes ?? 180, day),
    midnightX: xOfOrdinal(day.end.startOf('day').diff(day.start, 'minutes').minutes, axis),
    astro,
    fences,
    rows,
  };
}

export { plotWidth };
