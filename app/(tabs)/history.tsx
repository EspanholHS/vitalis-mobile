import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import {
  EmptyState,
  ErrorState,
  MedicationMark,
  PrimaryButton,
  ScreenContainer,
  ScreenHeader,
  SectionHeading,
  StatusPill,
} from '@/components/vitalis-ui';
import {
  VitalisColors,
  VitalisElevation,
  VitalisFonts,
  VitalisRadius,
  VitalisSpacing,
} from '@/constants/vitalis-theme';
import { useAuth } from '@/contexts/auth-context';
import { type HistoryItem, getHistory, timeLabel } from '@/lib/vitalis-data';

const periods = [7, 30] as const;

type HistoryStatusFilter = 'all' | 'taken' | 'skipped' | 'snoozed' | 'missed';

const statusFilters: readonly { label: string; value: HistoryStatusFilter }[] = [
  { label: 'Todos', value: 'all' },
  { label: 'Confirmadas', value: 'taken' },
  { label: 'Não tomadas', value: 'skipped' },
  { label: 'Adiada', value: 'snoozed' },
  { label: 'Sem confirmação', value: 'missed' },
];

function eventStatus(status: string) {
  if (status === 'taken') return { label: 'Confirmada', tone: 'success' as const, icon: 'check-circle' as const };
  if (status === 'skipped') return { label: 'Não tomada', tone: 'danger' as const, icon: 'cancel' as const };
  if (status === 'snoozed') return { label: 'Adiada', tone: 'blue' as const, icon: 'snooze' as const };
  return { label: 'Sem confirmação', tone: 'warning' as const, icon: 'schedule' as const };
}

function localDateKey(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const datePart = new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
  }).format(date);

  if (localDateKey(value) === localDateKey(today.toISOString())) return `Hoje, ${datePart}`;
  if (localDateKey(value) === localDateKey(yesterday.toISOString())) return `Ontem, ${datePart}`;

  const formatted = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function durationLabel(totalMinutes: number) {
  const minutes = Math.abs(totalMinutes);
  if (minutes < 1) return 'no horário planejado';
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h${remainder ? ` ${remainder}min` : ''}`;
}

function eventTimingLabel(event: HistoryItem) {
  if (event.status === 'taken' && event.taken_at) {
    const difference = Math.round(
      (new Date(event.taken_at).getTime() - new Date(event.scheduled_for).getTime()) / 60_000,
    );
    const relation = difference === 0
      ? durationLabel(0)
      : `${durationLabel(difference)} ${difference > 0 ? 'após o' : 'antes do'} horário`;
    return `Confirmada às ${timeLabel(event.taken_at)} · ${relation}`;
  }

  if (event.status === 'taken') return 'Confirmação registrada sem horário adicional';
  if (event.status === 'skipped') return 'Registrada como não tomada';
  if (event.status === 'snoozed' && event.snoozed_until) return `Adiada para ${timeLabel(event.snoozed_until)}`;
  if (event.status === 'snoozed') return 'Dose adiada';
  return 'Nenhuma confirmação foi registrada';
}

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      style={({ hovered, pressed }) => [
        styles.filterChip,
        selected && styles.filterChipSelected,
        hovered && !selected && styles.filterChipHovered,
        focused && styles.focusVisible,
        pressed && styles.pressed,
      ]}>
      {selected ? <MaterialIcons color={VitalisColors.primaryStrong} name="check" size={15} /> : null}
      <Text style={[styles.filterChipText, selected && styles.filterChipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function HistorySkeleton() {
  return (
    <ScreenContainer scroll contentContainerStyle={styles.content}>
      <View accessibilityLabel="Carregando seu histórico" accessibilityLiveRegion="polite" style={styles.skeleton}>
        <View style={[styles.skeletonBlock, styles.skeletonEyebrow]} />
        <View style={[styles.skeletonBlock, styles.skeletonTitle]} />
        <View style={[styles.skeletonBlock, styles.skeletonDescription]} />
        <View style={[styles.skeletonBlock, styles.skeletonFilters]} />
        {[0, 1, 2].map((item) => (
          <View key={item} style={styles.skeletonGroup}>
            <View style={[styles.skeletonBlock, styles.skeletonDay]} />
            <View style={[styles.skeletonBlock, styles.skeletonEvent]} />
          </View>
        ))}
      </View>
    </ScreenContainer>
  );
}

export default function HistoryScreen() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const [days, setDays] = useState<(typeof periods)[number]>(30);
  const [statusFilter, setStatusFilter] = useState<HistoryStatusFilter>('all');
  const [medicationFilter, setMedicationFilter] = useState('all');
  const [focusedPeriod, setFocusedPeriod] = useState<number | null>(null);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (!user?.id) return;
    if (refresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      setItems(await getHistory(user.id, days));
    } catch {
      setError('Seu histórico não pôde ser carregado. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [days, user?.id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const medicationOptions = useMemo(() => {
    const unique = new Map<string, string>();
    for (const item of items) {
      if (item.medication) unique.set(item.medication.id, item.medication.name);
    }
    return [...unique.entries()]
      .map(([value, label]) => ({ label, value }))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }, [items]);

  const availableStatusFilters = useMemo(
    () => statusFilters.filter((option) => option.value === 'all' || items.some((item) => item.status === option.value)),
    [items],
  );

  const filteredItems = useMemo(
    () => items.filter((item) => {
      const hasStatus = statusFilter === 'all' || item.status === statusFilter;
      const hasMedication = medicationFilter === 'all' || item.medication_id === medicationFilter;
      return hasStatus && hasMedication;
    }),
    [items, medicationFilter, statusFilter],
  );

  const groups = useMemo(() => {
    const map = new Map<string, HistoryItem[]>();
    for (const item of filteredItems) {
      const key = localDateKey(item.scheduled_for);
      const group = map.get(key);
      if (group) group.push(item);
      else map.set(key, [item]);
    }
    return [...map.entries()];
  }, [filteredItems]);

  const hasActiveFilters = statusFilter !== 'all' || medicationFilter !== 'all';

  function resetFilters() {
    setStatusFilter('all');
    setMedicationFilter('all');
  }

  function changePeriod(period: (typeof periods)[number]) {
    setDays(period);
    resetFilters();
  }

  if (loading && !items.length) return <HistorySkeleton />;

  return (
    <ScreenContainer
      onRefresh={() => void load(true)}
      refreshing={refreshing}
      scroll
      contentContainerStyle={styles.content}>
      <ScreenHeader
        description="Consulte cada registro da sua rotina com horário planejado, confirmação e status."
        eyebrow="Linha do tempo"
        title="Histórico"
      />

      <View style={styles.filterPanel}>
        <View style={styles.filterBlock}>
          <Text style={styles.filterLabel}>Período</Text>
          <View accessibilityLabel="Período do histórico" accessibilityRole="radiogroup" style={styles.periodRow}>
            {periods.map((period) => {
              const selected = period === days;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  key={period}
                  onBlur={() => setFocusedPeriod(null)}
                  onFocus={() => setFocusedPeriod(period)}
                  onPress={() => changePeriod(period)}
                  style={({ hovered, pressed }) => [
                    styles.periodChip,
                    selected && styles.periodChipSelected,
                    hovered && !selected && styles.periodChipHovered,
                    focusedPeriod === period && styles.focusVisible,
                    pressed && styles.pressed,
                  ]}>
                  {selected ? <View style={styles.periodIndicator} /> : null}
                  <Text style={[styles.periodText, selected && styles.periodTextSelected]}>{period} dias</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {items.length ? (
          <>
            <View style={styles.filterBlock}>
              <Text style={styles.filterLabel}>Status</Text>
              <View accessibilityLabel="Filtrar por status" accessibilityRole="radiogroup" style={styles.filterRow}>
                {availableStatusFilters.map((option) => (
                  <FilterChip
                    key={option.value}
                    label={option.label}
                    onPress={() => setStatusFilter(option.value)}
                    selected={statusFilter === option.value}
                  />
                ))}
              </View>
            </View>

            {medicationOptions.length > 1 ? (
              <View style={styles.filterBlock}>
                <Text style={styles.filterLabel}>Medicamento</Text>
                <View accessibilityLabel="Filtrar por medicamento" accessibilityRole="radiogroup" style={styles.filterRow}>
                  <FilterChip label="Todos" onPress={() => setMedicationFilter('all')} selected={medicationFilter === 'all'} />
                  {medicationOptions.map((option) => (
                    <FilterChip
                      key={option.value}
                      label={option.label}
                      onPress={() => setMedicationFilter(option.value)}
                      selected={medicationFilter === option.value}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </>
        ) : null}
      </View>

      {error && !items.length ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <>
          {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

          {!items.length ? (
            <EmptyState
              description="Quando você confirmar, adiar ou registrar uma dose como não tomada, ela aparecerá aqui."
              icon="history"
              title={`Nenhum registro nos últimos ${days} dias`}
            />
          ) : !filteredItems.length ? (
            <EmptyState
              action={<PrimaryButton label="Limpar filtros" onPress={resetFilters} tone="secondary" />}
              description="Tente outro status ou medicamento para visualizar os registros disponíveis."
              icon="filter-alt-off"
              title="Nenhum registro com esses filtros"
            />
          ) : (
            <View style={styles.results}>
              <SectionHeading
                meta={`${filteredItems.length} ${filteredItems.length === 1 ? 'registro encontrado' : 'registros encontrados'}`}
                title={hasActiveFilters ? 'Resultados filtrados' : 'Registros recentes'}
              />

              {groups.map(([dateKey, events]) => {
                const taken = events.filter((event) => event.status === 'taken').length;
                return (
                  <View key={dateKey} style={styles.dayGroup}>
                    <View style={styles.dayHeader}>
                      <Text accessibilityRole="header" style={styles.dayTitle}>{dateLabel(events[0].scheduled_for)}</Text>
                      <Text style={styles.dayMeta}>{taken} de {events.length} confirmada{taken === 1 ? '' : 's'}</Text>
                    </View>

                    <View style={styles.eventList}>
                      {events.map((event) => {
                        const status = eventStatus(event.status);
                        const timing = eventTimingLabel(event);
                        const medicationName = event.medication?.name ?? 'Medicamento removido';
                        const dosage = event.medication?.dosage ?? 'Registro preservado';
                        const accessibilityLabel = [
                          `Dose planejada às ${timeLabel(event.scheduled_for)}`,
                          medicationName,
                          dosage,
                          status.label,
                          timing,
                        ].join('. ');

                        return (
                          <View
                            accessible
                            accessibilityLabel={accessibilityLabel}
                            key={event.id}
                            style={[styles.eventRow, width < 390 && styles.eventRowCompact]}>
                            <View style={styles.timeBlock}>
                              <Text style={styles.timeLabel}>Prevista</Text>
                              <Text style={styles.eventTime}>{timeLabel(event.scheduled_for)}</Text>
                            </View>

                            <MedicationMark colorToken={event.medication?.color_token} size={width < 390 ? 38 : 42} />

                            <View style={styles.eventCopy}>
                              <Text numberOfLines={2} style={styles.eventName}>{medicationName}</Text>
                              <Text style={styles.eventDosage}>{dosage}</Text>
                              <View style={styles.statusRow}>
                                <StatusPill icon={status.icon} label={status.label} tone={status.tone} />
                              </View>
                              <View style={styles.timingRow}>
                                <MaterialIcons
                                  color={event.status === 'taken' ? VitalisColors.success : VitalisColors.muted}
                                  name={event.status === 'taken' ? 'schedule' : 'info-outline'}
                                  size={15}
                                />
                                <Text style={styles.timingText}>{timing}</Text>
                              </View>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </>
      )}

      <View style={styles.privacyNote}>
        <MaterialIcons color={VitalisColors.muted} name="lock-outline" size={18} />
        <Text style={styles.privacyText}>Somente sua conta pode consultar estes registros.</Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { gap: VitalisSpacing.lg, paddingTop: VitalisSpacing.xs },
  filterPanel: {
    backgroundColor: VitalisColors.surface,
    borderColor: VitalisColors.border,
    borderRadius: VitalisRadius.xl,
    borderWidth: 1,
    boxShadow: VitalisElevation.subtle,
    gap: VitalisSpacing.md,
    padding: VitalisSpacing.md,
  },
  filterBlock: { gap: VitalisSpacing.xs },
  filterLabel: {
    color: VitalisColors.muted,
    fontFamily: VitalisFonts.bodySemiBold,
    fontSize: 12,
    letterSpacing: 0.55,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  periodRow: {
    backgroundColor: VitalisColors.surfaceSoft,
    borderRadius: VitalisRadius.md,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
  },
  periodChip: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: VitalisRadius.sm,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    position: 'relative',
  },
  periodChipSelected: {
    backgroundColor: VitalisColors.surface,
    borderColor: VitalisColors.border,
    boxShadow: VitalisElevation.control,
  },
  periodChipHovered: { backgroundColor: VitalisColors.primaryMist },
  periodIndicator: {
    backgroundColor: VitalisColors.primary,
    borderRadius: VitalisRadius.pill,
    bottom: 5,
    height: 3,
    position: 'absolute',
    width: 18,
  },
  periodText: { color: VitalisColors.muted, fontFamily: VitalisFonts.bodySemiBold, fontSize: 14 },
  periodTextSelected: { color: VitalisColors.primaryStrong },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: VitalisSpacing.xs },
  filterChip: {
    alignItems: 'center',
    backgroundColor: VitalisColors.surfaceSoft,
    borderColor: 'transparent',
    borderRadius: VitalisRadius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 13,
  },
  filterChipSelected: { backgroundColor: VitalisColors.primaryMist, borderColor: '#B7D4FA' },
  filterChipHovered: { backgroundColor: VitalisColors.canvasDeep },
  filterChipText: { color: VitalisColors.muted, fontFamily: VitalisFonts.bodyMedium, fontSize: 13 },
  filterChipTextSelected: { color: VitalisColors.primaryStrong, fontFamily: VitalisFonts.bodySemiBold },
  results: { gap: VitalisSpacing.ml },
  dayGroup: { gap: VitalisSpacing.sm },
  dayHeader: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: VitalisSpacing.sm,
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  dayTitle: {
    color: VitalisColors.ink,
    flex: 1,
    fontFamily: VitalisFonts.bodySemiBold,
    fontSize: 17,
    lineHeight: 23,
  },
  dayMeta: { color: VitalisColors.muted, fontFamily: VitalisFonts.bodyMedium, fontSize: 12, lineHeight: 18 },
  eventList: { gap: VitalisSpacing.xs },
  eventRow: {
    alignItems: 'flex-start',
    backgroundColor: VitalisColors.surfaceRaised,
    borderColor: VitalisColors.border,
    borderRadius: VitalisRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: VitalisSpacing.sm,
    minHeight: 112,
    padding: VitalisSpacing.md,
  },
  eventRowCompact: { gap: VitalisSpacing.xs, paddingHorizontal: VitalisSpacing.sm },
  timeBlock: { gap: 2, paddingTop: 2, width: 52 },
  timeLabel: { color: VitalisColors.mutedSoft, fontFamily: VitalisFonts.bodyMedium, fontSize: 10, lineHeight: 14 },
  eventTime: {
    color: VitalisColors.ink,
    fontFamily: VitalisFonts.bodyBold,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    lineHeight: 20,
  },
  eventCopy: { flex: 1, gap: 3, minWidth: 0 },
  eventName: { color: VitalisColors.ink, fontFamily: VitalisFonts.bodySemiBold, fontSize: 15, lineHeight: 20 },
  eventDosage: { color: VitalisColors.muted, fontFamily: VitalisFonts.body, fontSize: 13, lineHeight: 18 },
  statusRow: { alignItems: 'flex-start', marginTop: 4 },
  timingRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 5, marginTop: 3 },
  timingText: { color: VitalisColors.muted, flex: 1, fontFamily: VitalisFonts.body, fontSize: 12, lineHeight: 18 },
  privacyNote: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: VitalisSpacing.xs,
    paddingHorizontal: VitalisSpacing.sm,
  },
  privacyText: { color: VitalisColors.muted, fontFamily: VitalisFonts.body, fontSize: 12, lineHeight: 18 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  focusVisible: { borderColor: VitalisColors.primary, boxShadow: VitalisElevation.focus },
  skeleton: { gap: VitalisSpacing.md },
  skeletonBlock: { backgroundColor: VitalisColors.surfaceCard, borderRadius: VitalisRadius.sm },
  skeletonEyebrow: { height: 12, width: 86 },
  skeletonTitle: { height: 40, width: '42%' },
  skeletonDescription: { height: 20, width: '78%' },
  skeletonFilters: { borderRadius: VitalisRadius.xl, height: 126, marginTop: VitalisSpacing.xs, width: '100%' },
  skeletonGroup: { gap: VitalisSpacing.xs, marginTop: VitalisSpacing.xs },
  skeletonDay: { height: 18, width: '38%' },
  skeletonEvent: { borderRadius: VitalisRadius.lg, height: 112, width: '100%' },
});
