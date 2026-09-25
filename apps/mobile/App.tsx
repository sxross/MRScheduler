import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { DateTime } from 'luxon';
import { solarDayContaining, type Configuration } from '@mrscheduler/domain';
import { setScheduleEnabled, updateAbsoluteScheduleEndpoint, type ConfigurationMutation } from '@mrscheduler/application';
import { Timeline } from './src/components/Timeline';
import { UpcomingEvents } from './src/components/UpcomingEvents';
import { ScheduleList } from './src/components/ScheduleList';
import { sampleConfig } from './src/state/sampleConfig';
import { localConfigurationRepository } from './src/state/localConfigurationRepository';
import { useTheme } from './src/theme';

const BUILD_HASH = (process.env.EXPO_PUBLIC_BUILD_HASH ?? 'dev').slice(-7);
const DEPLOYED_AT = process.env.EXPO_PUBLIC_DEPLOYED_AT;
const BUILD_LABEL = DEPLOYED_AT
  ? `${BUILD_HASH} · ${DateTime.fromISO(DEPLOYED_AT).toLocal().toFormat('LLL d, h:mm a')}`
  : BUILD_HASH;

export default function App() {
  const [config, setConfig] = useState<Configuration>(sampleConfig);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const now = useMemo(() => DateTime.now().setZone(config.location.timezone), [config.location.timezone]);
  const anchorDate = solarDayContaining(now, config.location).anchorDate;

  useEffect(() => {
    let cancelled = false;
    void localConfigurationRepository.load()
      .then(async (persisted) => {
        if (cancelled) return;
        if (persisted) {
          setConfig(persisted);
          return;
        }
        await localConfigurationRepository.save(sampleConfig);
      })
      .catch((error) => console.error('Failed to load local configuration', error));
    return () => {
      cancelled = true;
    };
  }, []);

  const commit = useCallback((mutation: ConfigurationMutation) => {
    setConfig((previous) => {
      const next = mutation(previous);
      if (next === previous) return previous;
      saveQueue.current = saveQueue.current
        .then(() => localConfigurationRepository.save(next))
        .catch((error) => console.error('Failed to save local configuration', error));
      return next;
    });
  }, []);

  const trimSchedule = (scheduleId: string, edge: 'on' | 'off', minutesOfDay: number) =>
    commit((previous) => updateAbsoluteScheduleEndpoint(previous, scheduleId, edge, minutesOfDay));

  const toggleSchedule = (scheduleId: string, enabled: boolean) =>
    commit((previous) => setScheduleEnabled(previous, scheduleId, enabled));

  return (
    <SafeAreaProvider>
      <Screen config={config} now={now} anchorDate={anchorDate} onToggle={toggleSchedule} onTrim={trimSchedule} />
    </SafeAreaProvider>
  );
}

function Screen({
  config,
  now,
  anchorDate,
  onToggle,
  onTrim,
}: {
  config: Configuration;
  now: DateTime;
  anchorDate: string;
  onToggle: (scheduleId: string, enabled: boolean) => void;
  onTrim: (scheduleId: string, edge: 'on' | 'off', minutesOfDay: number) => void;
}) {
  const theme = useTheme();
  const webSafeArea = Platform.OS === 'web'
    ? ({
        paddingLeft: 'max(16px, env(safe-area-inset-left))',
        paddingRight: 'max(16px, env(safe-area-inset-right))',
      } as any)
    : undefined;
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'left', 'right']}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={[styles.content, webSafeArea]}>
        <Text style={[styles.title, { color: theme.text }]}>Tonight</Text>
        <View style={styles.subtitleRow}>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            {DateTime.fromISO(anchorDate).toFormat('cccc d LLLL')} · noon to noon
          </Text>
          <Text style={[styles.build, { color: theme.textMuted }]}>{BUILD_LABEL}</Text>
        </View>

        <Timeline config={config} anchorDate={anchorDate} onTrimSchedule={onTrim} />

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
  subtitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2, marginBottom: 16 },
  subtitle: { fontSize: 13 },
  build: { fontSize: 10, fontFamily: 'monospace', opacity: 0.7 },
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
