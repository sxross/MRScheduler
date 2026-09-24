/**
 * Compact noon-to-noon schedule overview.
 *
 * Keep the chart self-explanatory on a phone: the axis and schedule bars are
 * primary; astronomical boundaries are secondary. Constraint details belong
 * in diagnostics/editing, not as unexplained decorative bars.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import type { Configuration } from '@mrscheduler/domain';
import { DEFAULT_VIEWPORT, buildTimeline, clockLabel, ordinalAtX, type Viewport } from '@mrscheduler/timeline';
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
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const landscape = windowWidth > windowHeight;
  const [width, setWidth] = useState(0);
  const [selectedBar, setSelectedBar] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<{ barKey: string; edge: 'on' | 'off'; x: number; label: string } | null>(null);
  const [nativeSelected, setNativeSelected] = useState<{ barKey: string; scheduleId: string; left: number; right: number; y: number; continuesPast: boolean } | null>(null);

  const viewport: Viewport = {
    ...DEFAULT_VIEWPORT,
    width,
    padding: LABEL_GUTTER,
    rightPadding: 14,
    headerHeight: HEADER_HEIGHT,
    rowHeight: ROW_HEIGHT,
  };
  // Pointer coordinates are viewport-specific. Never carry an in-flight preview
  // through rotation/resizing; committed schedule state will be reprojected below.
  useEffect(() => { setDragPreview(null); setNativeSelected(null); }, [width]);

  const layout = useMemo(
    () => (width > 0 ? buildTimeline(config, anchorDate, viewport, { tickMinutes: 360 }) : null),
    [config, anchorDate, width],
  );

  const sunset = layout?.astro.find((a) => a.event === 'sunset');
  const sunrise = layout?.astro.find((a) => a.event === 'sunrise');
  const dusk = layout?.astro.find((a) => a.event === 'dusk');
  const dawn = layout?.astro.find((a) => a.event === 'dawn');

  const trackViewportHeight = landscape
    ? Math.min(layout?.rows.length ? layout.rows.length * ROW_HEIGHT : 0, ROW_HEIGHT * 3.5)
    : Math.min(layout?.rows.length ? layout.rows.length * ROW_HEIGHT : 0, Math.max(ROW_HEIGHT * 4.5, Math.min(ROW_HEIGHT * 6.5, windowHeight * 0.34)));

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
                        const startLabel = preview?.edge === 'on' ? preview.label : shortTime(clockLabel(ordinalAtX(left, viewport)));
                        const endLabel = preview?.edge === 'off'
                          ? preview.label
                          : bar.continuesPast
                            ? shortTime(bar.endLabel)
                            : shortTime(clockLabel(ordinalAtX(right, viewport)));
                        return (
                          <G key={barKey}>
                            <Rect x={bx} y={barY} width={bw} height={BAR_HEIGHT} fill={theme.bar} stroke={selected ? theme.text : 'none'} strokeWidth={selected ? 1.5 : 0} onPress={() => {
                              const next = selected ? null : barKey;
                              setSelectedBar(next);
                              setNativeSelected(next && bar.scheduleIds.length === 1 ? { barKey, scheduleId: bar.scheduleIds[0], left: bx, right: bx + bw, y: centerY, continuesPast: bar.continuesPast } : null);
                            }} />
                            {selected && <>
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
              {nativeSelected && (
                <NativeTrimOverlay
                  selected={nativeSelected}
                  viewport={viewport}
                  theme={theme}
                  onPreview={setDragPreview}
                  onCommit={onTrimSchedule}
                />
              )}
            </ScrollView>
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

function NativeTrimOverlay({
  selected, viewport, theme, onPreview, onCommit,
}: {
  selected: { barKey: string; scheduleId: string; left: number; right: number; y: number; continuesPast: boolean };
  viewport: Viewport;
  theme: ReturnType<typeof useTheme>;
  onPreview: (value: { barKey: string; edge: 'on' | 'off'; x: number; label: string } | null) => void;
  onCommit?: (scheduleId: string, edge: 'on' | 'off', minutesOfDay: number) => void;
}) {
  const makeResponder = (edge: 'on' | 'off', originX: number) => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { document?.getSelection?.()?.removeAllRanges?.(); },
    onPanResponderMove: (_e, g) => previewTrim(selected.barKey, selected.scheduleId, edge, originX + g.dx, viewport, onPreview, onCommit)(false),
    onPanResponderRelease: (_e, g) => previewTrim(selected.barKey, selected.scheduleId, edge, originX + g.dx, viewport, onPreview, onCommit)(true),
    onPanResponderTerminate: (_e, g) => previewTrim(selected.barKey, selected.scheduleId, edge, originX + g.dx, viewport, onPreview, onCommit)(true),
  });
  const left = useMemo(() => makeResponder('on', selected.left), [selected.barKey, selected.left, viewport.width]);
  const right = useMemo(() => makeResponder('off', selected.right), [selected.barKey, selected.right, viewport.width]);
  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View {...left.panHandlers} style={[styles.nativeHandleHit, { left: selected.left - 22, top: selected.y - 22 }]}>
        <View style={[styles.nativeHandle, { backgroundColor: theme.surface, borderColor: theme.bar }]}><View style={[styles.nativeGrip, { backgroundColor: theme.bar }]} /></View>
      </View>
      {!selected.continuesPast && <View {...right.panHandlers} style={[styles.nativeHandleHit, { left: selected.right - 22, top: selected.y - 22 }]}>
        <View style={[styles.nativeHandle, { backgroundColor: theme.surface, borderColor: theme.bar }]}><View style={[styles.nativeGrip, { backgroundColor: theme.bar }]} /></View>
      </View>}
    </View>
  );
}

function previewTrim(
  barKey: string,
  scheduleId: string,
  edge: 'on' | 'off',
  x: number,
  viewport: Viewport,
  setPreview: (value: { barKey: string; edge: 'on' | 'off'; x: number; label: string } | null) => void,
  commit?: (scheduleId: string, edge: 'on' | 'off', minutesOfDay: number) => void,
) {
  const rawOrdinal = ordinalAtX(x, viewport);
  const ordinal = Math.round(rawOrdinal);
  const minutesOfDay = ((ordinal + 720) % 1440 + 1440) % 1440;
  const h24 = Math.floor(minutesOfDay / 60);
  const h = h24 % 12 || 12;
  const label = `${h}:${String(minutesOfDay % 60).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
  const snappedX = viewport.padding + (ordinal / 1440) * (viewport.width - viewport.padding - (viewport.rightPadding ?? viewport.padding));
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
  nativeHandleHit: { position: 'absolute', width: 44, height: 44, alignItems: 'center', justifyContent: 'center', userSelect: 'none' as any },
  nativeHandle: { width: 12, height: 30, borderRadius: 4, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  nativeGrip: { width: 2, height: 12, borderRadius: 1 },
  legendText: { fontSize: 11, marginRight: 6 },
});
