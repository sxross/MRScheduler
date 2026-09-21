/**
 * The timeline. A thin painter over @mrscheduler/timeline -- every x position,
 * width and label here comes from the geometry package, which is where the
 * arithmetic is tested.
 */
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G, Line, Rect, Text as SvgText } from 'react-native-svg';
import type { Configuration } from '@mrscheduler/domain';
import { DEFAULT_VIEWPORT, buildTimeline, type Viewport } from '@mrscheduler/timeline';
import { useTheme } from '../theme';

const BAR_HEIGHT = 18;
const NAME_OFFSET = 14;

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

  const viewport: Viewport = { ...DEFAULT_VIEWPORT, width };
  const layout = useMemo(
    () => (width > 0 ? buildTimeline(config, anchorDate, viewport) : null),
    [config, anchorDate, width],
  );

  const dusk = layout?.astro.find((a) => a.event === 'dusk');
  const dawn = layout?.astro.find((a) => a.event === 'dawn');

  return (
    <View
      style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {layout && (
        <Svg width={layout.width} height={layout.height}>
          {/* Night, so the dark hours read at a glance. */}
          {dusk && dawn && (
            <Rect x={dusk.x} y={0} width={dawn.x - dusk.x} height={layout.height} fill={theme.night} />
          )}

          {/* Permitted windows for each transition. */}
          {layout.fences.map((fence) => (
            <Rect
              key={fence.transition}
              x={fence.x}
              y={fence.transition === 'on' ? 46 : 52}
              width={fence.width}
              height={4}
              rx={2}
              fill={fence.transition === 'on' ? theme.accent : theme.ghost}
              opacity={0.55}
            />
          ))}

          {layout.ticks.map((tick, i) => (
            <G key={`tick-${i}`}>
              <Line
                x1={tick.x}
                y1={20}
                x2={tick.x}
                y2={layout.height}
                stroke={theme.gridline}
                strokeWidth={tick.major ? 1 : StyleSheet.hairlineWidth}
              />
              <SvgText
                x={tick.x}
                y={14}
                fontSize={9}
                fill={theme.textMuted}
                textAnchor={i === 0 ? 'start' : i === layout.ticks.length - 1 ? 'end' : 'middle'}
              >
                {tick.label}
              </SvgText>
            </G>
          ))}

          {layout.astro.map((mark) => (
            <G key={mark.event}>
              <Line
                x1={mark.x}
                y1={26}
                x2={mark.x}
                y2={layout.height}
                stroke={theme.accent}
                strokeWidth={StyleSheet.hairlineWidth}
                strokeDasharray="3 3"
              />
              <SvgText x={mark.x} y={38} fontSize={9} fill={theme.accent} textAnchor="middle">
                {mark.label}
              </SvgText>
            </G>
          ))}

          {layout.rows.map((row) => {
            const barY = row.y + NAME_OFFSET + 6;
            return (
              <G key={row.deviceId} onPress={() => onSelectDevice?.(row.deviceId)}>
                <SvgText x={viewport.padding} y={row.y + NAME_OFFSET} fontSize={11} fill={theme.text}>
                  {row.name}
                </SvgText>

                {row.bars.map((bar, i) => (
                  <G key={`bar-${i}`}>
                    <Rect
                      x={bar.x}
                      y={barY}
                      width={Math.max(bar.width, 2)}
                      height={BAR_HEIGHT}
                      rx={BAR_HEIGHT / 2}
                      fill={theme.bar}
                    />
                    {bar.continuesPast && (
                      <Rect
                        x={bar.x + bar.width - 6}
                        y={barY}
                        width={6}
                        height={BAR_HEIGHT}
                        fill={theme.barMuted}
                      />
                    )}
                  </G>
                ))}

                {/* A clamp: hollow dot where the rule asked, line to where it lands. */}
                {row.clamps.map((clamp, i) => (
                  <G key={`clamp-${i}`}>
                    <Line
                      x1={clamp.requestedX}
                      y1={barY + BAR_HEIGHT / 2}
                      x2={clamp.effectiveX}
                      y2={barY + BAR_HEIGHT / 2}
                      stroke={theme.ghost}
                      strokeWidth={1}
                      strokeDasharray="2 2"
                    />
                    <Circle
                      cx={clamp.requestedX}
                      cy={barY + BAR_HEIGHT / 2}
                      r={3}
                      stroke={theme.ghost}
                      strokeWidth={1}
                      fill="none"
                    />
                  </G>
                ))}

                {row.blocked.length > 0 && (
                  <SvgText
                    x={viewport.padding}
                    y={barY + BAR_HEIGHT - 2}
                    fontSize={10}
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
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    paddingVertical: 8,
  },
});
