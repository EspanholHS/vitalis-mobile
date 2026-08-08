import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import {
  EmptyState,
  ErrorState,
  FocusPressable,
  IconButton,
  InlineNotice,
  LoadingState,
  MedicationMark,
  MotionReveal,
  PrimaryButton,
  ProgressBar,
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
import {
  doseCanBeRecorded,
  type DashboardData,
  type DailyDose,
  getDashboard,
  longDateLabel,
  recordDose,
  timeLabel,
} from '@/lib/vitalis-data';

function getDoseStatus(dose: DailyDose) {
  if (dose.status === 'taken') return { label: 'Confirmada', tone: 'success' as const, icon: 'check-circle' as const };
  if (dose.status === 'skipped') return { label: 'Não tomada', tone: 'danger' as const, icon: 'cancel' as const };
  if (dose.status === 'late' || dose.status === 'missed') return { label: 'Atrasada', tone: 'warning' as const, icon: 'schedule' as const };
  if (dose.status === 'snoozed') return { label: 'Adiada', tone: 'blue' as const, icon: 'snooze' as const };
  if (!doseCanBeRecorded(dose)) return { label: 'Agendada', tone: 'neutral' as const, icon: 'event' as const };
  return { label: 'Disponível', tone: 'blue' as const, icon: 'radio-button-checked' as const };
}

function availabilityCopy(dose: DailyDose, now: Date) {
  const minutes = Math.max(0, Math.ceil((dose.scheduledFor.getTime() - now.getTime()) / 60000));
  if (minutes <= 0) return 'A confirmação já está disponível.';
  if (minutes < 60) return `Você poderá confirmar em ${minutes} min.`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return `Você poderá confirmar em ${hours}h${remaining ? ` ${remaining}min` : ''}.`;
}

function friendlyName(preferredName?: string | null, fullName?: string | null) {
  const candidate = preferredName?.trim() || fullName?.trim().split(/\s+/)[0] || '';
  if (!candidate || candidate.toLowerCase() === 'admin') return null;
  return candidate;
}

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { profile, user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [expandedDoseKey, setExpandedDoseKey] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const load = useCallback(async (isRefresh = false) => {
    if (!user?.id) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      setData(await getDashboard(user.id));
      setNow(new Date());
    } catch {
      setError('Sua rotina não pôde ser sincronizada. Confira a conexão.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function handleDose(dose: DailyDose, status: 'taken' | 'skipped') {
    if (!doseCanBeRecorded(dose, now)) {
      setError(`Esta dose poderá ser registrada a partir das ${timeLabel(dose.scheduledFor)}.`);
      return;
    }
    setActionKey(dose.key);
    setFeedback(null);
    try {
      await recordDose(user?.id, dose, status);
      await Haptics.notificationAsync(status === 'taken'
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning);
      setFeedback(status === 'taken'
        ? `${dose.medication.name} confirmada às ${timeLabel(new Date())}.`
        : `${dose.medication.name} registrada como não tomada.`);
      setExpandedDoseKey(null);
      await load(true);
    } catch {
      setError('Não foi possível registrar a dose. Tente novamente.');
    } finally {
      setActionKey(null);
    }
  }

  const name = friendlyName(profile?.preferred_name, profile?.full_name);
  const upcomingCount = data?.doses.filter((dose) => dose.status === 'pending' && !doseCanBeRecorded(dose, now)).length ?? 0;
  const routineStatus = data?.lateCount
    ? `${data.lateCount} ${data.lateCount === 1 ? 'dose precisa' : 'doses precisam'} de atenção`
    : upcomingCount
      ? `Rotina em dia · ${upcomingCount} ${upcomingCount === 1 ? 'dose ainda agendada' : 'doses ainda agendadas'}`
      : 'Rotina em dia';
  const isWide = width >= 760;
  const activeMedications = data?.medications.filter((medication) => medication.is_active).length ?? 0;

  if (loading && !data) {
    return <ScreenContainer><LoadingState label="Montando sua agenda de hoje…" /></ScreenContainer>;
  }

  return (
    <ScreenContainer
      contentContainerStyle={styles.content}
      onRefresh={() => void load(true)}
      refreshing={refreshing}
      scroll
      size="wide">
      <ScreenHeader
        action={<IconButton icon="person-outline" label="Abrir perfil" onPress={() => router.push('/(tabs)/profile')} />}
        description={longDateLabel()}
        eyebrow="Sua rotina"
        title={name ? `Olá, ${name}.` : 'Sua rotina, com clareza.'}
      />

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {feedback ? <InlineNotice description={feedback} title="Rotina atualizada" tone="success" /> : null}

      {!error && !data?.medications.some((medication) => medication.is_active) ? (
        <EmptyState
          action={<PrimaryButton icon="add" label="Cadastrar primeiro medicamento" onPress={() => router.push('/medication')} />}
          description="Cadastre nome, dosagem e primeira dose. A Vitalis organiza os horários da sua rotina."
          title="Sua rotina começa aqui"
        />
      ) : data ? (
        <>
          <View style={[styles.overviewGrid, isWide && styles.overviewGridWide]}>
            {data.nextDose ? (
              <MotionReveal distance={8} style={styles.nextCard}>
                <View style={styles.nextHeader}>
                  <View style={styles.nextLabelRow}>
                    <View style={styles.nextPulse} />
                    <Text style={styles.nextEyebrow}>{data.nextDose.status === 'late' ? 'DOSE EM ATENÇÃO' : 'PRÓXIMA DOSE'}</Text>
                  </View>
                  <StatusPill
                    icon={data.nextDose.status === 'late' ? 'schedule' : doseCanBeRecorded(data.nextDose, now) ? 'notifications-active' : 'event'}
                    label={data.nextDose.status === 'late' ? 'Atrasada' : doseCanBeRecorded(data.nextDose, now) ? 'Disponível' : 'Agendada'}
                    tone={data.nextDose.status === 'late' ? 'warning' : doseCanBeRecorded(data.nextDose, now) ? 'blue' : 'dark'}
                  />
                </View>

                <View style={styles.nextCore}>
                  <Text style={styles.nextTime}>{timeLabel(data.nextDose.scheduledFor)}</Text>
                  <View style={styles.nextMedication}>
                    <MedicationMark colorToken={data.nextDose.medication.color_token} size={48} />
                    <View style={styles.nextCopy}>
                      <Text style={styles.nextName}>{data.nextDose.medication.name}</Text>
                      <Text style={styles.nextDosage}>{data.nextDose.medication.dosage}</Text>
                    </View>
                  </View>
                </View>

                {data.nextDose.medication.instructions ? (
                  <View style={styles.nextInstruction}>
                    <MaterialIcons color={VitalisColors.onDarkMuted} name="info-outline" size={18} />
                    <Text style={styles.nextInstructionText}>{data.nextDose.medication.instructions}</Text>
                  </View>
                ) : null}

                {!doseCanBeRecorded(data.nextDose, now) ? (
                  <View style={styles.availabilityRow}>
                    <MaterialIcons color="#8FC3F5" name="lock-clock" size={18} />
                    <Text style={styles.availabilityText}>{availabilityCopy(data.nextDose, now)}</Text>
                  </View>
                ) : null}

                <View style={[styles.nextActions, width >= 430 && styles.nextActionsWide]}>
                  <PrimaryButton
                    accessibilityHint={!doseCanBeRecorded(data.nextDose, now) ? availabilityCopy(data.nextDose, now) : 'Registra a dose como tomada agora'}
                    disabled={!doseCanBeRecorded(data.nextDose, now)}
                    icon="check"
                    label="Confirmar tomada"
                    loading={actionKey === data.nextDose.key}
                    onPress={() => void handleDose(data.nextDose!, 'taken')}
                    style={styles.nextPrimary}
                  />
                  <PrimaryButton
                    disabled={!doseCanBeRecorded(data.nextDose, now) || actionKey === data.nextDose.key}
                    label="Não tomei"
                    onPress={() => void handleDose(data.nextDose!, 'skipped')}
                    style={styles.nextSecondary}
                    tone="dark"
                  />
                </View>
              </MotionReveal>
            ) : (
              <MotionReveal distance={8} style={[styles.nextCard, styles.completeCard]}>
                <View style={styles.completeIcon}><MaterialIcons color={VitalisColors.success} name="done-all" size={29} /></View>
                <Text style={styles.completeTitle}>Rotina de hoje concluída</Text>
                <Text style={styles.completeBody}>Todas as doses planejadas foram registradas. Seu histórico já está atualizado.</Text>
              </MotionReveal>
            )}

            <MotionReveal distance={8} style={styles.continuityPanel}>
              <View style={styles.continuityHeader}>
                <View style={styles.continuityCopy}>
                  <Text style={styles.sectionEyebrow}>PROGRESSO DO PLANO</Text>
                  <Text style={styles.continuityTitle}>{routineStatus}</Text>
                </View>
                <Text style={styles.progressPercent}>{data.adherence}%</Text>
              </View>
              <ProgressBar label={`${data.takenCount} de ${data.plannedCount} doses confirmadas hoje`} value={data.adherence} />
              <Text style={styles.continuityMeta}>{data.takenCount} de {data.plannedCount} confirmadas hoje</Text>
              <View style={styles.compactMetrics}>
                <View style={styles.compactMetric}>
                  <Text style={styles.metricValue}>{activeMedications}</Text>
                  <Text style={styles.metricLabel}>{activeMedications === 1 ? 'ativo' : 'ativos'}</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.compactMetric}>
                  <Text style={styles.metricValue}>{upcomingCount}</Text>
                  <Text style={styles.metricLabel}>ainda agendadas</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.compactMetric}>
                  <Text style={[styles.metricValue, data.lateCount > 0 && styles.metricAttention]}>{data.lateCount}</Text>
                  <Text style={styles.metricLabel}>em atenção</Text>
                </View>
              </View>
            </MotionReveal>
          </View>

          <SectionHeading
            action={(
              <FocusPressable
                accessibilityLabel="Adicionar medicamento"
                accessibilityRole="button"
                onPress={() => router.push('/medication')}
                style={({ hovered, pressed }) => [
                  styles.addButton,
                  hovered && styles.addButtonHover,
                  pressed && styles.pressed,
                ]}>
                <MaterialIcons color={VitalisColors.primaryStrong} name="add" size={19} />
                <Text style={styles.addButtonText}>Adicionar</Text>
              </FocusPressable>
            )}
            eyebrow="Linha do dia"
            meta="Toque em uma dose para ver detalhes"
            title="Sua agenda"
          />

          <MotionReveal distance={7} style={styles.timelineCard}>
            {data.doses.map((dose, index) => {
              const status = getDoseStatus(dose);
              const isExpanded = expandedDoseKey === dose.key;
              const isNext = data.nextDose?.key === dose.key;
              const canRecord = dose.status !== 'taken' && dose.status !== 'skipped' && doseCanBeRecorded(dose, now);
              return (
                <MotionReveal distance={4} key={dose.key}>
                  <FocusPressable
                    accessibilityHint="Abre os detalhes desta dose"
                    accessibilityLabel={`${timeLabel(dose.scheduledFor)}, ${dose.medication.name}, ${dose.medication.dosage}, ${status.label}`}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isExpanded }}
                    onPress={() => setExpandedDoseKey(isExpanded ? null : dose.key)}
                    style={({ hovered, pressed }) => [
                      styles.doseRow,
                      isNext && styles.doseRowNext,
                      hovered && styles.doseRowHover,
                      pressed && styles.pressed,
                    ]}>
                    <Text style={styles.doseTime}>{timeLabel(dose.scheduledFor)}</Text>
                    <View style={styles.timelineColumn}>
                      {index > 0 ? <View style={styles.timelineLineTop} /> : null}
                      <View style={[
                        styles.timelineNode,
                        dose.status === 'taken' && styles.timelineNodeDone,
                        (dose.status === 'late' || dose.status === 'missed') && styles.timelineNodeLate,
                        isNext && styles.timelineNodeNext,
                      ]}>
                        {dose.status === 'taken' ? <MaterialIcons color={VitalisColors.surface} name="check" size={11} /> : null}
                      </View>
                      {index < data.doses.length - 1 ? <View style={styles.timelineLineBottom} /> : null}
                    </View>
                    <MedicationMark colorToken={dose.medication.color_token} size={40} />
                    <View style={styles.doseCopy}>
                      <Text style={styles.doseName}>{dose.medication.name}</Text>
                      <Text style={styles.doseDosage}>{dose.medication.dosage}</Text>
                    </View>
                    <StatusPill compact={width < 430} icon={status.icon} label={status.label} tone={status.tone} />
                    <MaterialIcons color={VitalisColors.muted} name={isExpanded ? 'expand-less' : 'expand-more'} size={20} />
                  </FocusPressable>
                  {isExpanded ? (
                    <View style={styles.doseDetails}>
                      <Text style={styles.doseDetailText}>{dose.medication.instructions || 'Sem orientação adicional cadastrada.'}</Text>
                      {canRecord ? (
                        <View style={styles.detailActions}>
                          <PrimaryButton
                            icon="check"
                            label="Confirmar agora"
                            loading={actionKey === dose.key}
                            onPress={() => void handleDose(dose, 'taken')}
                            style={styles.detailButton}
                          />
                          <PrimaryButton
                            disabled={actionKey === dose.key}
                            label="Não tomei"
                            onPress={() => void handleDose(dose, 'skipped')}
                            style={styles.detailButton}
                            tone="ghost"
                          />
                        </View>
                      ) : !doseCanBeRecorded(dose, now) ? (
                        <Text style={styles.doseAvailability}>{availabilityCopy(dose, now)}</Text>
                      ) : null}
                    </View>
                  ) : null}
                </MotionReveal>
              );
            })}
          </MotionReveal>

          <MotionReveal distance={7}>
          <FocusPressable
            accessibilityHint="Abre o assistente da Vitalis"
            accessibilityRole="button"
            onPress={() => router.push('/assistant' as never)}
            focusTone="dark"
            style={({ hovered, pressed }) => [
              styles.hubEntry,
              hovered && styles.hubEntryHover,
              pressed && styles.pressed,
            ]}>
            <View style={styles.hubIcon}><MaterialIcons color="#8FC3F5" name="auto-awesome" size={22} /></View>
            <View style={styles.hubCopy}>
              <Text style={styles.hubEyebrow}>IA HUB · DADOS DA SUA ROTINA</Text>
              <Text style={styles.hubTitle}>Pergunte com linguagem natural</Text>
              <Text style={styles.hubBody}>Próxima dose, resumo de hoje ou progresso semanal.</Text>
            </View>
            <MaterialIcons color={VitalisColors.onDark} name="arrow-forward" size={21} />
          </FocusPressable>
          </MotionReveal>
        </>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { gap: VitalisSpacing.lg, paddingTop: VitalisSpacing.xs },
  overviewGrid: { gap: VitalisSpacing.md },
  overviewGridWide: { alignItems: 'stretch', flexDirection: 'row' },
  nextCard: { backgroundColor: VitalisColors.surfaceDark, borderColor: VitalisColors.borderDark, borderRadius: VitalisRadius.xl, borderWidth: 1, boxShadow: VitalisElevation.floating, flex: 1.35, gap: VitalisSpacing.md, minHeight: 280, padding: VitalisSpacing.ml },
  nextHeader: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  nextLabelRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  nextPulse: { backgroundColor: '#8FC3F5', borderRadius: VitalisRadius.pill, height: 7, width: 7 },
  nextEyebrow: { color: VitalisColors.onDarkMuted, fontFamily: VitalisFonts.bodyBold, fontSize: 11, letterSpacing: 1.15 },
  nextCore: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: VitalisSpacing.ml, justifyContent: 'space-between' },
  nextTime: { color: VitalisColors.onDark, fontFamily: VitalisFonts.bodyBold, fontSize: 44, fontVariant: ['tabular-nums'], letterSpacing: -1.1, lineHeight: 48 },
  nextMedication: { alignItems: 'center', flexDirection: 'row', gap: 11, minWidth: 170 },
  nextCopy: { flex: 1, gap: 2 },
  nextName: { color: VitalisColors.onDark, fontFamily: VitalisFonts.bodySemiBold, fontSize: 18, lineHeight: 23 },
  nextDosage: { color: '#A8CBED', fontFamily: VitalisFonts.bodyMedium, fontSize: 14 },
  nextInstruction: { alignItems: 'flex-start', backgroundColor: VitalisColors.surfaceDarkElevated, borderRadius: VitalisRadius.md, flexDirection: 'row', gap: 9, padding: 11 },
  nextInstructionText: { color: VitalisColors.onDarkMuted, flex: 1, fontFamily: VitalisFonts.body, fontSize: 13, lineHeight: 19 },
  availabilityRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  availabilityText: { color: '#B9D7F3', flex: 1, fontFamily: VitalisFonts.bodyMedium, fontSize: 13, lineHeight: 19 },
  nextActions: { gap: VitalisSpacing.xs, marginTop: 'auto' },
  nextActionsWide: { flexDirection: 'row' },
  nextPrimary: { flex: 1 },
  nextSecondary: { flex: 0.65 },
  completeCard: { alignItems: 'flex-start', justifyContent: 'center' },
  completeIcon: { alignItems: 'center', backgroundColor: VitalisColors.successSoft, borderRadius: VitalisRadius.pill, height: 52, justifyContent: 'center', width: 52 },
  completeTitle: { color: VitalisColors.onDark, fontFamily: VitalisFonts.bodySemiBold, fontSize: 20 },
  completeBody: { color: VitalisColors.onDarkMuted, fontFamily: VitalisFonts.body, fontSize: 14, lineHeight: 21, maxWidth: 430 },
  continuityPanel: { backgroundColor: VitalisColors.surfaceRaised, borderColor: VitalisColors.borderSubtle, borderRadius: VitalisRadius.lg, borderWidth: 1, flex: 0.9, gap: VitalisSpacing.md, justifyContent: 'space-between', minHeight: 220, padding: VitalisSpacing.ml },
  continuityHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  continuityCopy: { flex: 1, gap: 5 },
  sectionEyebrow: { color: VitalisColors.primaryStrong, fontFamily: VitalisFonts.bodyBold, fontSize: 11, letterSpacing: 1.05 },
  continuityTitle: { color: VitalisColors.ink, fontFamily: VitalisFonts.bodySemiBold, fontSize: 16, lineHeight: 22 },
  progressPercent: { color: VitalisColors.primaryStrong, fontFamily: VitalisFonts.bodyBold, fontSize: 31, fontVariant: ['tabular-nums'], letterSpacing: -0.7, lineHeight: 35 },
  continuityMeta: { color: VitalisColors.muted, fontFamily: VitalisFonts.body, fontSize: 13, lineHeight: 19 },
  compactMetrics: { alignItems: 'center', borderTopColor: VitalisColors.borderSubtle, borderTopWidth: 1, flexDirection: 'row', paddingTop: VitalisSpacing.md },
  compactMetric: { flex: 1, gap: 2 },
  metricValue: { color: VitalisColors.ink, fontFamily: VitalisFonts.bodyBold, fontSize: 18, fontVariant: ['tabular-nums'] },
  metricAttention: { color: VitalisColors.warningStrong },
  metricLabel: { color: VitalisColors.muted, fontFamily: VitalisFonts.body, fontSize: 11, lineHeight: 16 },
  metricDivider: { backgroundColor: VitalisColors.border, height: 34, marginHorizontal: 9, width: 1 },
  addButton: { alignItems: 'center', backgroundColor: VitalisColors.primaryMist, borderColor: VitalisColors.primarySoft, borderRadius: VitalisRadius.md, borderWidth: 1, flexDirection: 'row', gap: 5, minHeight: 44, paddingHorizontal: 12 },
  addButtonHover: { backgroundColor: VitalisColors.primarySoft },
  addButtonText: { color: VitalisColors.primaryStrong, fontFamily: VitalisFonts.bodyBold, fontSize: 12 },
  timelineCard: { backgroundColor: VitalisColors.surface, borderColor: VitalisColors.borderSubtle, borderRadius: VitalisRadius.lg, borderWidth: 1, overflow: 'hidden' },
  doseRow: { alignItems: 'center', borderColor: 'transparent', borderWidth: 1, flexDirection: 'row', gap: 9, minHeight: 78, paddingHorizontal: 13, paddingVertical: 10 },
  doseRowNext: { backgroundColor: VitalisColors.primaryMist },
  doseRowHover: { backgroundColor: VitalisColors.surfaceSoft },
  doseTime: { color: VitalisColors.ink, fontFamily: VitalisFonts.bodyBold, fontSize: 14, fontVariant: ['tabular-nums'], width: 43 },
  timelineColumn: { alignItems: 'center', alignSelf: 'stretch', justifyContent: 'center', width: 20 },
  timelineLineTop: { backgroundColor: VitalisColors.borderStrong, height: '50%', position: 'absolute', top: -11, width: 1 },
  timelineLineBottom: { backgroundColor: VitalisColors.borderStrong, bottom: -11, height: '50%', position: 'absolute', width: 1 },
  timelineNode: { alignItems: 'center', backgroundColor: VitalisColors.surface, borderColor: VitalisColors.borderStrong, borderRadius: VitalisRadius.pill, borderWidth: 2, height: 16, justifyContent: 'center', width: 16, zIndex: 2 },
  timelineNodeDone: { backgroundColor: VitalisColors.success, borderColor: VitalisColors.success },
  timelineNodeLate: { backgroundColor: VitalisColors.warning, borderColor: VitalisColors.warningStrong },
  timelineNodeNext: { borderColor: VitalisColors.primary, borderWidth: 4 },
  doseCopy: { flex: 1, gap: 2, minWidth: 74 },
  doseName: { color: VitalisColors.ink, fontFamily: VitalisFonts.bodySemiBold, fontSize: 14 },
  doseDosage: { color: VitalisColors.muted, fontFamily: VitalisFonts.body, fontSize: 12 },
  doseDetails: { backgroundColor: VitalisColors.surfaceSoft, borderTopColor: VitalisColors.borderSubtle, borderTopWidth: 1, gap: 12, paddingBottom: 14, paddingHorizontal: 85, paddingTop: 12 },
  doseDetailText: { color: VitalisColors.bodyStrong, fontFamily: VitalisFonts.body, fontSize: 13, lineHeight: 20 },
  doseAvailability: { color: VitalisColors.primaryStrong, fontFamily: VitalisFonts.bodyMedium, fontSize: 13 },
  detailActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  detailButton: { flex: 1, minHeight: 46, minWidth: 145 },
  hubEntry: { alignItems: 'center', backgroundColor: VitalisColors.surfaceDark, borderColor: VitalisColors.borderDark, borderRadius: VitalisRadius.lg, borderWidth: 1, flexDirection: 'row', gap: 12, minHeight: 96, padding: VitalisSpacing.md },
  hubEntryHover: { backgroundColor: VitalisColors.surfaceDarkElevated },
  hubIcon: { alignItems: 'center', backgroundColor: VitalisColors.surfaceDarkElevated, borderRadius: VitalisRadius.md, height: 46, justifyContent: 'center', width: 46 },
  hubCopy: { flex: 1, gap: 2 },
  hubEyebrow: { color: '#8FC3F5', fontFamily: VitalisFonts.bodyBold, fontSize: 10, letterSpacing: 1 },
  hubTitle: { color: VitalisColors.onDark, fontFamily: VitalisFonts.bodySemiBold, fontSize: 16 },
  hubBody: { color: VitalisColors.onDarkMuted, fontFamily: VitalisFonts.body, fontSize: 12, lineHeight: 18 },
  focusVisible: { borderColor: VitalisColors.primary, boxShadow: VitalisElevation.focus },
  focusVisibleDark: { borderColor: '#8FC3F5', boxShadow: '0 0 0 4px rgba(143,195,245,0.18)' },
  pressed: { opacity: 0.78 },
});
