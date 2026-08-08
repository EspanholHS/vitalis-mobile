import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import {
  EmptyState,
  ErrorState,
  FocusPressable,
  LoadingState,
  MedicationMark,
  MetricCard,
  ProgressBar,
  ScreenContainer,
  ScreenHeader,
  SectionCard,
  SectionHeading,
  SegmentedControl,
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
import { type AnalyticsDay, type AnalyticsSummary, getAnalytics } from '@/lib/vitalis-data';

const periodOptions = [
  { label: '7 dias', value: 7 },
  { label: '30 dias', value: 30 },
] as const;

function dayState(day: AnalyticsDay) {
  if (!day.planned) return 'empty' as const;
  if (day.duePlanned > day.dueTaken) return 'attention' as const;
  if (day.taken === day.planned) return 'complete' as const;
  return 'inProgress' as const;
}

function chartDescription(chartDays: AnalyticsDay[]) {
  return chartDays
    .map((day) => {
      if (!day.planned) return `${day.label}: sem doses planejadas`;
      const future = day.upcoming ? `, ${day.upcoming} agendada${day.upcoming === 1 ? '' : 's'}` : '';
      const attention = day.duePlanned - day.dueTaken;
      const pending = attention ? `, ${attention} sem confirmação após o horário` : '';
      return `${day.label}: ${day.taken} de ${day.planned} confirmadas${future}${pending}`;
    })
    .join('. ');
}

export default function MonitoringScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const [days, setDays] = useState<7 | 30>(7);
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async (refresh = false) => {
    if (!user?.id) return;
    const currentRequest = ++requestId.current;
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const nextData = await getAnalytics(user.id, days);
      if (currentRequest === requestId.current) setData(nextData);
    } catch {
      if (currentRequest === requestId.current) setError('Não foi possível calcular seu progresso agora.');
    } finally {
      if (currentRequest === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [days, user?.id]);

  useFocusEffect(useCallback(() => {
    void load();
    return () => { requestId.current += 1; };
  }, [load]));

  if (loading && !data) {
    return <ScreenContainer><LoadingState label="Calculando seu progresso…" /></ScreenContainer>;
  }

  const hasData = Boolean(data?.planned);
  const chartDays = data?.days.slice(-7) ?? [];
  const attentionRatio = data?.duePlanned ? (data.attentionCount / data.duePlanned) * 100 : 0;
  const summaryTone = data?.attentionCount
    ? attentionRatio >= 30 ? 'danger' as const : 'warning' as const
    : 'success' as const;
  const summaryLabel = data?.attentionCount
    ? `${data.attentionCount} ${data.attentionCount === 1 ? 'dose precisa' : 'doses precisam'} de atenção`
    : data?.upcomingCount
      ? 'Rotina em dia'
      : 'Boa continuidade';
  const summaryIcon = data?.attentionCount ? 'priority-high' as const : 'check-circle' as const;
  const metricsWide = width >= 700;

  return (
    <ScreenContainer
      contentContainerStyle={styles.content}
      onRefresh={() => void load(true)}
      refreshing={refreshing}
      scroll
      size="wide">
      <ScreenHeader
        description="Planejado, confirmado e futuro — cada estado conta de um jeito."
        eyebrow="Acompanhamento"
        title="Seu progresso"
      />

      <SegmentedControl label="Período da análise" onChange={setDays} options={periodOptions} value={days} />

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}

      {!error && !hasData ? (
        <EmptyState
          description="Cadastre uma rotina e confirme as doses. Dias sem medicamento continuarão identificados como sem dados."
          icon="insights"
          title="Progresso em construção"
        />
      ) : data ? (
        <>
          <SectionCard style={styles.heroCard} tone="dark">
            <View style={styles.heroTop}>
              <View style={styles.heroMetric}>
                <Text style={styles.heroEyebrow}>PROGRESSO DO PLANO · {days} DIAS</Text>
                <View style={styles.heroValueRow}>
                  <Text style={styles.heroValue}>{data.adherence}%</Text>
                  <Text style={styles.heroFraction}>{data.taken} de {data.planned}</Text>
                </View>
              </View>
              <StatusPill icon={summaryIcon} label={summaryLabel} tone={summaryTone} />
            </View>
            <ProgressBar
              label={`${data.taken} de ${data.planned} doses planejadas confirmadas no período`}
              tone={data.attentionCount ? 'warning' : 'success'}
              value={data.adherence}
            />
            <View style={styles.heroExplanation}>
              <MaterialIcons color="#8FC3F5" name="schedule" size={18} />
              <Text style={styles.heroBody}>
                Dos horários que já chegaram, {data.dueTaken} de {data.duePlanned} foram confirmados
                {data.upcomingCount ? `; ${data.upcomingCount} ${data.upcomingCount === 1 ? 'dose segue agendada' : 'doses seguem agendadas'}.` : '.'}
              </Text>
            </View>
          </SectionCard>

          <View style={[styles.metricsGrid, metricsWide && styles.metricsGridWide]}>
            <MetricCard
              detail={`de ${data.planned} planejadas`}
              icon="done-all"
              label="Confirmadas"
              tone="success"
              value={data.taken}
            />
            <MetricCard
              detail="somente horários já ocorridos"
              icon={data.attentionCount ? 'notification-important' : 'verified'}
              label="Precisam de atenção"
              tone={data.attentionCount ? 'warning' : 'success'}
              value={data.attentionCount}
            />
            <MetricCard
              detail={data.bestHour ? 'melhor proporção real' : 'sem diferença relevante'}
              icon="schedule"
              label="Horário em destaque"
              tone="blue"
              value={data.bestHour ?? 'Consistente'}
            />
          </View>

          <SectionCard style={styles.chartCard}>
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderCopy}>
                <Text style={styles.cardEyebrow}>CONFIRMAÇÕES</Text>
                <Text style={styles.cardTitle}>Ritmo por dia</Text>
                <Text style={styles.cardDescription}>A barra compara confirmações com todas as doses planejadas no dia.</Text>
              </View>
              <Text style={styles.cardMeta}>7 dias recentes</Text>
            </View>

            <View
              accessibilityLabel={chartDescription(chartDays)}
              accessibilityRole="image"
              style={styles.chart}>
              {chartDays.map((day) => {
                const state = dayState(day);
                const hasPlanned = day.planned > 0;
                return (
                  <View key={day.key} style={styles.barGroup}>
                    <Text style={[styles.barValue, !hasPlanned && styles.barValueEmpty]}>
                      {hasPlanned ? `${day.percent}%` : '—'}
                    </Text>
                    <View style={[styles.barTrack, !hasPlanned && styles.barTrackEmpty]}>
                      {hasPlanned ? (
                        <View
                          style={[
                            styles.barFill,
                            state === 'attention' && styles.barFillAttention,
                            state === 'complete' && styles.barFillComplete,
                            { height: `${Math.max(4, day.percent)}%` },
                          ]}
                        />
                      ) : <View style={styles.noDataDash} />}
                    </View>
                    <Text style={styles.barCount}>{hasPlanned ? `${day.taken}/${day.planned}` : 'sem dados'}</Text>
                    <Text style={styles.barLabel}>{day.label.slice(0, 3)}</Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.chartLegend}>
              <View style={styles.legendItem}><View style={[styles.legendDot, styles.legendDone]} /><Text style={styles.legendText}>Completo</Text></View>
              <View style={styles.legendItem}><View style={[styles.legendDot, styles.legendProgress]} /><Text style={styles.legendText}>Em andamento</Text></View>
              <View style={styles.legendItem}><View style={[styles.legendDot, styles.legendAttention]} /><Text style={styles.legendText}>Atenção</Text></View>
              <View style={styles.legendItem}><View style={[styles.legendDot, styles.legendEmpty]} /><Text style={styles.legendText}>Sem dados</Text></View>
            </View>
          </SectionCard>

          {data.criticalHour ? (
            <SectionCard style={styles.insightCard} tone="warning">
              <View style={styles.insightIcon}><MaterialIcons color={VitalisColors.warningStrong} name="lightbulb-outline" size={22} /></View>
              <View style={styles.insightCopy}>
                <Text style={styles.insightEyebrow}>LEITURA DA ROTINA</Text>
                <Text style={styles.insightTitle}>Mais atenção por volta de {data.criticalHour}</Text>
                <Text style={styles.insightBody}>Entre os horários já ocorridos, esse foi o único com menor proporção de confirmações. A amostra descreve seus registros e não orienta mudanças de tratamento.</Text>
              </View>
            </SectionCard>
          ) : (
            <View style={styles.calmInsight}>
              <MaterialIcons color={VitalisColors.success} name="verified" size={21} />
              <View style={styles.insightCopy}>
                <Text style={styles.calmInsightTitle}>Nenhum horário crítico identificado</Text>
                <Text style={styles.calmInsightBody}>{data.attentionCount ? 'Ainda não há uma diferença única e consistente entre os horários.' : 'Todos os horários já ocorridos estão em dia neste recorte.'}</Text>
              </View>
            </View>
          )}

          <SectionHeading
            action={(
              <FocusPressable
                accessibilityRole="button"
                onPress={() => router.push('/analysis')}
                style={({ hovered, pressed }) => [
                  styles.reportButton,
                  hovered && styles.reportButtonHover,
                  pressed && styles.pressed,
                ]}>
                <MaterialIcons color={VitalisColors.primaryStrong} name="ios-share" size={18} />
                <Text style={styles.reportButtonText}>Abrir resumo</Text>
              </FocusPressable>
            )}
            meta={`${data.byMedication.length} acompanhados`}
            title="Por medicamento"
          />

          <View style={styles.medicationList}>
            {data.byMedication.map((item) => (
              <View key={item.medication.id} style={styles.medicationRow}>
                <MedicationMark colorToken={item.medication.color_token} size={42} />
                <View style={styles.medicationCopy}>
                  <View style={styles.medicationHeader}>
                    <Text style={styles.medicationName}>{item.medication.name}</Text>
                    <Text style={styles.medicationPercent}>{item.percent}%</Text>
                  </View>
                  <Text style={styles.medicationMeta}>{item.taken} de {item.planned} doses planejadas</Text>
                  <ProgressBar label={`${item.medication.name}: ${item.taken} de ${item.planned} doses confirmadas`} value={item.percent} />
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { gap: VitalisSpacing.lg, paddingTop: VitalisSpacing.xs },
  heroCard: { gap: VitalisSpacing.md, padding: VitalisSpacing.lg },
  heroTop: { alignItems: 'flex-start', flexDirection: 'row', flexWrap: 'wrap', gap: 14, justifyContent: 'space-between' },
  heroMetric: { gap: 5 },
  heroEyebrow: { color: VitalisColors.onDarkMuted, fontFamily: VitalisFonts.bodyBold, fontSize: 11, letterSpacing: 1.05 },
  heroValueRow: { alignItems: 'baseline', flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  heroValue: { color: VitalisColors.onDark, fontFamily: VitalisFonts.bodyBold, fontSize: 48, fontVariant: ['tabular-nums'], letterSpacing: -1.4, lineHeight: 54 },
  heroFraction: { color: '#A8CBED', fontFamily: VitalisFonts.bodySemiBold, fontSize: 14, fontVariant: ['tabular-nums'] },
  heroExplanation: { alignItems: 'flex-start', flexDirection: 'row', gap: 9 },
  heroBody: { color: VitalisColors.onDarkMuted, flex: 1, fontFamily: VitalisFonts.body, fontSize: 13, lineHeight: 20 },
  metricsGrid: { gap: 10 },
  metricsGridWide: { flexDirection: 'row' },
  chartCard: { gap: VitalisSpacing.lg },
  cardHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  cardHeaderCopy: { flex: 1, gap: 3 },
  cardEyebrow: { color: VitalisColors.primaryStrong, fontFamily: VitalisFonts.bodyBold, fontSize: 11, letterSpacing: 1 },
  cardTitle: { color: VitalisColors.ink, fontFamily: VitalisFonts.bodySemiBold, fontSize: 21, lineHeight: 27 },
  cardDescription: { color: VitalisColors.muted, fontFamily: VitalisFonts.body, fontSize: 12, lineHeight: 18, maxWidth: 500 },
  cardMeta: { color: VitalisColors.muted, fontFamily: VitalisFonts.bodyMedium, fontSize: 12, paddingTop: 2 },
  chart: { alignItems: 'flex-end', flexDirection: 'row', gap: 5, height: 190 },
  barGroup: { alignItems: 'center', flex: 1, gap: 5, maxWidth: 92, minWidth: 35 },
  barValue: { color: VitalisColors.ink, fontFamily: VitalisFonts.bodySemiBold, fontSize: 11, fontVariant: ['tabular-nums'] },
  barValueEmpty: { color: VitalisColors.mutedSoft },
  barTrack: { backgroundColor: VitalisColors.surfaceSoft, borderRadius: VitalisRadius.sm, height: 112, justifyContent: 'flex-end', overflow: 'hidden', width: '52%' },
  barTrackEmpty: { alignItems: 'center', backgroundColor: 'transparent', borderColor: VitalisColors.border, borderStyle: 'dashed', borderWidth: 1, justifyContent: 'center', overflow: 'visible' },
  barFill: { backgroundColor: VitalisColors.primary, borderRadius: VitalisRadius.sm, minHeight: 4, width: '100%' },
  barFillAttention: { backgroundColor: VitalisColors.warningStrong },
  barFillComplete: { backgroundColor: VitalisColors.success },
  noDataDash: { backgroundColor: VitalisColors.borderStrong, height: 1, width: '50%' },
  barCount: { color: VitalisColors.muted, fontFamily: VitalisFonts.bodyMedium, fontSize: 10, fontVariant: ['tabular-nums'], lineHeight: 14, textAlign: 'center' },
  barLabel: { color: VitalisColors.ink, fontFamily: VitalisFonts.bodySemiBold, fontSize: 11, textTransform: 'capitalize' },
  chartLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 13 },
  legendItem: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  legendDot: { borderRadius: VitalisRadius.pill, height: 8, width: 8 },
  legendDone: { backgroundColor: VitalisColors.success },
  legendProgress: { backgroundColor: VitalisColors.primary },
  legendAttention: { backgroundColor: VitalisColors.warningStrong },
  legendEmpty: { backgroundColor: VitalisColors.surface, borderColor: VitalisColors.borderStrong, borderWidth: 1 },
  legendText: { color: VitalisColors.muted, fontFamily: VitalisFonts.body, fontSize: 11 },
  insightCard: { alignItems: 'flex-start', flexDirection: 'row', gap: 12 },
  insightIcon: { alignItems: 'center', backgroundColor: VitalisColors.surface, borderRadius: VitalisRadius.md, height: 42, justifyContent: 'center', width: 42 },
  insightCopy: { flex: 1, gap: 3 },
  insightEyebrow: { color: VitalisColors.warningText, fontFamily: VitalisFonts.bodyBold, fontSize: 10, letterSpacing: 0.9 },
  insightTitle: { color: VitalisColors.ink, fontFamily: VitalisFonts.bodySemiBold, fontSize: 16 },
  insightBody: { color: VitalisColors.muted, fontFamily: VitalisFonts.body, fontSize: 13, lineHeight: 20 },
  calmInsight: { alignItems: 'flex-start', backgroundColor: VitalisColors.successSoft, borderRadius: VitalisRadius.md, flexDirection: 'row', gap: 11, padding: 14 },
  calmInsightTitle: { color: VitalisColors.ink, fontFamily: VitalisFonts.bodySemiBold, fontSize: 14 },
  calmInsightBody: { color: VitalisColors.muted, fontFamily: VitalisFonts.body, fontSize: 12, lineHeight: 18 },
  reportButton: { alignItems: 'center', backgroundColor: VitalisColors.primaryMist, borderColor: VitalisColors.primarySoft, borderRadius: VitalisRadius.md, borderWidth: 1, flexDirection: 'row', gap: 6, minHeight: 44, paddingHorizontal: 12 },
  reportButtonHover: { backgroundColor: VitalisColors.primarySoft },
  reportButtonText: { color: VitalisColors.primaryStrong, fontFamily: VitalisFonts.bodySemiBold, fontSize: 12 },
  medicationList: { backgroundColor: VitalisColors.surface, borderColor: VitalisColors.borderSubtle, borderRadius: VitalisRadius.lg, borderWidth: 1, overflow: 'hidden' },
  medicationRow: { alignItems: 'center', borderBottomColor: VitalisColors.borderSubtle, borderBottomWidth: 1, flexDirection: 'row', gap: 12, minHeight: 88, padding: 13 },
  medicationCopy: { flex: 1, gap: 5 },
  medicationHeader: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  medicationName: { color: VitalisColors.ink, flex: 1, fontFamily: VitalisFonts.bodySemiBold, fontSize: 14 },
  medicationMeta: { color: VitalisColors.muted, fontFamily: VitalisFonts.body, fontSize: 12 },
  medicationPercent: { color: VitalisColors.primaryStrong, fontFamily: VitalisFonts.bodyBold, fontSize: 14, fontVariant: ['tabular-nums'] },
  focusVisible: { borderColor: VitalisColors.primary, boxShadow: VitalisElevation.focus },
  pressed: { opacity: 0.78 },
});
