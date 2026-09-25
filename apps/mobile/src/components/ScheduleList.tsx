import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import {
  ASTRO_EVENTS,
  describeEndpoint,
  describeSchedule,
  resolveEndpoint,
  solarDay,
  type AstroEventName,
  type Configuration,
  type Endpoint,
  type Schedule,
} from '@mrscheduler/domain';
import { useTheme } from '../theme';

const EVENT_LABEL: Record<AstroEventName, string> = {
  sunrise: 'Sunrise',
  sunset: 'Sunset',
  dawn: 'Dawn',
  dusk: 'Dusk',
  nauticalDawn: 'Nautical dawn',
  nauticalDusk: 'Nautical dusk',
};

export function ScheduleList({
  config,
  anchorDate,
  onToggle,
  onEndpointChange,
  onSelect,
}: {
  config: Configuration;
  anchorDate: string;
  onToggle: (scheduleId: string, enabled: boolean) => void;
  onEndpointChange: (scheduleId: string, edge: 'on' | 'off', endpoint: Endpoint) => void;
  onSelect?: (scheduleId: string) => void;
}) {
  const theme = useTheme();
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
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
          {schedules.map((schedule) => {
            const selected = selectedScheduleId === schedule.id;
            return (
              <View key={schedule.id}>
                <Pressable
                  onPress={() => {
                    setSelectedScheduleId(selected ? null : schedule.id);
                    onSelect?.(schedule.id);
                  }}
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
                {selected && (
                  <View style={[styles.editor, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <EndpointEditor
                      label="On"
                      endpoint={schedule.on}
                      edge="on"
                      config={config}
                      anchorDate={anchorDate}
                      onChange={(endpoint) => onEndpointChange(schedule.id, 'on', endpoint)}
                    />
                    <EndpointEditor
                      label="Off"
                      endpoint={schedule.off}
                      edge="off"
                      config={config}
                      anchorDate={anchorDate}
                      onChange={(endpoint) => onEndpointChange(schedule.id, 'off', endpoint)}
                    />
                  </View>
                )}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function EndpointEditor({
  label,
  endpoint,
  edge,
  config,
  anchorDate,
  onChange,
}: {
  label: string;
  endpoint: Endpoint;
  edge: 'on' | 'off';
  config: Configuration;
  anchorDate: string;
  onChange: (endpoint: Endpoint) => void;
}) {
  const theme = useTheme();
  const day = solarDay(anchorDate, config.location);
  const resolved = resolveEndpoint(endpoint, day, config.location);
  const resolvedLabel = resolved.ok ? resolved.at.toFormat('h:mm a') : 'Unavailable';

  const chooseKind = (kind: Endpoint['kind']) => {
    if (kind === endpoint.kind) return;
    if (kind === 'astro') {
      onChange({
        kind: 'astro',
        event: edge === 'on' ? 'sunset' : 'sunrise',
        offsetMinutes: 0,
      });
      return;
    }
    if (!resolved.ok) return;
    onChange({
      kind: 'absolute',
      minutesOfDay: resolved.at.hour * 60 + resolved.at.minute,
    });
  };

  return (
    <View style={styles.endpoint}>
      <View style={styles.endpointHeader}>
        <Text style={[styles.endpointLabel, { color: theme.text }]}>{label}</Text>
        <Text style={[styles.resolved, { color: theme.textMuted }]}>Resolves to {resolvedLabel}</Text>
      </View>
      <Text style={[styles.authored, { color: theme.textMuted }]}>Authored {describeEndpoint(endpoint)}</Text>

      <View style={styles.controls}>
        <Choice label="Clock" selected={endpoint.kind === 'absolute'} onPress={() => chooseKind('absolute')} />
        <Choice label="Astro" selected={endpoint.kind === 'astro'} onPress={() => chooseKind('astro')} />
      </View>

      {endpoint.kind === 'astro' && (
        <>
          <View style={styles.eventChoices}>
            {ASTRO_EVENTS.map((event) => (
              <Choice
                key={event}
                label={EVENT_LABEL[event]}
                selected={endpoint.event === event}
                onPress={() => onChange({ ...endpoint, event })}
              />
            ))}
          </View>
          <View style={styles.controls}>
            <Step label="−5" onPress={() => onChange({ ...endpoint, offsetMinutes: endpoint.offsetMinutes - 5 })} />
            <Step label="−1" onPress={() => onChange({ ...endpoint, offsetMinutes: endpoint.offsetMinutes - 1 })} />
            <Text style={[styles.offset, { color: theme.text }]}>{formatOffset(endpoint.offsetMinutes)}</Text>
            <Step label="+1" onPress={() => onChange({ ...endpoint, offsetMinutes: endpoint.offsetMinutes + 1 })} />
            <Step label="+5" onPress={() => onChange({ ...endpoint, offsetMinutes: endpoint.offsetMinutes + 5 })} />
          </View>
        </>
      )}
    </View>
  );
}

function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.choice,
        {
          borderColor: selected ? theme.accent : theme.border,
          backgroundColor: selected ? theme.background : theme.surface,
        },
      ]}
    >
      <Text style={{ color: selected ? theme.accent : theme.text, fontSize: 12, fontWeight: selected ? '700' : '500' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function Step({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.step, { borderColor: theme.border }]}>
      <Text style={{ color: theme.text, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

function formatOffset(minutes: number): string {
  if (minutes === 0) return '±0 min';
  return `${minutes > 0 ? '+' : '−'}${Math.abs(minutes)} min`;
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
  editor: {
    marginTop: -2,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 16,
  },
  endpoint: { gap: 8 },
  endpointHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  endpointLabel: { fontSize: 14, fontWeight: '700' },
  authored: { fontSize: 12 },
  resolved: { fontSize: 11 },
  controls: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  eventChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  choice: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth },
  step: { minWidth: 38, alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth },
  offset: { minWidth: 62, textAlign: 'center', fontSize: 12, fontVariant: ['tabular-nums'] },
});
