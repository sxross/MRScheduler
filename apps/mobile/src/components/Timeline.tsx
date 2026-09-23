/**
 * Compact noon-to-noon schedule overview.
 *
 * Keep the chart self-explanatory on a phone: the axis and schedule bars are
 * primary; astronomical boundaries are secondary. Constraint details belong
 * in diagnostics/editing, not as unexplained decorative bars.
 */
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';
import type { Configuration } from '@mrscheduler/domain';
import { DEFAULT_VIEWPORT, buildTimeline, type Viewport } from '@mrscheduler/timeline';
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
}: {
  config: Configuration;
  anchorDate: string;
  onSelectDevice?: (deviceId: string) => void;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [selectedBar, setSelectedBar] = useState<string | null>(null);

  const viewport: Viewport = {
    ...DEFAULT_VIEWPORT,
    width,
    padding: LABEL_GUTTER,
    headerHeight: HEADER_HEIGHT,
    rowHeight: ROW_HEIGHT,
  };
  const layout = useMemo(
    () => (width > 0 ? buildTimeline(config, anchorDate, viewport, { tickMinutes: 360 }) : null),
    [config, anchorDate, width],
  );

  const sunset = layout?.astro.find((a) => a.event === 'sunset');
  const sunrise = layout?.astro.find((a) => a.event === 'sunrise');
  const dusk = layout?.astro.find((a) => a.event === 'dusk');
  const dawn = layout?.astro.find((a) => a.event === 'dawn');

  return (
    <View>
      <View
        style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      >
        {layout && (
          <Svg width={layout.width} height={layout.height}>
            {dusk && dawn && (
              <Rect x={dusk.x} y={HEADER_HEIGHT} width={dawn.x - dusk.x} height={layout.height - HEADER_HEIGHT} fill={theme.night} />
            )}

            {layout.ticks.map((tick, i) => (
              <G key={`tick-${i}`}>
                <Line
                  x1={tick.x}
                  y1={HEADER_HEIGHT - 8}
                  x2={tick.x}
                  y2={layout.height}
                  stroke={theme.gridline}
                  strokeWidth={tick.major ? 1 : StyleSheet.hairlineWidth}
                />
                <SvgText
                  x={tick.x}
                  y={16}
                  fontFamily="system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
                  fontSize={10}
                  fill={theme.textMuted}
                  textAnchor={i === 0 ? 'start' : i === layout.ticks.length - 1 ? 'end' : 'middle'}
                >
                  {shortTime(tick.label)}
                </SvgText>
              </G>
            ))}

            {sunset && (
              <AstroBoundary x={sunset.x} label="Sunset" time={sunset.time} theme={theme} anchor="end" />
            )}
            {sunrise && (
              <AstroBoundary x={sunrise.x} label="Sunrise" time={sunrise.time} theme={theme} anchor="start" />
            )}

            {layout.rows.map((row) => {
              const centerY = row.y + row.height / 2;
              const barY = centerY - BAR_HEIGHT / 2;
              return (
                <G key={row.deviceId} onPress={() => onSelectDevice?.(row.deviceId)}>
                  <SvgText
                    x={14}
                    y={centerY + 4}
                    fontFamily="system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
                    fontSize={12}
                    fontWeight="600"
                    fill={theme.text}
                  >
                    {row.name}
                  </SvgText>

                  {row.bars.map((bar, i) => {
                    const barKey = `${row.deviceId}:${bar.scheduleIds.join(',')}:${i}`;
                    const selected = selectedBar === barKey;
                    return (
                      <G key={barKey} onPress={() => setSelectedBar(selected ? null : barKey)}>
                        <Rect
                          x={bar.x}
                          y={barY}
                          width={Math.max(bar.width, 2)}
                          height={BAR_HEIGHT}
                          rx={3}
                          fill={theme.bar}
                          stroke={selected ? theme.text : 'none'}
                          strokeWidth={selected ? 1.5 : 0}
                        />
                        {selected && (
                          <>
                            <TrimHandle x={bar.x} y={centerY} theme={theme} />
                            <TrimHandle x={bar.x + bar.width} y={centerY} theme={theme} />
                            <SvgText
                              x={bar.x + 4}
                              y={barY - 6}
                              fontFamily="system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
                              fontSize={10}
                              fontWeight="600"
                              fill={theme.text}
                            >
                              {shortTime(bar.startLabel)} → {shortTime(bar.endLabel)}
                            </SvgText>
                          </>
                        )}
                        {bar.continuesPast && (
                          <Rect
                            x={bar.x + bar.width - 4}
                            y={barY}
                            width={4}
                            height={BAR_HEIGHT}
                            fill={theme.barMuted}
                          />
                        )}
                      </G>
                    );
                  })}

                  {row.clamps.map((clamp, i) => {
                    const markerY = centerY + BAR_HEIGHT / 2 + 8;
                    return (
                      <G key={`clamp-${i}`}>
                        <Line
                          x1={clamp.requestedX}
                          y1={markerY}
                          x2={clamp.effectiveX}
                          y2={centerY + BAR_HEIGHT / 2}
                          stroke={theme.ghost}
                          strokeWidth={1}
                          strokeDasharray="2 2"
                        />
                        <Circle
                          cx={clamp.requestedX}
                          cy={markerY}
                          r={2.5}
                          fill={theme.ghost}
                        />
                      </G>
                    );
                  })}

                  {row.blocked.length > 0 && (
                    <SvgText
                      x={LABEL_GUTTER}
                      y={centerY + 4}
                      fontFamily="system-ui, -apple-system, BlinkMacSystemFont, sans-serif"
                      fontSize={11}
                      fill={theme.warning}
                    >
                      Cannot run today
                    </SvgText>
                  )}
                </G>
              );
            })}
          </Svg>
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


function TrimHandle({
  x,
  y,
  theme,
}: {
  x: number;
  y: number;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <G>
      <Rect x={x - 4} y={y - BAR_HEIGHT / 2 - 3} width={8} height={BAR_HEIGHT + 6} rx={2} fill={theme.surface} stroke={theme.bar} strokeWidth={2} />
      <Line x1={x} y1={y - 4} x2={x} y2={y + 4} stroke={theme.bar} strokeWidth={1.5} />
    </G>
  );
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
