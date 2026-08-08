import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';

import { LogoMark, PrimaryButton, ScreenContainer, StatusPill } from '@/components/vitalis-ui';
import { VitalisColors, VitalisFonts, VitalisRadius, VitalisSpacing } from '@/constants/vitalis-theme';

const highlights = [
  { icon: 'schedule' as const, label: 'Próxima dose sempre visível' },
  { icon: 'check-circle-outline' as const, label: 'Confirmação e histórico de tomas' },
  { icon: 'auto-awesome' as const, label: 'IA HUB conectado à sua rotina' },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const wide = width >= 760;

  return (
    <ScreenContainer atmosphere="brand" scroll contentContainerStyle={styles.content}>
      <View style={styles.brandRow}>
        <LogoMark size={44} />
        <Text style={styles.brandName}>Vitalis</Text>
        <StatusPill label="Cuidado conectado" tone="success" />
      </View>

      <View style={[styles.introGrid, wide && styles.introGridWide]}>
        <View style={styles.introCopy}>
          <View style={styles.copy}>
            <Text accessibilityRole="header" style={styles.title}>
              Seu tratamento,{`\n`}sem ruído.
            </Text>
            <Text style={styles.description}>
              Organize medicamentos, confirme doses e acompanhe sua rotina em um único lugar, simples para usar e preciso para confiar.
            </Text>
          </View>

          <View style={styles.actions}>
            <PrimaryButton icon="arrow-forward" label="Criar minha conta" onPress={() => router.push('/signup')} />
            <PrimaryButton label="Já tenho uma conta" onPress={() => router.push('/login')} tone="secondary" />
          </View>
        </View>

        <LinearGradient
          colors={['#1D303A', VitalisColors.surfaceDark, '#0C1419']}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={styles.hero}>
          <View style={styles.demoLabelRow}>
            <MaterialIcons color={VitalisColors.primarySoft} name="visibility" size={16} />
            <Text style={styles.demoLabel}>Exemplo ilustrativo</Text>
          </View>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroEyebrow}>Próxima dose</Text>
              <Text style={styles.heroTime}>14:00</Text>
            </View>
            <View style={styles.heroPulse}>
              <View style={styles.heroPulseDot} />
              <Text style={styles.heroPulseText}>Hoje</Text>
            </View>
          </View>
          <View accessibilityLabel="Exemplo de linha do dia com uma dose confirmada, uma próxima e uma futura" style={styles.capsuleTrack}>
            <View style={styles.trackLine} />
            <View style={[styles.trackNode, styles.trackNodeDone]}>
              <MaterialIcons color={VitalisColors.surface} name="check" size={15} />
            </View>
            <View style={[styles.trackNode, styles.trackNodeActive]} />
            <View style={styles.trackNode} />
          </View>
          <View style={styles.heroMedication}>
            <View style={styles.heroMedicationIcon}>
              <MaterialIcons color={VitalisColors.primary} name="medication" size={24} />
            </View>
            <View style={styles.heroMedicationCopy}>
              <Text style={styles.heroMedicationTitle}>Losartana · 50 mg</Text>
              <Text style={styles.heroMedicationBody}>Após o almoço, com água.</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      <View accessibilityLabel="Recursos principais" style={styles.highlightList}>
        {highlights.map((item) => (
          <View key={item.label} style={styles.highlightRow}>
            <MaterialIcons color={VitalisColors.primaryStrong} name={item.icon} size={21} />
            <Text style={styles.highlightText}>{item.label}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.disclaimer}>A Vitalis apoia sua organização e não substitui orientação médica.</Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { alignSelf: 'center', gap: 22, maxWidth: 820, paddingTop: 10, width: '100%' },
  brandRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  brandName: { color: VitalisColors.ink, flex: 1, fontFamily: VitalisFonts.logo, fontSize: 18 },
  introGrid: { gap: 20 },
  introGridWide: { alignItems: 'stretch', flexDirection: 'row' },
  introCopy: { flex: 0.92, gap: 22, justifyContent: 'center', minWidth: 0 },
  copy: { gap: 10 },
  title: { color: VitalisColors.ink, fontFamily: VitalisFonts.display, fontSize: 42, letterSpacing: -1, lineHeight: 43 },
  description: { color: VitalisColors.muted, fontFamily: VitalisFonts.body, fontSize: 16, lineHeight: 25, maxWidth: 570 },
  hero: { borderColor: '#29414E', borderRadius: VitalisRadius.xl, borderWidth: 1, boxShadow: '0 20px 42px rgba(17,25,31,0.18)', flex: 1.08, gap: 16, minHeight: 254, overflow: 'hidden', padding: VitalisSpacing.lg },
  demoLabelRow: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  demoLabel: { color: VitalisColors.primarySoft, fontFamily: VitalisFonts.bodySemiBold, fontSize: 12, letterSpacing: 0.7, textTransform: 'uppercase' },
  heroTop: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  heroEyebrow: { color: VitalisColors.onDarkMuted, fontFamily: VitalisFonts.bodySemiBold, fontSize: 12, letterSpacing: 1.1, textTransform: 'uppercase' },
  heroTime: { color: VitalisColors.onDark, fontFamily: VitalisFonts.bodyBold, fontSize: 52, fontVariant: ['tabular-nums'], letterSpacing: -1.5, lineHeight: 58 },
  heroPulse: { alignItems: 'center', backgroundColor: 'rgba(31,157,103,0.14)', borderRadius: 999, flexDirection: 'row', gap: 6, paddingHorizontal: 10, paddingVertical: 7 },
  heroPulseDot: { backgroundColor: '#68D7A2', borderRadius: 999, height: 7, width: 7 },
  heroPulseText: { color: '#9BE7BF', fontFamily: VitalisFonts.bodySemiBold, fontSize: 12 },
  capsuleTrack: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 5, position: 'relative' },
  trackLine: { backgroundColor: '#34505F', height: 1, left: 16, position: 'absolute', right: 16, top: 15 },
  trackNode: { backgroundColor: '#263B46', borderColor: '#4B626E', borderRadius: 999, borderWidth: 1, height: 31, width: 31 },
  trackNodeDone: { alignItems: 'center', backgroundColor: VitalisColors.success, borderColor: VitalisColors.success, justifyContent: 'center' },
  trackNodeActive: { backgroundColor: VitalisColors.primary, borderColor: '#7DB4F0', borderWidth: 6 },
  heroMedication: { alignItems: 'center', backgroundColor: 'rgba(255,253,248,0.08)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: VitalisRadius.lg, borderWidth: 1, flexDirection: 'row', gap: 13, marginTop: 'auto', padding: 15 },
  heroMedicationIcon: { alignItems: 'center', backgroundColor: VitalisColors.primarySoft, borderRadius: 12, height: 46, justifyContent: 'center', width: 46 },
  heroMedicationCopy: { flex: 1, gap: 3 },
  heroMedicationTitle: { color: VitalisColors.onDark, fontFamily: VitalisFonts.bodySemiBold, fontSize: 16 },
  heroMedicationBody: { color: VitalisColors.onDarkMuted, fontFamily: VitalisFonts.body, fontSize: 14 },
  highlightList: { borderBottomColor: VitalisColors.border, borderBottomWidth: 1, borderTopColor: VitalisColors.border, borderTopWidth: 1 },
  highlightRow: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 52, paddingHorizontal: 4 },
  highlightText: { color: VitalisColors.bodyStrong, flex: 1, fontFamily: VitalisFonts.bodyMedium, fontSize: 14 },
  actions: { gap: 11 },
  disclaimer: { color: VitalisColors.mutedSoft, fontFamily: VitalisFonts.body, fontSize: 13, lineHeight: 20, textAlign: 'center' },
});
