/**
 * Mapping between the engine's noon-origin axis and screen coordinates.
 *
 * The timeline is drawn noon to noon rather than midnight to midnight. A porch
 * cycle running dusk -> sunrise is then a single continuous bar with midnight in
 * the middle, instead of two stumps clinging to opposite edges of the screen.
 * It also puts the interesting region -- dusk through dawn -- in the centre.
 */
import { MINUTES_PER_DAY } from '@mrscheduler/domain';

export interface Viewport {
  width: number;
  /** Left inset; normally reserves room for device labels. */
  padding: number;
  /** Optional right inset. Defaults to padding for backwards compatibility. */
  rightPadding?: number;
  rowHeight: number;
  /** Vertical space above the first device row, for the axis and astro marks. */
  headerHeight: number;
}

export const DEFAULT_VIEWPORT: Omit<Viewport, 'width'> = {
  padding: 16,
  rowHeight: 56,
  headerHeight: 72,
};

export function plotWidth(viewport: Viewport): number {
  return Math.max(0, viewport.width - viewport.padding - (viewport.rightPadding ?? viewport.padding));
}

/** Screen x for a position on the noon-origin axis. */
export function xOfOrdinal(ordinal: number, viewport: Viewport): number {
  return viewport.padding + (ordinal / MINUTES_PER_DAY) * plotWidth(viewport);
}

/** Inverse of {@link xOfOrdinal}, for dragging an endpoint. */
export function ordinalAtX(x: number, viewport: Viewport): number {
  const span = plotWidth(viewport);
  if (span <= 0) return 0;
  return ((x - viewport.padding) / span) * MINUTES_PER_DAY;
}

/**
 * Wall-clock minutes-of-day for a noon-origin ordinal.
 *
 * Truncates rather than rounds, so a label agrees with the same instant
 * formatted by the domain: an event at 17:34:40 reads 5:34 PM in both.
 */
export function minutesOfDayAt(ordinal: number): number {
  return (((Math.floor(ordinal) + 720) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/** e.g. 335 -> "5:34 PM". */
export function clockLabel(ordinal: number): string {
  const m = minutesOfDayAt(ordinal);
  const h24 = Math.floor(m / 60);
  const suffix = h24 < 12 ? 'AM' : 'PM';
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(m % 60).padStart(2, '0')} ${suffix}`;
}

/** Snap a dragged ordinal to the nearest `step` minutes, clamped to the day. */
export function snap(ordinal: number, step = 5): number {
  const snapped = Math.round(ordinal / step) * step;
  return Math.min(MINUTES_PER_DAY, Math.max(0, snapped));
}
