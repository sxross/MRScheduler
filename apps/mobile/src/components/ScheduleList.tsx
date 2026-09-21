import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { describeSchedule, type Configuration, type Schedule } from '@mrscheduler/domain';
import { useTheme } from '../theme';

export function ScheduleList({
  config,
  onToggle,
  onSelect,
}: {
  config: Configuration;
  onToggle: (scheduleId: string, enabled: boolean) => void;
  onSelect?: (scheduleId: string) => void;
}) {
  const theme = useTheme();
  const byDevice = new Map<string, Schedule[]>();
  for (const schedule of Object.values(config.schedules)) {
    const list = byDevice.get(schedule.deviceId);
    if (list) list.push(schedule);
    else byDevice.set(schedule.deviceId, [schedule]);
  }

  return (
    <View>
      {[...byDevice].map(([deviceId, schedules]) => (
        <View key={deviceId} style={styles.group}>
          <Text style={[styles.device, { color: theme.textMuted }]}>
            {config.devices[deviceId]?.name ?? deviceId}
          </Text>
          {schedules.map((schedule) => (
            <Pressable
              key={schedule.id}
              onPress={() => onSelect?.(schedule.id)}
              style={[styles.row, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <View style={styles.text}>
                <Text style={[styles.summary, { color: theme.text }]}>
                  {describeSchedule(schedule)}
                </Text>
                {(schedule.kind ?? 'governed') === 'adhoc' && (
                  <Text style={[styles.tag, { color: theme.accent }]}>AD-HOC</Text>
                )}
              </View>
              <Switch
                value={schedule.enabled}
                onValueChange={(next) => onToggle(schedule.id, next)}
              />
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginTop: 16 },
  device: { fontSize: 11, fontWeight: '600', letterSpacing: 1, marginBottom: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  text: { flex: 1 },
  summary: { fontSize: 14, lineHeight: 19 },
  tag: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginTop: 4 },
});
