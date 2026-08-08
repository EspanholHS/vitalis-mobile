import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { Redirect } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import {
  IconButton,
  InlineNotice,
  InputField,
  LoadingState,
  MedicationMark,
  PrimaryButton,
  ScreenContainer,
  ScreenHeader,
  SectionCard,
  StatusPill,
} from '@/components/vitalis-ui';
import {
  MedicationColors,
  type MedicationColorToken,
  VitalisColors,
  VitalisFonts,
  VitalisRadius,
} from '@/constants/vitalis-theme';
import { useAuth } from '@/contexts/auth-context';
import { useSafeBack } from '@/hooks/use-safe-back';
import { calculateTreatmentEndDate, formatDateKey } from '@/lib/medication-duration';
import { createMedication, generateDoseTimes, localDateKey } from '@/lib/vitalis-data';

const intervals = [6, 8, 12, 24] as const;
const colorOptions: { token: MedicationColorToken; label: string }[] = [
  { token: 'blue', label: 'Azul' },
  { token: 'mint', label: 'Verde' },
  { token: 'amber', label: 'Âmbar' },
  { token: 'coral', label: 'Coral' },
  { token: 'violet', label: 'Violeta' },
];

function pad(value: number) {
  return String(value).padStart(2, '0');
}

type StepperProps = {
  label: string;
  value: string;
  onDecrease: () => void;
  onIncrease: () => void;
};

function TimeStepper({ label, value, onDecrease, onIncrease }: StepperProps) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable accessibilityLabel={`Diminuir ${label}`} accessibilityRole="button" onPress={onDecrease} style={({ pressed }) => [styles.stepperButton, pressed && styles.pressed]}>
          <MaterialIcons color={VitalisColors.primaryStrong} name="remove" size={22} />
        </Pressable>
        <Text style={styles.stepperValue}>{value}</Text>
        <Pressable accessibilityLabel={`Aumentar ${label}`} accessibilityRole="button" onPress={onIncrease} style={({ pressed }) => [styles.stepperButton, pressed && styles.pressed]}>
          <MaterialIcons color={VitalisColors.primaryStrong} name="add" size={22} />
        </Pressable>
      </View>
    </View>
  );
}

export default function MedicationScreen() {
  const goBack = useSafeBack('/(tabs)/home');
  const { width } = useWindowDimensions();
  const { loading: authLoading, user } = useAuth();
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [instructions, setInstructions] = useState('');
  const [hour, setHour] = useState(8);
  const [minute, setMinute] = useState(0);
  const [interval, setInterval] = useState<(typeof intervals)[number]>(8);
  const [durationDays, setDurationDays] = useState<number | null>(null);
  const [colorToken, setColorToken] = useState<MedicationColorToken>('blue');
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; dosage?: string }>({});
  const [error, setError] = useState<string | null>(null);

  const firstDoseTime = `${pad(hour)}:${pad(minute)}`;
  const startDate = useMemo(() => localDateKey(), []);
  const endDate = useMemo(
    () => calculateTreatmentEndDate(startDate, durationDays),
    [durationDays, startDate],
  );
  const doseTimes = useMemo(() => generateDoseTimes(firstDoseTime, interval), [firstDoseTime, interval]);

  async function handleSave() {
    const nextErrors: { name?: string; dosage?: string } = {};
    if (name.trim().length < 2) nextErrors.name = 'Digite o nome do medicamento.';
    if (!dosage.trim()) nextErrors.dosage = 'Informe a dosagem, por exemplo: 50 mg.';
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaving(true);
    setError(null);
    try {
      await createMedication(user?.id, {
        name,
        dosage,
        instructions,
        intervalHours: interval,
        firstDoseTime,
        startDate,
        endDate,
        colorToken,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      goBack();
    } catch {
      setError('Não foi possível salvar. Verifique os dados e tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  if (authLoading) {
    return <ScreenContainer><LoadingState label="Preparando cadastro…" /></ScreenContainer>;
  }
  if (!user) return <Redirect href="/login" />;

  return (
    <ScreenContainer keyboard scroll contentContainerStyle={styles.content}>
      <ScreenHeader
        action={<IconButton icon="close" label="Fechar cadastro" onPress={goBack} />}
        description="Informe apenas os dados já orientados pelo seu médico ou farmacêutico."
        eyebrow="Rotina"
        title="Novo medicamento"
      />

      <SectionCard style={styles.identityCard}>
        <MedicationMark colorToken={colorToken} size={52} />
        <View style={styles.identityCopy}>
          <Text style={styles.identityTitle}>{name.trim() || 'Nome do medicamento'}</Text>
          <Text style={styles.identityBody}>
            {dosage.trim() || 'Dosagem'} · a cada {interval}h · {durationDays === null ? 'uso contínuo' : `${durationDays} dias`}
          </Text>
        </View>
      </SectionCard>

      <View style={[styles.formGrid, width >= 700 && styles.formGridWide]}>
        <View style={[styles.section, styles.formColumn]}>
          <View style={styles.sectionIntro}>
            <Text style={styles.sectionLabel}>1 · Identificação</Text>
            <Text style={styles.sectionDescription}>Como o medicamento deve aparecer na sua rotina.</Text>
          </View>
          <InputField
            accessibilityHint={fieldErrors.name}
            autoCapitalize="words"
            error={fieldErrors.name}
            label="Medicamento"
            maxLength={120}
            onChangeText={(value) => {
              setName(value);
              setFieldErrors((current) => ({ ...current, name: undefined }));
              setError(null);
            }}
            placeholder="Ex.: Losartana"
            value={name}
          />
          <InputField
            accessibilityHint={fieldErrors.dosage}
            autoCapitalize="none"
            error={fieldErrors.dosage}
            label="Dosagem"
            maxLength={80}
            onChangeText={(value) => {
              setDosage(value);
              setFieldErrors((current) => ({ ...current, dosage: undefined }));
              setError(null);
            }}
            placeholder="Ex.: 50 mg"
            value={dosage}
          />
        </View>

        <View style={[styles.section, styles.formColumn]}>
          <View style={styles.sectionIntro}>
            <Text style={styles.sectionLabel}>2 · Primeira dose</Text>
            <Text style={styles.sectionDescription}>A agenda será calculada a partir deste horário.</Text>
          </View>
          <SectionCard style={styles.scheduleCard} tone="soft">
            <View style={styles.scheduleHeader}>
              <View>
                <Text style={styles.scheduleEyebrow}>Horário inicial</Text>
                <Text accessibilityLabel={`Primeira dose às ${firstDoseTime}`} style={styles.scheduleTime}>{firstDoseTime}</Text>
              </View>
              <StatusPill icon="schedule" label={`${doseTimes.length} ${doseTimes.length === 1 ? 'dose/dia' : 'doses/dia'}`} tone="blue" />
            </View>
            <View style={[styles.steppersRow, width < 360 && styles.steppersRowCompact]}>
              <TimeStepper label="hora" value={pad(hour)} onDecrease={() => setHour((current) => (current + 23) % 24)} onIncrease={() => setHour((current) => (current + 1) % 24)} />
              <TimeStepper label="minutos" value={pad(minute)} onDecrease={() => setMinute((current) => (current + 55) % 60)} onIncrease={() => setMinute((current) => (current + 5) % 60)} />
            </View>
          </SectionCard>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionIntro}>
          <Text style={styles.sectionLabel}>3 · Frequência</Text>
          <Text style={styles.sectionDescription}>Escolha o intervalo exatamente como foi orientado.</Text>
        </View>
        <View accessibilityLabel="Intervalo entre doses" accessibilityRole="radiogroup" style={styles.intervalRow}>
          {intervals.map((option) => {
            const selected = option === interval;
            return (
              <Pressable
                accessibilityLabel={`A cada ${option} horas`}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                key={option}
                onPress={() => setInterval(option)}
                style={({ pressed }) => [styles.intervalChip, selected && styles.intervalChipSelected, pressed && styles.pressed]}>
                <Text style={[styles.intervalText, selected && styles.intervalTextSelected]}>A cada {option}h</Text>
              </Pressable>
            );
          })}
        </View>
        <SectionCard style={styles.previewCard} tone="dark">
          <Text style={styles.previewLabel}>Agenda gerada</Text>
          <View style={styles.previewTimes}>
            {doseTimes.map((time, index) => (
              <View key={time} style={styles.previewTimeRow}>
                <View style={[styles.previewNode, index === 0 && styles.previewNodeActive]} />
                <Text style={styles.previewTime}>{time.slice(0, 5)}</Text>
              </View>
            ))}
          </View>
        </SectionCard>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionIntro}>
          <Text style={styles.sectionLabel}>4 · Duração</Text>
          <Text style={styles.sectionDescription}>Informe por quanto tempo esta rotina foi orientada.</Text>
        </View>
        <View accessibilityLabel="Duração do tratamento" accessibilityRole="radiogroup" style={styles.durationModeRow}>
          <Pressable
            accessibilityHint="Mantém o medicamento sem uma data final definida"
            accessibilityLabel="Uso contínuo"
            accessibilityRole="radio"
            accessibilityState={{ checked: durationDays === null }}
            onPress={() => setDurationDays(null)}
            style={({ pressed }) => [styles.durationMode, durationDays === null && styles.durationModeSelected, pressed && styles.pressed]}>
            <MaterialIcons color={durationDays === null ? VitalisColors.primaryStrong : VitalisColors.muted} name="all-inclusive" size={21} />
            <View style={styles.durationModeCopy}>
              <Text style={[styles.durationModeTitle, durationDays === null && styles.durationModeTitleSelected]}>Uso contínuo</Text>
              <Text style={styles.durationModeBody}>Sem data final</Text>
            </View>
          </Pressable>
          <Pressable
            accessibilityHint="Permite definir a quantidade de dias do tratamento"
            accessibilityLabel="Tratamento por período"
            accessibilityRole="radio"
            accessibilityState={{ checked: durationDays !== null }}
            onPress={() => setDurationDays((current) => current ?? 7)}
            style={({ pressed }) => [styles.durationMode, durationDays !== null && styles.durationModeSelected, pressed && styles.pressed]}>
            <MaterialIcons color={durationDays !== null ? VitalisColors.primaryStrong : VitalisColors.muted} name="date-range" size={21} />
            <View style={styles.durationModeCopy}>
              <Text style={[styles.durationModeTitle, durationDays !== null && styles.durationModeTitleSelected]}>Por período</Text>
              <Text style={styles.durationModeBody}>Definir dias</Text>
            </View>
          </Pressable>
        </View>
        {durationDays !== null ? (
          <SectionCard style={styles.durationCard} tone="soft">
            <View style={styles.durationSummary}>
              <View style={styles.durationSummaryCopy}>
                <Text style={styles.durationEyebrow}>Tempo de tratamento</Text>
                <Text accessibilityLiveRegion="polite" style={styles.durationValue}>
                  {durationDays} {durationDays === 1 ? 'dia' : 'dias'}
                </Text>
                <Text style={styles.durationEnd}>De hoje até {formatDateKey(endDate!)}</Text>
              </View>
              <View style={styles.durationControls}>
                <Pressable
                  accessibilityLabel="Diminuir duração em um dia"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: durationDays <= 1 }}
                  disabled={durationDays <= 1}
                  onPress={() => setDurationDays((current) => Math.max(1, (current ?? 7) - 1))}
                  style={({ pressed }) => [styles.durationButton, durationDays <= 1 && styles.controlDisabled, pressed && styles.pressed]}>
                  <MaterialIcons color={VitalisColors.primaryStrong} name="remove" size={22} />
                </Pressable>
                <Pressable
                  accessibilityLabel="Aumentar duração em um dia"
                  accessibilityRole="button"
                  accessibilityState={{ disabled: durationDays >= 3650 }}
                  disabled={durationDays >= 3650}
                  onPress={() => setDurationDays((current) => Math.min(3650, (current ?? 7) + 1))}
                  style={({ pressed }) => [styles.durationButton, durationDays >= 3650 && styles.controlDisabled, pressed && styles.pressed]}>
                  <MaterialIcons color={VitalisColors.primaryStrong} name="add" size={22} />
                </Pressable>
              </View>
            </View>
            <Text style={styles.durationHelper}>O dia de início conta como o primeiro dia.</Text>
          </SectionCard>
        ) : (
          <Text style={styles.durationHelper}>Você poderá pausar o medicamento depois, sem apagar o histórico.</Text>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionIntro}>
          <Text style={styles.sectionLabel}>5 · Identidade visual</Text>
          <Text style={styles.sectionDescription}>Uma cor ajuda a reconhecer o medicamento rapidamente.</Text>
        </View>
        <View accessibilityLabel="Cor do medicamento" accessibilityRole="radiogroup" style={styles.colorRow}>
          {colorOptions.map((option) => {
            const selected = option.token === colorToken;
            return (
              <Pressable
                accessibilityLabel={`Cor ${option.label}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                key={option.token}
                onPress={() => setColorToken(option.token)}
                style={({ pressed }) => [styles.colorOption, selected && styles.colorOptionSelected, pressed && styles.pressed]}>
                <View style={[styles.colorSwatch, { backgroundColor: MedicationColors[option.token].solid }]} />
                <Text style={styles.colorLabel}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <InputField helper="Inclua apenas a orientação já recebida do profissional de saúde." label="Orientações (opcional)" maxLength={500} multiline onChangeText={setInstructions} placeholder="Ex.: tomar após o almoço, com água" value={instructions} />

      {error ? <InlineNotice description={error} title="Revise o cadastro" tone="danger" /> : null}

      <PrimaryButton accessibilityHint="Salva o medicamento e os horários exibidos na agenda gerada" icon="check" label="Salvar medicamento" loading={saving} onPress={() => void handleSave()} />
      <Text style={styles.disclaimer}>Revise os horários conforme a orientação do seu médico ou farmacêutico.</Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { alignSelf: 'center', gap: 24, maxWidth: 760, paddingTop: 8, width: '100%' },
  identityCard: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  identityCopy: { flex: 1, gap: 3 },
  identityTitle: { color: VitalisColors.ink, fontFamily: VitalisFonts.bodySemiBold, fontSize: 17 },
  identityBody: { color: VitalisColors.muted, fontFamily: VitalisFonts.body, fontSize: 13 },
  formGrid: { gap: 22 },
  formGridWide: { alignItems: 'flex-start', flexDirection: 'row' },
  formColumn: { flex: 1, width: '100%' },
  section: { gap: 12 },
  sectionIntro: { gap: 3 },
  sectionLabel: { color: VitalisColors.primaryStrong, fontFamily: VitalisFonts.bodyBold, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase' },
  sectionDescription: { color: VitalisColors.muted, fontFamily: VitalisFonts.body, fontSize: 13, lineHeight: 19 },
  scheduleCard: { gap: 18 },
  scheduleHeader: { alignItems: 'flex-start', flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  scheduleEyebrow: { color: VitalisColors.muted, fontFamily: VitalisFonts.bodySemiBold, fontSize: 12 },
  scheduleTime: { color: VitalisColors.ink, fontFamily: VitalisFonts.bodyBold, fontSize: 40, fontVariant: ['tabular-nums'], letterSpacing: -1, lineHeight: 45 },
  steppersRow: { flexDirection: 'row', gap: 12 },
  steppersRowCompact: { flexDirection: 'column' },
  stepper: { flex: 1, gap: 7 },
  stepperLabel: { color: VitalisColors.muted, fontFamily: VitalisFonts.bodyMedium, fontSize: 12, textTransform: 'capitalize' },
  stepperControls: { alignItems: 'center', backgroundColor: VitalisColors.surface, borderColor: VitalisColors.border, borderRadius: VitalisRadius.md, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', overflow: 'hidden' },
  stepperButton: { alignItems: 'center', height: 50, justifyContent: 'center', width: 46 },
  stepperValue: { color: VitalisColors.ink, fontFamily: VitalisFonts.bodyBold, fontSize: 17, fontVariant: ['tabular-nums'] },
  intervalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  intervalChip: { alignItems: 'center', backgroundColor: VitalisColors.surface, borderColor: VitalisColors.border, borderRadius: VitalisRadius.pill, borderWidth: 1, minHeight: 44, paddingHorizontal: 15, justifyContent: 'center' },
  intervalChipSelected: { backgroundColor: VitalisColors.primarySoft, borderColor: VitalisColors.primary },
  intervalText: { color: VitalisColors.muted, fontFamily: VitalisFonts.bodySemiBold, fontSize: 13 },
  intervalTextSelected: { color: VitalisColors.primaryStrong },
  durationModeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  durationMode: { alignItems: 'center', backgroundColor: VitalisColors.surface, borderColor: VitalisColors.border, borderRadius: VitalisRadius.md, borderWidth: 1, flexDirection: 'row', flexGrow: 1, gap: 10, minHeight: 64, minWidth: 150, paddingHorizontal: 14, paddingVertical: 10 },
  durationModeSelected: { backgroundColor: VitalisColors.primaryMist, borderColor: VitalisColors.primary },
  durationModeCopy: { flex: 1, gap: 2 },
  durationModeTitle: { color: VitalisColors.bodyStrong, fontFamily: VitalisFonts.bodySemiBold, fontSize: 14 },
  durationModeTitleSelected: { color: VitalisColors.primaryStrong },
  durationModeBody: { color: VitalisColors.muted, fontFamily: VitalisFonts.body, fontSize: 12 },
  durationCard: { gap: 12 },
  durationSummary: { alignItems: 'center', flexDirection: 'row', gap: 14, justifyContent: 'space-between' },
  durationSummaryCopy: { flex: 1, gap: 2 },
  durationEyebrow: { color: VitalisColors.muted, fontFamily: VitalisFonts.bodySemiBold, fontSize: 12 },
  durationValue: { color: VitalisColors.ink, fontFamily: VitalisFonts.bodyBold, fontSize: 23, fontVariant: ['tabular-nums'], lineHeight: 29 },
  durationEnd: { color: VitalisColors.muted, fontFamily: VitalisFonts.body, fontSize: 13, lineHeight: 19 },
  durationControls: { flexDirection: 'row', gap: 8 },
  durationButton: { alignItems: 'center', backgroundColor: VitalisColors.surface, borderColor: VitalisColors.border, borderRadius: VitalisRadius.md, borderWidth: 1, height: 46, justifyContent: 'center', width: 46 },
  durationHelper: { color: VitalisColors.mutedSoft, fontFamily: VitalisFonts.body, fontSize: 12, lineHeight: 18 },
  controlDisabled: { opacity: 0.45 },
  previewCard: { gap: 14 },
  previewLabel: { color: VitalisColors.onDarkMuted, fontFamily: VitalisFonts.bodySemiBold, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  previewTimes: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  previewTimeRow: { alignItems: 'center', backgroundColor: VitalisColors.surfaceDarkElevated, borderRadius: 999, flexDirection: 'row', gap: 7, minHeight: 38, paddingHorizontal: 11 },
  previewNode: { backgroundColor: '#526975', borderRadius: 999, height: 7, width: 7 },
  previewNodeActive: { backgroundColor: '#6FB4FF' },
  previewTime: { color: VitalisColors.onDark, fontFamily: VitalisFonts.bodySemiBold, fontSize: 13, fontVariant: ['tabular-nums'] },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  colorOption: { alignItems: 'center', backgroundColor: VitalisColors.surface, borderColor: VitalisColors.border, borderRadius: VitalisRadius.md, borderWidth: 1, gap: 6, minHeight: 64, minWidth: 64, padding: 8 },
  colorOptionSelected: { backgroundColor: VitalisColors.primaryMist, borderColor: VitalisColors.primary, boxShadow: '0 7px 18px rgba(21,101,216,0.1)' },
  colorSwatch: { borderRadius: 999, height: 22, width: 22 },
  colorLabel: { color: VitalisColors.muted, fontFamily: VitalisFonts.bodyMedium, fontSize: 12 },
  disclaimer: { color: VitalisColors.mutedSoft, fontFamily: VitalisFonts.body, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.985 }] },
});
