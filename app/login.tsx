import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { IconButton, InlineNotice, InputField, LogoMark, PrimaryButton, ScreenContainer, SectionCard } from '@/components/vitalis-ui';
import { VitalisColors, VitalisFonts } from '@/constants/vitalis-theme';
import { useAuth } from '@/contexts/auth-context';
import { useSafeBack } from '@/hooks/use-safe-back';

export default function LoginScreen() {
  const router = useRouter();
  const goBack = useSafeBack('/welcome');
  const { sendPasswordReset, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pendingAction, setPendingAction] = useState<'login' | 'reset' | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [feedback, setFeedback] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  async function handleLogin() {
    const nextErrors: { email?: string; password?: string } = {};
    if (!email.trim()) nextErrors.email = 'Digite seu e-mail.';
    else if (!email.includes('@')) nextErrors.email = 'Digite um e-mail válido.';
    if (!password) nextErrors.password = 'Digite sua senha.';
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setPendingAction('login');
    setFeedback(null);
    try {
      const result = await signIn(email, password);
      if (result.error) {
        setFeedback({ tone: 'error', text: result.error });
        return;
      }
      router.replace('/(tabs)/home');
    } catch {
      setFeedback({ tone: 'error', text: 'Não foi possível acessar sua conta agora. Tente novamente.' });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleReset() {
    if (!email.trim()) {
      setFieldErrors({ email: 'Digite seu e-mail para receber o link de recuperação.' });
      return;
    }
    if (!email.includes('@')) {
      setFieldErrors({ email: 'Digite um e-mail válido.' });
      return;
    }
    setPendingAction('reset');
    setFieldErrors({});
    setFeedback(null);
    try {
      const result = await sendPasswordReset(email);
      setFeedback(
        result.error
          ? { tone: 'error', text: result.error }
          : { tone: 'success', text: 'Enviamos as instruções de recuperação para seu e-mail.' },
      );
    } catch {
      setFeedback({ tone: 'error', text: 'Não foi possível solicitar a recuperação agora. Tente novamente.' });
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <ScreenContainer atmosphere="brand" keyboard scroll contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <IconButton icon="arrow-back" label="Voltar" onPress={goBack} />
        <LogoMark size={42} />
      </View>

      <View style={styles.header}>
        <View style={styles.headerMeta}>
          <MaterialIcons color={VitalisColors.success} name="lock-outline" size={17} />
          <Text style={styles.headerMetaText}>Acesso protegido à sua rotina</Text>
        </View>
        <Text accessibilityRole="header" style={styles.title}>Bem-vindo de volta.</Text>
        <Text style={styles.subtitle}>Entre para continuar sua rotina exatamente de onde parou.</Text>
      </View>

      <SectionCard style={styles.form}>
        <InputField
          autoCapitalize="none"
          autoComplete="email"
          accessibilityHint={fieldErrors.email}
          error={fieldErrors.email}
          keyboardType="email-address"
          label="E-mail"
          maxLength={254}
          onChangeText={(value) => {
            setEmail(value);
            setFieldErrors((current) => ({ ...current, email: undefined }));
            setFeedback(null);
          }}
          placeholder="voce@email.com"
          textContentType="emailAddress"
          value={email}
        />
        <View style={styles.passwordGroup}>
          <InputField
            autoComplete="current-password"
            accessibilityHint={fieldErrors.password}
            error={fieldErrors.password}
            label="Senha"
            maxLength={128}
            onChangeText={(value) => {
              setPassword(value);
              setFieldErrors((current) => ({ ...current, password: undefined }));
              setFeedback(null);
            }}
            onSubmitEditing={() => void handleLogin()}
            placeholder="Sua senha"
            returnKeyType="done"
            secureTextEntry={!showPassword}
            textContentType="password"
            value={password}
          />
          <Pressable
            accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            accessibilityRole="button"
            accessibilityState={{ expanded: showPassword }}
            onPress={() => setShowPassword((current) => !current)}
            style={({ pressed }) => [styles.passwordToggle, pressed && styles.pressed]}>
            <MaterialIcons color={VitalisColors.primaryStrong} name={showPassword ? 'visibility-off' : 'visibility'} size={18} />
            <Text style={styles.passwordToggleText}>{showPassword ? 'Ocultar senha' : 'Mostrar senha'}</Text>
          </Pressable>
        </View>

        {feedback ? <InlineNotice description={feedback.text} title={feedback.tone === 'error' ? 'Não foi possível entrar' : 'Confira seu e-mail'} tone={feedback.tone === 'error' ? 'danger' : 'success'} /> : null}

        <PrimaryButton
          disabled={pendingAction === 'reset'}
          label="Entrar com segurança"
          loading={pendingAction === 'login'}
          onPress={() => void handleLogin()}
        />
        <PrimaryButton
          disabled={pendingAction === 'login'}
          label="Esqueci minha senha"
          loading={pendingAction === 'reset'}
          onPress={() => void handleReset()}
          tone="ghost"
        />
      </SectionCard>

      <Pressable accessibilityRole="button" onPress={() => router.replace('/signup')} style={styles.accountLink}>
        <Text style={styles.accountText}>Ainda não tem conta? <Text style={styles.accountTextStrong}>Cadastre-se</Text></Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { alignSelf: 'center', gap: 22, maxWidth: 540, paddingTop: 8, width: '100%' },
  topRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  header: { gap: 7 },
  headerMeta: { alignItems: 'center', flexDirection: 'row', gap: 7, marginBottom: 3 },
  headerMetaText: { color: VitalisColors.bodyStrong, fontFamily: VitalisFonts.bodySemiBold, fontSize: 12, letterSpacing: 0.4 },
  title: { color: VitalisColors.ink, fontFamily: VitalisFonts.display, fontSize: 39, letterSpacing: -0.8, lineHeight: 42 },
  subtitle: { color: VitalisColors.muted, fontFamily: VitalisFonts.body, fontSize: 16, lineHeight: 24, maxWidth: 480 },
  form: { backgroundColor: VitalisColors.surfaceRaised, boxShadow: '0 16px 36px rgba(28,48,58,0.065)', gap: 16 },
  passwordGroup: { gap: 5 },
  passwordToggle: { alignItems: 'center', alignSelf: 'flex-end', flexDirection: 'row', gap: 6, minHeight: 44, paddingHorizontal: 4 },
  passwordToggleText: { color: VitalisColors.primaryStrong, fontFamily: VitalisFonts.bodySemiBold, fontSize: 13 },
  accountLink: { alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  accountText: { color: VitalisColors.muted, fontFamily: VitalisFonts.body, fontSize: 14 },
  accountTextStrong: { color: VitalisColors.primaryStrong, fontFamily: VitalisFonts.bodyBold },
  pressed: { opacity: 0.78 },
});
