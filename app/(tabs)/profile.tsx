import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, useWindowDimensions, View } from 'react-native';

import {
  EmptyState,
  ErrorState,
  InlineNotice,
  LoadingState,
  MedicationMark,
  PrimaryButton,
  ScreenContainer,
  ScreenHeader,
  SectionCard,
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
import { treatmentDurationLabel } from '@/lib/medication-duration';
import { deleteMedication, type MedicationWithSchedules, listMedications, setMedicationActive } from '@/lib/vitalis-data';

type MedicationAction = 'toggle' | 'delete';
type FeedbackTone = 'success' | 'danger';

type ActionFeedback = {
  title: string;
  description: string;
  tone: FeedbackTone;
};

const technicalNames = new Set([
  'admin',
  'administrator',
  'administrador',
  'test',
  'teste',
  'user',
  'usuario',
  'usuário',
]);

function isHumanName(value: string | null | undefined) {
  const normalized = value?.trim().toLocaleLowerCase('pt-BR');
  return Boolean(normalized && !technicalNames.has(normalized) && !normalized.includes('@'));
}

function accountDisplayName(preferredName: string | null | undefined, fullName: string | null | undefined) {
  if (isHumanName(preferredName)) return preferredName!.trim();
  if (isHumanName(fullName)) return fullName!.trim();
  return 'Sua conta Vitalis';
}

function initialsFor(value: string) {
  if (value === 'Sua conta Vitalis') return 'V';
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function frequencyLabel(intervalHours: number) {
  if (intervalHours === 1) return 'A cada hora';
  return `A cada ${intervalHours} horas`;
}

function scheduleCountLabel(count: number) {
  if (count === 1) return '1 horário por dia';
  return `${count} horários por dia`;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { profile, signOut, user } = useAuth();
  const [medications, setMedications] = useState<MedicationWithSchedules[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<{ id: string; action: MedicationAction } | null>(null);
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [focusedControl, setFocusedControl] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (!user?.id) return;
    if (refresh) setRefreshing(true); else setLoading(true);
    setError(null);
    try {
      setMedications(await listMedications(user.id));
    } catch {
      setError('Seus medicamentos não puderam ser carregados. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const displayName = accountDisplayName(profile?.preferred_name, profile?.full_name);
  const initials = initialsFor(displayName);
  const activeCount = medications.filter((medication) => medication.is_active).length;

  async function toggleMedication(medication: MedicationWithSchedules, active: boolean) {
    if (busyAction) return;
    setFeedback(null);
    setBusyAction({ id: medication.id, action: 'toggle' });
    try {
      await setMedicationActive(user?.id, medication.id, active);
      await load(true);
      setFeedback({
        title: active ? 'Medicamento reativado' : 'Medicamento pausado',
        description: active
          ? `${medication.name} voltou a fazer parte da sua agenda.`
          : `${medication.name} não aparecerá nas próximas doses enquanto estiver pausado.`,
        tone: 'success',
      });
    } catch {
      setFeedback({
        title: 'Não foi possível atualizar',
        description: `O estado de ${medication.name} não foi alterado. Tente novamente.`,
        tone: 'danger',
      });
    } finally {
      setBusyAction(null);
    }
  }

  function confirmDelete(medication: MedicationWithSchedules) {
    if (busyAction) return;
    Alert.alert(
      'Excluir medicamento?',
      `“${medication.name}” e seus registros vinculados serão removidos. Esta ação não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            setFeedback(null);
            setBusyAction({ id: medication.id, action: 'delete' });
            try {
              await deleteMedication(user?.id, medication.id);
              await load(true);
              setFeedback({
                title: 'Medicamento excluído',
                description: `${medication.name} e os registros vinculados foram removidos da sua conta.`,
                tone: 'success',
              });
            } catch {
              setFeedback({
                title: 'Não foi possível excluir',
                description: `${medication.name} continua na sua conta. Tente novamente.`,
                tone: 'danger',
              });
            } finally {
              setBusyAction(null);
            }
          },
        },
      ],
    );
  }

  async function handleSignOut() {
    if (signingOut) return;
    setFeedback(null);
    setSigningOut(true);
    const result = await signOut();
    if (result.error) {
      setFeedback({ title: 'Não foi possível sair', description: result.error, tone: 'danger' });
      setSigningOut(false);
      return;
    }
    router.replace('/welcome');
  }

  if (loading && !medications.length) {
    return <ScreenContainer><LoadingState label="Organizando seu perfil…" /></ScreenContainer>;
  }

  return (
    <ScreenContainer
      onRefresh={() => void load(true)}
      refreshing={refreshing}
      scroll
      contentContainerStyle={styles.content}>
      <ScreenHeader
        description="Gerencie sua conta, sua rotina de medicamentos e as escolhas de privacidade."
        eyebrow="Sua conta"
        title="Perfil"
      />

      {error ? <ErrorState message={error} onRetry={() => void load()} /> : null}
      {feedback ? (
        <InlineNotice description={feedback.description} title={feedback.title} tone={feedback.tone} />
      ) : null}

      <View style={styles.section}>
        <SectionHeading eyebrow="Conta" title="Dados da conta" />
        <SectionCard style={styles.profileCard} tone="dark">
          <View style={styles.avatar}>
            <Text accessibilityLabel={`Iniciais de ${displayName}`} style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.profileCopy}>
            <Text numberOfLines={2} style={styles.profileName}>{displayName}</Text>
            <Text numberOfLines={1} style={styles.profileEmail}>{user?.email}</Text>
            <View style={styles.profileStatus}>
              <StatusPill icon="verified-user" label="Sessão protegida" tone="dark" />
            </View>
          </View>
        </SectionCard>
      </View>

      <View style={styles.section}>
        <SectionHeading
          action={(
            <Pressable
              accessibilityHint="Abre o formulário para cadastrar um medicamento"
              accessibilityRole="button"
              onBlur={() => setFocusedControl(null)}
              onFocus={() => setFocusedControl('add-medication')}
              onPress={() => router.push('/medication')}
              style={({ hovered, pressed }) => [
                styles.addButton,
                hovered && styles.addButtonHovered,
                focusedControl === 'add-medication' && styles.focusVisible,
                pressed && styles.pressed,
              ]}>
              <MaterialIcons color={VitalisColors.surface} name="add" size={20} />
              <Text style={styles.addButtonText}>Adicionar</Text>
            </Pressable>
          )}
          eyebrow="Tratamento"
          meta={medications.length
            ? `${activeCount} de ${medications.length} ${medications.length === 1 ? 'medicamento ativo' : 'medicamentos ativos'}`
            : undefined}
          title="Medicamentos"
        />

        {error && !medications.length ? null : !medications.length ? (
          <EmptyState
            action={<PrimaryButton icon="add" label="Cadastrar medicamento" onPress={() => router.push('/medication')} />}
            description="Cadastre o primeiro medicamento para criar sua agenda e acompanhar as doses."
            icon="medication"
            title="Sua lista está vazia"
          />
        ) : (
          <View style={[styles.medicationList, width >= 768 && styles.medicationListWide]}>
            {medications.map((medication) => {
              const isBusy = busyAction?.id === medication.id;
              const isToggling = isBusy && busyAction?.action === 'toggle';
              const isDeleting = isBusy && busyAction?.action === 'delete';
              const disabled = Boolean(busyAction);

              return (
                <SectionCard
                  key={medication.id}
                  style={[
                    styles.medicationCard,
                    width >= 768 && styles.medicationCardWide,
                    !medication.is_active && styles.medicationInactive,
                  ]}>
                  <View style={styles.medicationTop}>
                    <MedicationMark colorToken={medication.color_token} size={44} />
                    <View style={styles.medicationCopy}>
                      <Text numberOfLines={2} style={styles.medicationName}>{medication.name}</Text>
                      <Text style={styles.medicationDosage}>{medication.dosage}</Text>
                    </View>

                    <View style={styles.switchBlock}>
                      <View style={styles.switchLabelRow}>
                        {isToggling ? <ActivityIndicator color={VitalisColors.primary} size="small" /> : null}
                        <Text style={[styles.switchLabel, medication.is_active && styles.switchLabelActive]}>
                          {isToggling ? 'Atualizando' : medication.is_active ? 'Ativo' : 'Pausado'}
                        </Text>
                      </View>
                      <Switch
                        accessibilityHint={medication.is_active
                          ? 'Desative para pausar as próximas doses deste medicamento'
                          : 'Ative para incluir este medicamento novamente na agenda'}
                        accessibilityLabel={`${medication.name}: ${medication.is_active ? 'ativo' : 'pausado'}`}
                        accessibilityRole="switch"
                        accessibilityState={{ checked: medication.is_active, disabled: disabled || isToggling, busy: isToggling }}
                        disabled={disabled || isToggling}
                        onValueChange={(active) => void toggleMedication(medication, active)}
                        thumbColor={VitalisColors.surface}
                        trackColor={{ false: VitalisColors.borderStrong, true: VitalisColors.success }}
                        value={medication.is_active}
                      />
                    </View>
                  </View>

                  <View style={styles.medicationFacts}>
                    <View style={styles.factItem}>
                      <MaterialIcons color={VitalisColors.primaryStrong} name="repeat" size={17} />
                      <Text style={styles.factText}>{frequencyLabel(medication.interval_hours)}</Text>
                    </View>
                    <View style={styles.factItem}>
                      <MaterialIcons color={VitalisColors.primaryStrong} name="schedule" size={17} />
                      <Text style={styles.factText}>{scheduleCountLabel(medication.schedules.length)}</Text>
                    </View>
                    <View style={styles.factItem}>
                      <MaterialIcons color={VitalisColors.primaryStrong} name="event-available" size={17} />
                      <Text style={styles.factText}>{treatmentDurationLabel(medication.start_date, medication.end_date)}</Text>
                    </View>
                  </View>

                  {medication.schedules.length ? (
                    <View style={styles.scheduleBlock}>
                      <Text style={styles.scheduleLabel}>Horários</Text>
                      <View style={styles.scheduleRow}>
                        {medication.schedules.map((schedule) => (
                          <View accessibilityLabel={`Dose às ${schedule.dose_time.slice(0, 5)}`} key={schedule.id} style={styles.scheduleChip}>
                            <Text style={styles.scheduleTime}>{schedule.dose_time.slice(0, 5)}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}

                  {medication.instructions ? (
                    <View style={styles.instructionRow}>
                      <MaterialIcons color={VitalisColors.muted} name="info-outline" size={17} />
                      <Text numberOfLines={3} style={styles.instructionText}>{medication.instructions}</Text>
                    </View>
                  ) : null}

                  <View style={styles.medicationFooter}>
                    <View style={styles.stateSummary}>
                      <View style={[
                        styles.stateDot,
                        medication.is_active ? styles.stateDotActive : styles.stateDotPaused,
                      ]} />
                      <Text style={styles.medicationState}>
                        {medication.is_active ? 'Incluído na agenda' : 'Fora da agenda'}
                      </Text>
                    </View>

                    <Pressable
                      accessibilityHint="Solicita confirmação antes de remover o medicamento e seus registros"
                      accessibilityLabel={`Excluir ${medication.name}`}
                      accessibilityRole="button"
                      accessibilityState={{ disabled, busy: isDeleting }}
                      disabled={disabled}
                      onBlur={() => setFocusedControl(null)}
                      onFocus={() => setFocusedControl(`delete-${medication.id}`)}
                      onPress={() => confirmDelete(medication)}
                      style={({ hovered, pressed }) => [
                        styles.deleteButton,
                        hovered && !disabled && styles.deleteButtonHovered,
                        focusedControl === `delete-${medication.id}` && styles.focusVisible,
                        pressed && !disabled && styles.pressed,
                        disabled && !isDeleting && styles.controlDisabled,
                      ]}>
                      {isDeleting ? (
                        <ActivityIndicator color={VitalisColors.danger} size="small" />
                      ) : (
                        <MaterialIcons color={VitalisColors.danger} name="delete-outline" size={19} />
                      )}
                      <Text style={styles.deleteText}>{isDeleting ? 'Excluindo…' : 'Excluir'}</Text>
                    </Pressable>
                  </View>
                </SectionCard>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeading eyebrow="Segurança" title="Privacidade" />
        <SectionCard style={styles.securityCard} tone="soft">
          <View style={styles.securityIcon}>
            <MaterialIcons color={VitalisColors.primaryStrong} name="shield" size={23} />
          </View>
          <View style={styles.securityCopy}>
            <Text style={styles.securityTitle}>Seus registros pertencem à sua conta</Text>
            <Text style={styles.securityBody}>
              Sua sessão identifica você, e as regras de acesso do banco impedem que outra conta consulte seus medicamentos e confirmações.
            </Text>
          </View>
        </SectionCard>
      </View>

      <View style={styles.section}>
        <SectionHeading eyebrow="Sessão" title="Acesso" />
        <PrimaryButton
          accessibilityHint="Encerra sua sessão neste dispositivo"
          icon="logout"
          label="Sair da conta"
          loading={signingOut}
          onPress={() => void handleSignOut()}
          tone="secondary"
        />
      </View>

      <Text style={styles.version}>Vitalis Mobile · versão 1.0</Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { gap: VitalisSpacing.xl, paddingTop: VitalisSpacing.xs },
  section: { gap: VitalisSpacing.sm },
  profileCard: {
    alignItems: 'center',
    borderRadius: VitalisRadius.xl,
    flexDirection: 'row',
    gap: VitalisSpacing.md,
    minHeight: 132,
    padding: VitalisSpacing.lg,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: VitalisColors.primary,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: VitalisRadius.lg,
    borderWidth: 1,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  avatarText: { color: VitalisColors.surface, fontFamily: VitalisFonts.bodyBold, fontSize: 20 },
  profileCopy: { flex: 1, gap: 4, minWidth: 0 },
  profileName: { color: VitalisColors.onDark, fontFamily: VitalisFonts.bodySemiBold, fontSize: 20, lineHeight: 26 },
  profileEmail: { color: VitalisColors.onDarkMuted, fontFamily: VitalisFonts.body, fontSize: 14, lineHeight: 20 },
  profileStatus: { alignItems: 'flex-start', marginTop: VitalisSpacing.xs },
  addButton: {
    alignItems: 'center',
    backgroundColor: VitalisColors.primary,
    borderColor: VitalisColors.primary,
    borderRadius: VitalisRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    minHeight: 44,
    paddingHorizontal: 14,
  },
  addButtonHovered: { backgroundColor: VitalisColors.primaryHover },
  addButtonText: { color: VitalisColors.surface, fontFamily: VitalisFonts.bodyBold, fontSize: 13 },
  medicationList: { gap: VitalisSpacing.sm },
  medicationListWide: { alignItems: 'flex-start', flexDirection: 'row', flexWrap: 'wrap' },
  medicationCard: {
    backgroundColor: VitalisColors.surfaceRaised,
    gap: VitalisSpacing.sm,
    padding: VitalisSpacing.md,
  },
  medicationCardWide: { width: '49%' },
  medicationInactive: { backgroundColor: VitalisColors.surfaceSoft },
  medicationTop: { alignItems: 'center', flexDirection: 'row', gap: VitalisSpacing.sm },
  medicationCopy: { flex: 1, gap: 2, minWidth: 0 },
  medicationName: { color: VitalisColors.ink, fontFamily: VitalisFonts.bodySemiBold, fontSize: 16, lineHeight: 21 },
  medicationDosage: { color: VitalisColors.muted, fontFamily: VitalisFonts.body, fontSize: 13, lineHeight: 19 },
  switchBlock: { alignItems: 'flex-end', gap: 3 },
  switchLabelRow: { alignItems: 'center', flexDirection: 'row', gap: 4, minHeight: 18 },
  switchLabel: { color: VitalisColors.muted, fontFamily: VitalisFonts.bodySemiBold, fontSize: 11, lineHeight: 16 },
  switchLabelActive: { color: '#106B45' },
  medicationFacts: {
    backgroundColor: VitalisColors.surfaceSoft,
    borderRadius: VitalisRadius.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: VitalisSpacing.sm,
    padding: VitalisSpacing.sm,
  },
  factItem: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  factText: { color: VitalisColors.bodyStrong, fontFamily: VitalisFonts.bodyMedium, fontSize: 12, lineHeight: 17 },
  scheduleBlock: { gap: 7 },
  scheduleLabel: {
    color: VitalisColors.muted,
    fontFamily: VitalisFonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.45,
    lineHeight: 15,
    textTransform: 'uppercase',
  },
  scheduleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  scheduleChip: {
    backgroundColor: VitalisColors.primaryMist,
    borderColor: '#C9DCF7',
    borderRadius: VitalisRadius.sm,
    borderWidth: 1,
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  scheduleTime: {
    color: VitalisColors.primaryStrong,
    fontFamily: VitalisFonts.bodySemiBold,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  instructionRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 7 },
  instructionText: { color: VitalisColors.muted, flex: 1, fontFamily: VitalisFonts.body, fontSize: 12, lineHeight: 18 },
  medicationFooter: {
    alignItems: 'center',
    borderTopColor: VitalisColors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: VitalisSpacing.xs,
  },
  stateSummary: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  stateDot: { borderRadius: VitalisRadius.pill, height: 8, width: 8 },
  stateDotActive: { backgroundColor: VitalisColors.success },
  stateDotPaused: { backgroundColor: VitalisColors.mutedSoft },
  medicationState: { color: VitalisColors.muted, fontFamily: VitalisFonts.bodyMedium, fontSize: 12 },
  deleteButton: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: VitalisRadius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    minHeight: 44,
    paddingHorizontal: 8,
  },
  deleteButtonHovered: { backgroundColor: VitalisColors.dangerSoft },
  deleteText: { color: VitalisColors.danger, fontFamily: VitalisFonts.bodySemiBold, fontSize: 13 },
  controlDisabled: { opacity: 0.55 },
  securityCard: { alignItems: 'flex-start', flexDirection: 'row', gap: VitalisSpacing.sm, padding: VitalisSpacing.md },
  securityIcon: {
    alignItems: 'center',
    backgroundColor: VitalisColors.primaryMist,
    borderRadius: VitalisRadius.md,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  securityCopy: { flex: 1, gap: 4 },
  securityTitle: { color: VitalisColors.ink, fontFamily: VitalisFonts.bodySemiBold, fontSize: 15, lineHeight: 20 },
  securityBody: { color: VitalisColors.muted, fontFamily: VitalisFonts.body, fontSize: 13, lineHeight: 20 },
  version: { color: VitalisColors.mutedSoft, fontFamily: VitalisFonts.body, fontSize: 12, textAlign: 'center' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
  focusVisible: { borderColor: VitalisColors.primary, boxShadow: VitalisElevation.focus },
});
