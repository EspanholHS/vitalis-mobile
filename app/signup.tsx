import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { IconButton, InlineNotice, InputField, LogoMark, PrimaryButton, ScreenContainer, SectionCard } from '@/components/vitalis-ui';
import { VitalisColors, VitalisFonts, VitalisRadius } from '@/constants/vitalis-theme';
import { useAuth } from '@/contexts/auth-context';
import { useSafeBack } from '@/hooks/use-safe-back';

export default function SignupScreen() {
  const router = useRouter();
  const goBack = useSafeBack('/welcome');
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    terms?: string;
  }>({});
  const [error, setError] = useState<{ code?: string; message: string } | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  async function handleSignup() {
    const nextErrors: typeof fieldErrors = {};
    if (fullName.trim().length < 2) nextErrors.fullName = 'Digite seu nome completo.';
    if (!email.includes('@')) nextErrors.email = 'Digite um e-mail válido.';
    if (password.length < 6) nextErrors.password = 'Use pelo menos 6 caracteres.';
    if (password !== confirmPassword) nextErrors.confirmPassword = 'As senhas não coincidem.';
    if (!acceptedTerms) nextErrors.terms = 'A confirmação é necessária para criar sua conta.';
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setLoading(true);
    setError(null);
    try {
      const result = await signUp(fullName, email, password);
      if (result.error) return setError({ code: result.errorCode, message: result.error });
      if (result.requiresEmailConfirmation) {
        setConfirmationSent(true);
        return;
      }
      router.replace('/(tabs)/home');
    } catch {
      setError({ message: 'Não foi possível criar sua conta agora. Tente novamente.' });
    } finally {
      setLoading(false);
    }
  }

  if (confirmationSent) {
    return (
      <ScreenContainer atmosphere="brand" contentContainerStyle={styles.confirmationContainer}>
        <SectionCard style={styles.confirmationCard} tone="success">
          <View style={styles.confirmationIcon}>
            <MaterialIcons color={VitalisColors.success} name="mark-email-read" size={32} />
          </View>
          <Text accessibilityRole="header" style={styles.confirmationTitle}>Confirme seu e-mail</Text>
          <Text style={styles.confirmationBody}>Enviamos um link para {email}. Depois de confirmar, volte e entre na Vitalis.</Text>
          <PrimaryButton label="Ir para o login" onPress={() => router.replace('/login')} />
        </SectionCard>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer atmosphere="brand" keyboard scroll contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <IconButton icon="arrow-back" label="Voltar" onPress={goBack} />
        <LogoMark size={42} />
      </View>

      <View style={styles.header}>
        <View style={styles.headerMeta}>
          <MaterialIcons color={VitalisColors.primaryStrong} name="shield" size={17} />
          <Text style={styles.headerMetaText}>Conta individual e dados separados</Text>
        </View>
        <Text accessibilityRole="header" style={styles.title}>Comece com clareza.</Text>
        <Text style={styles.subtitle}>Sua conta separa e protege os dados da sua rotina.</Text>
      </View>

      <SectionCard style={styles.form}>
        <InputField
          accessibilityHint={fieldErrors.fullName}
          autoComplete="name"
          error={fieldErrors.fullName}
          label="Nome completo"
          maxLength={120}
          onChangeText={(value) => {
            setFullName(value);
            setFieldErrors((current) => ({ ...current, fullName: undefined }));
            setError(null);
          }}
          placeholder="Como devemos chamar você?"
          textContentType="name"
          value={fullName}
        />
        <InputField
          accessibilityHint={fieldErrors.email}
          autoCapitalize="none"
          autoComplete="email"
          error={fieldErrors.email}
          keyboardType="email-address"
          label="E-mail"
          maxLength={254}
          onChangeText={(value) => {
            setEmail(value);
            setFieldErrors((current) => ({ ...current, email: undefined }));
            setError(null);
          }}
          placeholder="voce@email.com"
          textContentType="emailAddress"
          value={email}
        />
        <InputField
          accessibilityHint={fieldErrors.password ?? 'Use pelo menos 6 caracteres.'}
          autoComplete="new-password"
          error={fieldErrors.password}
          helper="Use pelo menos 6 caracteres."
          label="Senha"
          maxLength={128}
          onChangeText={(value) => {
            setPassword(value);
            setFieldErrors((current) => ({ ...current, password: undefined }));
            setError(null);
          }}
          placeholder="Crie uma senha"
          secureTextEntry
          textContentType="newPassword"
          value={password}
        />
        <InputField
          accessibilityHint={fieldErrors.confirmPassword}
          autoComplete="new-password"
          error={fieldErrors.confirmPassword}
          label="Confirmar senha"
          maxLength={128}
          onChangeText={(value) => {
            setConfirmPassword(value);
            setFieldErrors((current) => ({ ...current, confirmPassword: undefined }));
            setError(null);
          }}
          onSubmitEditing={() => void handleSignup()}
          placeholder="Repita a senha"
          returnKeyType="done"
          secureTextEntry
          textContentType="newPassword"
          value={confirmPassword}
        />

        <Pressable
          accessibilityHint="Necessário para criar sua conta"
          accessibilityRole="checkbox"
          accessibilityState={{ checked: acceptedTerms }}
          onPress={() => {
            setAcceptedTerms((current) => !current);
            setFieldErrors((current) => ({ ...current, terms: undefined }));
            setError(null);
          }}
          style={({ pressed }) => [styles.termsRow, acceptedTerms && styles.termsRowChecked, pressed && styles.pressed]}>
          <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
            {acceptedTerms ? <MaterialIcons color={VitalisColors.surface} name="check" size={18} /> : null}
          </View>
          <Text style={styles.termsText}>Li e aceito os termos de uso e a política de privacidade.</Text>
        </Pressable>
        {fieldErrors.terms ? <Text accessibilityLiveRegion="polite" style={styles.termsError}>{fieldErrors.terms}</Text> : null}

        {error ? (
          <>
            <InlineNotice
              description={error.code === 'over_email_send_rate_limit'
                ? 'Este e-mail já pode estar em processo de cadastro. Não envie novamente; tente entrar na sua conta.'
                : error.message}
              title={error.code === 'over_email_send_rate_limit' ? 'Cadastro já solicitado' : 'Revise seus dados'}
              tone={error.code === 'over_email_send_rate_limit' ? 'warning' : 'danger'}
            />
            {error.code === 'over_email_send_rate_limit' ? (
              <PrimaryButton label="Ir para o login" onPress={() => router.replace('/login')} tone="secondary" />
            ) : null}
          </>
        ) : null}

        <PrimaryButton label="Criar conta" loading={loading} onPress={() => void handleSignup()} />
      </SectionCard>

      <View style={styles.privacyNote}>
        <MaterialIcons color={VitalisColors.muted} name="lock-outline" size={17} />
        <Text style={styles.privacyNoteText}>Seus dados ficam protegidos pela sessão e separados dos dados de outras contas.</Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { alignSelf: 'center', gap: 21, maxWidth: 560, paddingTop: 8, width: '100%' },
  topRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  header: { gap: 7 },
  headerMeta: { alignItems: 'center', flexDirection: 'row', gap: 7, marginBottom: 3 },
  headerMetaText: { color: VitalisColors.primaryStrong, fontFamily: VitalisFonts.bodySemiBold, fontSize: 12, letterSpacing: 0.35 },
  title: { color: VitalisColors.ink, fontFamily: VitalisFonts.display, fontSize: 39, letterSpacing: -0.8, lineHeight: 42 },
  subtitle: { color: VitalisColors.muted, fontFamily: VitalisFonts.body, fontSize: 16, lineHeight: 24 },
  form: { backgroundColor: VitalisColors.surfaceRaised, boxShadow: '0 16px 36px rgba(28,48,58,0.065)', gap: 16 },
  termsRow: { alignItems: 'center', backgroundColor: VitalisColors.surfaceSoft, borderColor: VitalisColors.border, borderRadius: VitalisRadius.md, borderWidth: 1, flexDirection: 'row', gap: 11, minHeight: 58, paddingHorizontal: 12, paddingVertical: 8 },
  termsRowChecked: { backgroundColor: VitalisColors.primaryMist, borderColor: VitalisColors.primary },
  checkbox: { alignItems: 'center', backgroundColor: VitalisColors.surface, borderColor: VitalisColors.borderStrong, borderRadius: VitalisRadius.sm, borderWidth: 1, height: 26, justifyContent: 'center', width: 26 },
  checkboxChecked: { backgroundColor: VitalisColors.primary, borderColor: VitalisColors.primary },
  termsText: { color: VitalisColors.bodyStrong, flex: 1, fontFamily: VitalisFonts.body, fontSize: 14, lineHeight: 21 },
  termsError: { color: VitalisColors.danger, fontFamily: VitalisFonts.bodyMedium, fontSize: 13, lineHeight: 19, marginTop: -8 },
  privacyNote: { alignItems: 'flex-start', flexDirection: 'row', gap: 8, justifyContent: 'center', paddingHorizontal: 8 },
  privacyNoteText: { color: VitalisColors.muted, flexShrink: 1, fontFamily: VitalisFonts.body, fontSize: 13, lineHeight: 20, maxWidth: 470, textAlign: 'center' },
  confirmationContainer: { alignSelf: 'center', justifyContent: 'center', maxWidth: 520, width: '100%' },
  confirmationCard: { alignItems: 'center', gap: 13, paddingVertical: 32 },
  confirmationIcon: { alignItems: 'center', backgroundColor: VitalisColors.surface, borderRadius: 999, height: 64, justifyContent: 'center', width: 64 },
  confirmationTitle: { color: VitalisColors.ink, fontFamily: VitalisFonts.display, fontSize: 32 },
  confirmationBody: { color: VitalisColors.muted, fontFamily: VitalisFonts.body, fontSize: 15, lineHeight: 23, maxWidth: 440, textAlign: 'center' },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
});
