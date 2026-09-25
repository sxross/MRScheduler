/**
 * Compact noon-to-noon schedule overview.
 *
 * Keep the chart self-explanatory on a phone: the axis and schedule bars are
 * primary; astronomical boundaries are secondary. Constraint details belong
 * in diagnostics/editing, not as unexplained decorative bars.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { dayLength, solarDay, type Configuration } from '@mrscheduler/domain';
import { DEFAULT_VIEWPORT, buildTimeline, ordinalAtX, xOfOrdinal, type Viewport } from '@mrscheduler/timeline';
import { useTheme } from '../theme';

const BAR_HEIGHT = 16;
const LABEL_GUTTER = 94;
const HEADER_HEIGHT = 50;
const ROW_HEIGHT = 44;
const HANDLE_RADIUS = 8;

export function Timeline({
  config,
  anchorDate,
  onSelectDevice,
  onTrimSchedule,
}: {
  config: Configuration;
  anchorDate: string;
  onSelectDevice?: (deviceId: string) => void;
  onTrimSchedule?: (scheduleId: string, edge: 'on' | 'off', minutesOfDay: number) => void;
}) {
  const theme = useTheme();
  const [nativeWindow, setNativeWindow] = useState(() =>
    Platform.OS === 'web' ? { width: 0, height: 0 } : Dimensions.get('window'),
  );
  const landscape = nativeWindow.width > nativeWindow.height;
  const windowHeight = nativeWindow.height;
  const [width, setWidth] = useState(0);
  const [selectedBar, setSelectedBar] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<{ barKey: string; edge: 'on' | 'off'; x: number; label: string } | null>(null);
  const day = useMemo(() => solarDay(anchorDate, config.location), [anchorDate, config.location]);

  const viewport: Viewport = {
    ...DEFAULT_VIEWPORT,
    width,
    durationMinutes: dayLength(day),
    padding: LABEL_GUTTER,
    rightPadding: 14,
    headerHeight: HEADER_HEIGHT,
    rowHeight: ROW_HEIGHT,
  };
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = Dimensions.addEventListener('change', ({ window }) => setNativeWindow(window));
    return () => subscription.remove();
  }, []);

  // Pointer coordinates are viewport-specific. Never carry an in-flight preview
  // through rotation/resizing; committed schedule state will be reprojected below.
  useEffect(() => { setDragPreview(null); }, [width]);

  const layout = useMemo(
    () => (width > 0 ? buildTimeline(config, anchorDate, viewport, { tickMinutes: 360 }) : null),
    [config, anchorDate, width],
  );

  const sunset = layout?.astro.find((a) => a.event === 'sunset');
  const sunrise = layout?.astro.find((a) => a.event === 'sunrise');
  const dusk = layout?.astro.find((a) => a.event === 'dusk');
  const dawn = layout?.astro.find((a) => a.event === 'dawn');

  const trackContentHeight = layout?.rows.length ? layout.rows.length * ROW_HEIGHT : 0;
  const trackViewportHeight = Platform.OS === 'web'
    ? trackContentHeight
    : landscape
      ? Math.min(trackContentHeight, ROW_HEIGHT * 3.5)
      : Math.min(trackContentHeight, Math.max(ROW_HEIGHT * 4.5, Math.min(ROW_HEIGHT * 6.5, windowHeight * 0.34)));

  return (
    <View>
      <View
        style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      >
        {layout && (
          <>
            <Svg width={layout.width} height={HEADER_HEIGHT}>
              {layout.ticks.map((tick, i) => (
                <G key={`head-tick-${i}`}>
                  <Line x1={tick.x} y1={HEADER_HEIGHT - 8} x2={tick.x} y2={HEADER_HEIGHT} stroke={theme.gridline} strokeWidth={tick.major ? 1 : StyleSheet.hairlineWidth} />
                  <SvgText x={tick.x} y={16} fontFamily="system-ui, -apple-system, BlinkMacSystemFont, sans-serif" fontSize={10} fill={theme.textMuted} textAnchor={i === 0 ? 'start' : i === layout.ticks.length - 1 ? 'end' : 'middle'}>
                    {shortTime(tick.label)}
                  </SvgText>
                </G>
              ))}
              {sunset && <AstroBoundary x={sunset.x} label="Sunset" time={sunset.time} theme={theme} anchor="end" />}
              {sunrise && <AstroBoundary x={sunrise.x} label="Sunrise" time={sunrise.time} theme={theme} anchor="start" />}
            </Svg>
            {Platform.OS === 'web' ? (
              <View style={{ height: trackContentHeight }}>
              <Svg width={layout.width} height={layout.rows.length * ROW_HEIGHT}>
                {dusk && dawn && <Rect x={dusk.x} y={0} width={dawn.x - dusk.x} height={layout.rows.length * ROW_HEIGHT} fill={theme.night} />}
                {layout.ticks.map((tick, i) => (
                  <Line key={`body-tick-${i}`} x1={tick.x} y1={0} x2={tick.x} y2={layout.rows.length * ROW_HEIGHT} stroke={theme.gridline} strokeWidth={tick.major ? 1 : StyleSheet.hairlineWidth} />
                ))}
                {layout.rows.map((row) => {
                  const centerY = row.y - HEADER_HEIGHT + row.height / 2;
                  const barY = centerY - BAR_HEIGHT / 2;
                  return (
                    <G key={row.deviceId} onPress={() => onSelectDevice?.(row.deviceId)}>
                      <SvgText x={14} y={centerY + 4} fontFamily="system-ui, -apple-system, BlinkMacSystemFont, sans-serif" fontSize={12} fontWeight="600" fill={theme.text}>{row.name}</SvgText>
                      {row.bars.map((bar, i) => {
                        const barKey = `${row.deviceId}:${bar.scheduleIds.join(',')}:${i}`;
                        const selected = selectedBar === barKey;
                        const baseLeft = Math.round(bar.x);
                        const baseRight = Math.round(bar.x + bar.width);
                        const preview = dragPreview?.barKey === barKey ? dragPreview : null;
                        const left = preview?.edge === 'on' ? preview.x : baseLeft;
                        const right = preview?.edge === 'off' ? preview.x : baseRight;
                        const bx = Math.min(left, right - 2);
                        const bw = Math.max(right - bx, 2);
                        const startLabel = preview?.edge === 'on' ? preview.label : shortTime(bar.startLabel);
                        const endLabel = preview?.edge === 'off'
                          ? preview.label
                          : bar.continuesPast
                            ? shortTime(bar.endLabel)
                            : shortTime(bar.endLabel);
                        const schedule = bar.scheduleIds.length === 1 ? config.schedules[bar.scheduleIds[0]!] : undefined;
                        return (
                          <G key={barKey}>
                            <Rect x={bx} y={barY} width={bw} height={BAR_HEIGHT} fill={theme.bar} stroke={selected ? theme.text : 'none'} strokeWidth={selected ? 1.5 : 0} onPress={() => setSelectedBar(selected ? null : barKey)} />
                            {selected && <>
                              {schedule?.on.kind === 'absolute' && <TrimHandle x={bx} y={centerY} theme={theme} onDrag={(x, done) => previewTrim(barKey, schedule.id, 'on', x, viewport, day, baseRight, setDragPreview, onTrimSchedule)(done)} />}
                              {!bar.continuesPast && schedule?.off.kind === 'absolute' && <TrimHandle x={bx + bw} y={centerY} theme={theme} onDrag={(x, done) => previewTrim(barKey, schedule.id, 'off', x, viewport, day, baseLeft, setDragPreview, onTrimSchedule)(done)} />}
                              {bar.continuesPast && <ContinuationMark x={bx + bw} y={centerY} theme={theme} />}
                              <SvgText x={bx + 4} y={barY - 6} fontFamily="system-ui, -apple-system, BlinkMacSystemFont, sans-serif" fontSize={10} fontWeight="600" fill={theme.text}>{startLabel} → {endLabel}</SvgText>
                            </>}
                          </G>
                        );
                      })}
                      {row.blocked.length > 0 && <SvgText x={LABEL_GUTTER} y={centerY + 4} fontFamily="system-ui, -apple-system, BlinkMacSystemFont, sans-serif" fontSize={11} fill={theme.warning}>Cannot run today</SvgText>}
                    </G>
                  );
                })}
              </Svg>
              </View>
            ) : (
              <ScrollView
                style={{ height: trackViewportHeight }}
                nestedScrollEnabled
                showsVerticalScrollIndicator
                persistentScrollbar={false}
              >
              <Svg width={layout.width} height={layout.rows.length * ROW_HEIGHT}>
                {dusk && dawn && <Rect x={dusk.x} y={0} width={dawn.x - dusk.x} height={layout.rows.length * ROW_HEIGHT} fill={theme.night} />}
                {layout.ticks.map((tick, i) => (
                  <Line key={`body-tick-${i}`} x1={tick.x} y1={0} x2={tick.x} y2={layout.rows.length * ROW_HEIGHT} stroke={theme.gridline} strokeWidth={tick.major ? 1 : StyleSheet.hairlineWidth} />
                ))}
                {layout.rows.map((row) => {
                  const centerY = row.y - HEADER_HEIGHT + row.height / 2;
                  const barY = centerY - BAR_HEIGHT / 2;
                  return (
                    <G key={row.deviceId} onPress={() => onSelectDevice?.(row.deviceId)}>
                      <SvgText x={14} y={centerY + 4} fontFamily="system-ui, -apple-system, BlinkMacSystemFont, sans-serif" fontSize={12} fontWeight="600" fill={theme.text}>{row.name}</SvgText>
                      {row.bars.map((bar, i) => {
                        const barKey = `${row.deviceId}:${bar.scheduleIds.join(',')}:${i}`;
                        const selected = selectedBar === barKey;
                        const baseLeft = Math.round(bar.x);
                        const baseRight = Math.round(bar.x + bar.width);
                        const preview = dragPreview?.barKey === barKey ? dragPreview : null;
                        const left = preview?.edge === 'on' ? preview.x : baseLeft;
                        const right = preview?.edge === 'off' ? preview.x : baseRight;
                        const bx = Math.min(left, right - 2);
                        const bw = Math.max(right - bx, 2);
                        const startLabel = preview?.edge === 'on' ? preview.label : shortTime(bar.startLabel);
                        const endLabel = preview?.edge === 'off'
                          ? preview.label
                          : bar.continuesPast
                            ? shortTime(bar.endLabel)
                            : shortTime(bar.endLabel);
                        const schedule = bar.scheduleIds.length === 1 ? config.schedules[bar.scheduleIds[0]!] : undefined;
                        return (
                          <G key={barKey}>
                            <Rect x={bx} y={barY} width={bw} height={BAR_HEIGHT} fill={theme.bar} stroke={selected ? theme.text : 'none'} strokeWidth={selected ? 1.5 : 0} onPress={() => setSelectedBar(selected ? null : barKey)} />
                            {selected && <>
                              {schedule?.on.kind === 'absolute' && <TrimHandle x={bx} y={centerY} theme={theme} onDrag={(x, done) => previewTrim(barKey, schedule.id, 'on', x, viewport, day, baseRight, setDragPreview, onTrimSchedule)(done)} />}
                              {!bar.continuesPast && schedule?.off.kind === 'absolute' && <TrimHandle x={bx + bw} y={centerY} theme={theme} onDrag={(x, done) => previewTrim(barKey, schedule.id, 'off', x, viewport, day, baseLeft, setDragPreview, onTrimSchedule)(done)} />}
                              {bar.continuesPast && <ContinuationMark x={bx + bw} y={centerY} theme={theme} />}
                              <SvgText x={bx + 4} y={barY - 6} fontFamily="system-ui, -apple-system, BlinkMacSystemFont, sans-serif" fontSize={10} fontWeight="600" fill={theme.text}>{startLabel} → {endLabel}</SvgText>
                            </>}
                          </G>
                        );
                      })}
                      {row.blocked.length > 0 && <SvgText x={LABEL_GUTTER} y={centerY + 4} fontFamily="system-ui, -apple-system, BlinkMacSystemFont, sans-serif" fontSize={11} fill={theme.warning}>Cannot run today</SvgText>}
                    </G>
                  );
                })}
              </Svg>
              </ScrollView>
            )}
          </>
        )}
      </View>
      <View style={styles.legend}>
        <View style={[styles.legendSwatch, { backgroundColor: theme.bar }]} />
        <Text style={[styles.legendText, { color: theme.textMuted }]}>Scheduled on</Text>
        <View style={[styles.nightSwatch, { backgroundColor: theme.night }]} />
        <Text style={[styles.legendText, { color: theme.textMuted }]}>Night</Text>
        <View style={[styles.clampSwatch, { borderColor: theme.ghost }]} />
        <Text style={[styles.legendText, { color: theme.textMuted }]}>Adjusted</Text>
      </View>
    </View>
  );
}


function ContinuationMark({ x, y, theme }: { x: number; y: number; theme: ReturnType<typeof useTheme> }) {
  return (
    <G>
      <Line x1={x - 8} y1={y - 5} x2={x - 2} y2={y} stroke={theme.bar} strokeWidth={2} />
      <Line x1={x - 8} y1={y + 5} x2={x - 2} y2={y} stroke={theme.bar} strokeWidth={2} />
    </G>
  );
}

function TrimHandle({
  x, y, theme, onDrag,
}: {
  x: number; y: number; theme: ReturnType<typeof useTheme>;
  onDrag?: (x: number, done: boolean) => void;
}) {
  const drag = useRef({ active: false, startClientX: 0, originX: x });
  const pointerProps = onDrag ? ({
    onPointerDown: (event: any) => {
      drag.current.active = true;
      drag.current.startClientX = event.nativeEvent?.clientX ?? event.clientX ?? 0;
      drag.current.originX = x;
      event.currentTarget?.setPointerCapture?.(event.nativeEvent?.pointerId ?? event.pointerId);
      event.preventDefault?.();
    },
    onPointerMove: (event: any) => {
      if (!drag.current.active) return;
      const clientX = event.nativeEvent?.clientX ?? event.clientX ?? drag.current.startClientX;
      onDrag(drag.current.originX + clientX - drag.current.startClientX, false);
      event.preventDefault?.();
    },
    onPointerUp: (event: any) => {
      if (!drag.current.active) return;
      const clientX = event.nativeEvent?.clientX ?? event.clientX ?? drag.current.startClientX;
      drag.current.active = false;
      onDrag(drag.current.originX + clientX - drag.current.startClientX, true);
      event.preventDefault?.();
    },
    onPointerCancel: () => { drag.current.active = false; },
  } as any) : {};
  return (
    <G {...pointerProps}>
      <Rect x={x - 16} y={y - 22} width={32} height={44} fill="transparent" pointerEvents="auto" />
      <Rect x={x - 5} y={y - BAR_HEIGHT / 2 - 4} width={10} height={BAR_HEIGHT + 8} rx={3} fill={theme.surface} stroke={theme.bar} strokeWidth={2} />
      <Line x1={x} y1={y - 5} x2={x} y2={y + 5} stroke={theme.bar} strokeWidth={1.5} />
    </G>
  );
}

function previewTrim(
  barKey: string,
  scheduleId: string,
  edge: 'on' | 'off',
  x: number,
  viewport: Viewport,
  day: ReturnType<typeof solarDay>,
  oppositeX: number,
  setPreview: (value: { barKey: string; edge: 'on' | 'off'; x: number; label: string } | null) => void,
  commit?: (scheduleId: string, edge: 'on' | 'off', minutesOfDay: number) => void,
) {
  const oppositeOrdinal = Math.round(ordinalAtX(oppositeX, viewport));
  const maxOrdinal = dayLength(day);
  const ordinal = Math.min(
    edge === 'on' ? Math.max(0, oppositeOrdinal - 1) : maxOrdinal,
    Math.max(edge === 'off' ? Math.min(maxOrdinal, oppositeOrdinal + 1) : 0, Math.round(ordinalAtX(x, viewport))),
  );
  const at = day.start.plus({ minutes: ordinal });
  const minutesOfDay = at.hour * 60 + at.minute;
  const label = at.toFormat('h:mm a');
  const snappedX = xOfOrdinal(ordinal, viewport);
  setPreview({ barKey, edge, x: snappedX, label });
  return (done: boolean) => {
    if (done) {
      // Clear preview first so the next render can only come from committed domain state.
      setPreview(null);
      commit?.(scheduleId, edge, minutesOfDay);
    }
  };
}

function AstroBoundary({
  x,
  label,
  time,
  theme,
  anchor,
}: {
  x: number;
  label: string;
  time: string;
  theme: ReturnType<typeof useTheme>;
  anchor: 'start' | 'end';
}) {
  const dx = anchor === 'start' ? 5 : -5;
  return (
    <G>
      <Line
        x1={x}
        y1={24}
        x2={x}
        y2={HEADER_HEIGHT - 3}
        stroke={theme.accent}
        strokeWidth={1}
      />
      <SvgText
        x={x + dx}
        y={31}
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
        fontSize={9}
        fontWeight="600"
        fill={theme.accent}
        textAnchor={anchor}
      >
        {label}
      </SvgText>
      <SvgText
        x={x + dx}
        y={42}
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
        fontSize={9}
        fill={theme.textMuted}
        textAnchor={anchor}
      >
        {shortTime(time)}
      </SvgText>
    </G>
  );
}

function shortTime(label: string): string {
  return label.replace(':00 ', ' ').replace('12 PM', 'Noon').replace('12 AM', 'Midnight');
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  legendSwatch: { width: 18, height: 6, borderRadius: 3 },
  nightSwatch: { width: 18, height: 10, borderRadius: 2 },
  clampSwatch: { width: 8, height: 8, borderRadius: 4, borderWidth: 1.5 },
  legendText: { fontSize: 11, marginRight: 6 },
});
