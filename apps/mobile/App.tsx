import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { DateTime } from 'luxon';
import { solarDayContaining, type Configuration } from '@mrscheduler/domain';
import { Timeline } from './src/components/Timeline';
import { UpcomingEvents } from './src/components/UpcomingEvents';
import { ScheduleList } from './src/components/ScheduleList';
import { sampleConfig } from './src/state/sampleConfig';
import { useTheme } from './src/theme';

export default function App() {
  const [config, setConfig] = useState<Configuration>(sampleConfig);
  const now = useMemo(() => DateTime.now().setZone(sampleConfig.location.timezone), []);
  const anchorDate = solarDayContaining(now, config.location).anchorDate;

  const toggleSchedule = (scheduleId: string, enabled: boolean) =>
    setConfig((previous) => {
      const schedule = previous.schedules[scheduleId];
      if (!schedule) return previous;
      return {
        ...previous,
        schedules: { ...previous.schedules, [scheduleId]: { ...schedule, enabled } },
      };
    });

  return (
    <SafeAreaProvider>
      <Screen config={config} now={now} anchorDate={anchorDate} onToggle={toggleSchedule} />
    </SafeAreaProvider>
  );
}

function Screen({
  config,
  now,
  anchorDate,
  onToggle,
}: {
  config: Configuration;
  now: DateTime;
  anchorDate: string;
  onToggle: (scheduleId: string, enabled: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>Tonight</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
          {DateTime.fromISO(anchorDate).toFormat('cccc d LLLL')} · noon to noon
        </Text>

        <Timeline config={config} anchorDate={anchorDate} />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add device"
          style={({ pressed }) => [
            styles.addDevice,
            { borderColor: theme.border, backgroundColor: theme.surface, opacity: pressed ? 0.65 : 1 },
          ]}
        >
          <Text style={[styles.addDevicePlus, { color: theme.accent }]}>＋</Text>
          <Text style={[styles.addDeviceText, { color: theme.text }]}>Add device</Text>
        </Pressable>

        <Text style={[styles.section, { color: theme.text }]}>Upcoming</Text>
        <View style={styles.upcomingPreview}>
          <UpcomingEvents config={config} now={now} />
        </View>

        <Text style={[styles.section, { color: theme.text }]}>Schedules</Text>
        <ScheduleList config={config} onToggle={onToggle} />

        <View style={styles.footer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16 },
  title: { fontSize: 30, fontWeight: '700' },
  subtitle: { fontSize: 13, marginTop: 2, marginBottom: 16 },
  section: { fontSize: 18, fontWeight: '600', marginTop: 28, marginBottom: 4 },
  addDevice: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
  },
  addDevicePlus: { fontSize: 17, lineHeight: 18, fontWeight: '600' },
  addDeviceText: { fontSize: 13, fontWeight: '600' },
  upcomingPreview: { maxHeight: 260, overflow: 'hidden' },
  footer: { height: 48 },
});
