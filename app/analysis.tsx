import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import { Redirect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';

import { EmptyState, ErrorState, IconButton, LoadingState, PrimaryButton, ScreenContainer, ScreenHeader, SectionCard, StatusPill } from '@/components/vitalis-ui';
import { VitalisColors, VitalisFonts, VitalisRadius } from '@/constants/vitalis-theme';
import { useAuth } from '@/contexts/auth-context';
import { useSafeBack } from '@/hooks/use-safe-back';
import { type AnalyticsSummary, getAnalytics } from '@/lib/vitalis-data';

export default function AnalysisScreen() {
  const goBack = useSafeBack('/(tabs)/monitoring');
  const { loading: authLoading, user } = useAuth();
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try { setData(await getAnalytics(user.id, 7)); }
    catch { setError('Não foi possível preparar a análise.'); }
    finally { setLoading(false); }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function shareSummary() {
    if (!data) return;
    await Share.share({
      title: 'Resumo Vitalis',
      message: `Resumo Vitalis · últimos 7 dias\nProgresso planejado: ${data.adherence}% (${data.taken}/${data.planned})\nAté este momento: ${data.dueAdherence}% (${data.dueTaken}/${data.duePlanned})${data.upcomingCount ? `\nDoses que ainda não chegaram ao horário: ${data.upcomingCount}` : ''}\n\nEste resumo apoia a organização e não substitui avaliação médica.`,
    });
  }

  if (authLoading || (loading && !data)) return <ScreenContainer><LoadingState label="Preparando análise…" /></ScreenContainer>;
  if (!user) return <Redirect href="/login" />;

  return (
    <ScreenContainer scroll contentContainerStyle={styles.content}>
      <ScreenHeader action={<IconButton icon="arrow-back" label="Voltar" onPress={goBack} />} description="Resumo compartilhável dos últimos 7 dias." eyebrow="Relatório" title="Análise da rotina" />
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {!error && data?.planned ? (
        <>
          <SectionCard style={styles.levelCard} tone="dark">
            <View style={styles.levelTop}>
              <View>
                <Text style={styles.levelLabelDark}>Progresso planejado</Text>
                <Text accessibilityLabel={`${data.adherence}% das doses planejadas confirmadas`} style={styles.levelValueDark}>{data.adherence}%</Text>
              </View>
              <StatusPill icon="date-range" label="7 dias" tone="dark" />
            </View>
            <Text style={styles.levelBodyDark}>{data.taken} de {data.planned} doses planejadas foram confirmadas no período.</Text>
            {data.upcomingCount ? (
              <View style={styles.upcomingRow}>
                <MaterialIcons color={VitalisColors.primarySoft} name="lock-clock" size={18} />
                <Text style={styles.upcomingText}>{data.upcomingCount === 1 ? '1 dose de hoje ainda não chegou ao horário.' : `${data.upcomingCount} doses de hoje ainda não chegaram ao horário.`}</Text>
              </View>
            ) : null}
          </SectionCard>

          <SectionCard style={styles.momentCard} tone={data.duePlanned ? (data.dueAdherence >= 80 ? 'success' : 'warning') : 'soft'}>
            <View style={styles.momentIcon}>
              <MaterialIcons color={!data.duePlanned ? VitalisColors.primary : data.dueAdherence >= 80 ? VitalisColors.success : VitalisColors.warningStrong} name="schedule" size={24} />
            </View>
            <View style={styles.momentCopy}>
              <Text style={styles.itemTitle}>Até este momento</Text>
              <Text style={styles.itemBody}>
                {data.duePlanned
                  ? `${data.dueTaken} de ${data.duePlanned} horários que já chegaram foram confirmados (${data.dueAdherence}%).`
                  : 'Nenhum horário planejado chegou ainda.'}
              </Text>
            </View>
          </SectionCard>

          <SectionCard style={styles.insightCard}>
            <MaterialIcons color={VitalisColors.primary} name="insights" size={24} />
            <View style={styles.insightCopy}>
              <Text style={styles.itemTitle}>Leitura do período</Text>
              <Text style={styles.itemBody}>{data.criticalHour ? `Entre os horários já ocorridos, ${data.criticalHour} concentrou a menor proporção de confirmações. A amostra serve apenas para organização da rotina.` : 'Não há um horário crítico isolado neste período. Continue registrando as doses para formar uma amostra mais representativa.'}</Text>
            </View>
          </SectionCard>
          <PrimaryButton icon="share" label="Compartilhar resumo" onPress={() => void shareSummary()} />
          <Text style={styles.disclaimer}>A plataforma não substitui avaliação médica e não recomenda alterações de prescrição.</Text>
        </>
      ) : !error && data ? (
        <EmptyState icon="insights" title="Análise em construção" description="Cadastre um medicamento e confirme as doses para gerar um resumo compartilhável." />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { alignSelf: 'center', gap: 18, maxWidth: 680, paddingTop: 8, width: '100%' },
  levelCard: { gap: 15 },
  levelTop: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  levelLabelDark: { color: VitalisColors.onDarkMuted, fontFamily: VitalisFonts.bodySemiBold, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase' },
  levelValueDark: { color: VitalisColors.onDark, fontFamily: VitalisFonts.bodyBold, fontSize: 52, fontVariant: ['tabular-nums'], letterSpacing: -1.4, lineHeight: 58 },
  levelBodyDark: { color: VitalisColors.onDarkMuted, fontFamily: VitalisFonts.body, fontSize: 14, lineHeight: 21 },
  upcomingRow: { alignItems: 'flex-start', backgroundColor: VitalisColors.surfaceDarkElevated, borderRadius: VitalisRadius.md, flexDirection: 'row', gap: 9, padding: 11 },
  upcomingText: { color: VitalisColors.onDarkMuted, flex: 1, fontFamily: VitalisFonts.bodyMedium, fontSize: 13, lineHeight: 19 },
  momentCard: { alignItems: 'flex-start', flexDirection: 'row', gap: 12 },
  momentIcon: { alignItems: 'center', backgroundColor: VitalisColors.surface, borderRadius: VitalisRadius.md, height: 44, justifyContent: 'center', width: 44 },
  momentCopy: { flex: 1, gap: 5 },
  insightCard: { alignItems: 'flex-start', flexDirection: 'row', gap: 12 },
  insightCopy: { flex: 1, gap: 5 },
  itemTitle: { color: VitalisColors.ink, fontFamily: VitalisFonts.bodySemiBold, fontSize: 16 },
  itemBody: { color: VitalisColors.muted, fontFamily: VitalisFonts.body, fontSize: 14, lineHeight: 21 },
  disclaimer: { color: VitalisColors.mutedSoft, fontFamily: VitalisFonts.body, fontSize: 13, lineHeight: 20, textAlign: 'center' },
});
