import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DateTime } from 'luxon';
import { buildEventQueue, type Configuration } from '@mrscheduler/domain';
import { useTheme } from '../theme';

export function UpcomingEvents({ config, now }: { config: Configuration; now: DateTime }) {
  const theme = useTheme();
  const { events } = useMemo(() => buildEventQueue(config, now, 2), [config, now]);
  const today = now.setZone(config.location.timezone).toFormat('yyyy-MM-dd');

  let lastHeading = '';

  return (
    <View style={styles.list}>
      {events.length === 0 && (
        <Text style={[styles.empty, { color: theme.textMuted }]}>
          Nothing scheduled in the next two days.
        </Text>
      )}
      {events.map((event, i) => {
        const local = event.at.setZone(config.location.timezone);
        const heading = local.toFormat('yyyy-MM-dd') === today ? 'TODAY' : 'TOMORROW';
        const showHeading = heading !== lastHeading;
        lastHeading = heading;
        const device = config.devices[event.deviceId];

        return (
          <View key={`${event.deviceId}-${event.at.toMillis()}-${event.desiredState}-${i}`}>
            {showHeading && (
              <Text style={[styles.heading, { color: theme.textMuted }]}>{heading}</Text>
            )}
            <View style={[styles.row, { borderBottomColor: theme.border }]}>
              <Text style={[styles.time, { color: theme.text }]}>{local.toFormat('h:mm a')}</Text>
              <View style={styles.middle}>
                <Text style={[styles.device, { color: theme.text }]}>
                  {device?.name ?? event.deviceId}
                </Text>
                <Text style={[styles.reason, { color: theme.textMuted }]}>
                  {event.reason}
                  {event.adjustedFrom
                    ? `  ·  moved from ${event.adjustedFrom
                        .setZone(config.location.timezone)
                        .toFormat('h:mm a')}`
                    : ''}
                </Text>
              </View>
              <Text
                style={[
                  styles.state,
                  { color: event.desiredState === 'on' ? theme.bar : theme.textMuted },
                ]}
              >
                {event.desiredState.toUpperCase()}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 0 },
  empty: { fontSize: 13, paddingVertical: 12 },
  heading: { fontSize: 11, fontWeight: '600', letterSpacing: 1, marginTop: 16, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  time: { fontSize: 14, fontVariant: ['tabular-nums'], width: 82 },
  middle: { flex: 1 },
  device: { fontSize: 15, fontWeight: '500' },
  reason: { fontSize: 12, marginTop: 2 },
  state: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
});
